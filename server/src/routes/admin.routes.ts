import { Router } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  AttemptModel, CategoryModel, CourseModel, EnrollmentModel, ExamModel, NoticeModel, PaymentModel, RoutineDayModel, SettingModel, UserModel,
} from "../models";
import { requireAuth, requireRole } from "../middleware/auth";
import { body } from "../middleware/validate";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { slugify } from "../utils/slug";
import { addDays, parseDhakaDate } from "../utils/time";
import { adminContentRouter } from "./adminContent.routes";
import { adminExamRouter } from "./adminExam.routes";
import { ACCESS_DAYS, DAY_MS } from "../lib/exam";
import { sendPaymentApprovedEmail, sendPaymentRejectedEmail } from "../services/mailer";
import { consumeOtp, issueOtp, publicUser, startSession } from "./auth.routes";

export const adminRouter = Router();

const CONTENT = ["SUPER_ADMIN", "EXAM_MANAGER"] as const; // categories, courses, routine, questions
const MONEY = ["SUPER_ADMIN", "SUPPORT"] as const; // payments, students
const id = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

/* ---------- admin sign in: password, then a 6 digit code by email ---------- */
adminRouter.post(
  "/login",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many attempts" } }),
  asyncHandler(async (req, res) => {
    const input = body(
      z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(72), code: z.string().trim().regex(/^\d{6}$/).optional() }),
      req,
    );
    const user = await UserModel.findOne({ email: input.email }).select("+passwordHash");
    const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok || user.role === "STUDENT" || user.blocked) throw new ApiError(401, "Wrong email or password");

    if (!input.code) {
      await issueOtp(user, "ADMIN_LOGIN");
      return res.status(202).json({ success: true, message: "Code sent to your email", data: { needsCode: true } });
    }
    await consumeOtp(String(user._id), "ADMIN_LOGIN", input.code);
    const accessToken = startSession(res, user);
    res.json({ success: true, data: { user: publicUser(user), accessToken } });
  }),
);

adminRouter.use(requireAuth, requireRole("SUPER_ADMIN", "EXAM_MANAGER", "SUPPORT"));

/* ---------- dashboard ---------- */
adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const [students, paid, pending, revenue, recent] = await Promise.all([
      UserModel.countDocuments({ role: "STUDENT" }),
      EnrollmentModel.countDocuments({ paymentId: { $exists: true } }),
      PaymentModel.countDocuments({ status: "PENDING" }),
      PaymentModel.aggregate([{ $match: { status: "APPROVED", reviewedAt: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      PaymentModel.find().sort({ createdAt: -1 }).limit(4).populate("userId", "name").lean(),
    ]);
    const liveExam = await ExamModel.findOne({ status: "LIVE" }).select("dayNo").lean();
    const takingNow = liveExam ? await AttemptModel.countDocuments({ examId: liveExam._id, isLive: true, submittedAt: null }) : 0;
    const past = await ExamModel.find({ status: "RESULT_PUBLISHED" }).sort({ opensAt: -1 }).limit(8).select("dayNo participants").lean();
    res.json({ success: true, data: { students, paid, pending, revenueThisMonth: revenue[0]?.total ?? 0, recentPayments: recent, live: liveExam ? { dayNo: liveExam.dayNo, takingNow } : null, participation: past.reverse().map((e) => ({ dayNo: e.dayNo, count: e.participants ?? 0 })) } });
  }),
);

/* ---------- categories ---------- */
const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  icon: z.string().trim().max(30).optional(),
  color: z.enum(["yellow", "mint", "lime", "rose", "blue"]).optional(),
  sortOrder: z.number().int().optional(),
  hidden: z.boolean().optional(),
});

adminRouter.get("/categories", requireRole(...CONTENT), asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { categories: await CategoryModel.find().sort({ sortOrder: 1 }).lean() } });
}));
adminRouter.post("/categories", requireRole(...CONTENT), asyncHandler(async (req, res) => {
  const input = body(categorySchema, req);
  const category = await CategoryModel.create({ ...input, slug: slugify(input.name) });
  res.status(201).json({ success: true, data: { category } });
}));
adminRouter.patch("/categories/:id", requireRole(...CONTENT), asyncHandler(async (req, res) => {
  const category = await CategoryModel.findByIdAndUpdate(id.parse(req.params.id), body(categorySchema.partial(), req), { new: true });
  if (!category) throw new ApiError(404, "Category not found");
  res.json({ success: true, data: { category } });
}));

/* ---------- courses ---------- */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const courseSchema = z.object({
  categoryId: id,
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(2000),
  thumbnailUrl: z.string().url().optional(),
  durationDays: z.number().int().min(1).max(366),
  priceBdt: z.number().min(0),
  freeDays: z.number().int().min(0).max(30),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  examOpenTime: hhmm,
  examCloseTime: hhmm,
  negativeMarking: z.number().min(0).max(1),
  passMark: z.number().min(0),
  subjectCounts: z.object({ BANGLA: z.number().int().min(0), ENGLISH: z.number().int().min(0), MATH: z.number().int().min(0), GK: z.number().int().min(0), ICT: z.number().int().min(0) }),
  status: z.enum(["DRAFT", "LIVE", "ARCHIVED"]),
});
const toDoc = (i: Partial<z.infer<typeof courseSchema>>) => ({ ...i, ...(i.startDate ? { startDate: parseDhakaDate(i.startDate) } : {}) });

adminRouter.get("/courses", requireRole(...CONTENT), asyncHandler(async (_req, res) => {
  const courses = await CourseModel.find().sort({ createdAt: -1 }).lean();
  const counts = await EnrollmentModel.aggregate([{ $group: { _id: "$courseId", n: { $sum: 1 } } }]);
  const byCourse = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ success: true, data: { courses: courses.map((c) => ({ ...c, students: byCourse.get(String(c._id)) ?? 0 })) } });
}));
adminRouter.post("/courses", requireRole(...CONTENT), asyncHandler(async (req, res) => {
  const input = body(courseSchema, req);
  const course = await CourseModel.create({ ...toDoc(input), slug: slugify(input.title) });
  res.status(201).json({ success: true, data: { course } });
}));
adminRouter.patch("/courses/:id", requireRole(...CONTENT), asyncHandler(async (req, res) => {
  const course = await CourseModel.findByIdAndUpdate(id.parse(req.params.id), toDoc(body(courseSchema.partial(), req)), { new: true });
  if (!course) throw new ApiError(404, "Course not found");
  res.json({ success: true, data: { course } });
}));

/* ---------- routine ---------- */
const routineSchema = z.object({
  days: z.array(z.object({
    dayNo: z.number().int().min(1).max(366),
    type: z.enum(["TOPIC", "FINAL", "MODEL", "MIXED"]),
    topics: z.object({ bangla: z.string().max(120).optional(), english: z.string().max(120).optional(), math: z.string().max(120).optional(), gk: z.string().max(120).optional(), ict: z.string().max(120).optional() }),
    vocabFrom: z.number().int().optional(),
    vocabTo: z.number().int().optional(),
  })).max(366),
});

adminRouter.get("/courses/:id/routine", requireRole(...CONTENT), asyncHandler(async (req, res) => {
  const days = await RoutineDayModel.find({ courseId: id.parse(req.params.id) }).sort({ dayNo: 1 }).lean();
  res.json({ success: true, data: { days } });
}));
// Upserts by day number. Dates are derived from the course start date.
adminRouter.put("/courses/:id/routine", requireRole(...CONTENT), asyncHandler(async (req, res) => {
  const course = await CourseModel.findById(id.parse(req.params.id)).lean();
  if (!course) throw new ApiError(404, "Course not found");
  const { days } = body(routineSchema, req);
  if (days.length) {
    await RoutineDayModel.bulkWrite(days.map((d) => ({
      updateOne: { filter: { courseId: course._id, dayNo: d.dayNo }, update: { $set: { ...d, courseId: course._id, date: addDays(course.startDate, d.dayNo - 1) } }, upsert: true },
    })));
  }
  res.json({ success: true, message: `${days.length} days saved` });
}));

/* ---------- payments ---------- */
adminRouter.get("/payments", requireRole(...MONEY), asyncHandler(async (req, res) => {
  const { status } = z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional() }).parse(req.query);
  const payments = await PaymentModel.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(200)
    .populate("userId", "name mobile email").populate("courseId", "title").lean();
  res.json({ success: true, data: { payments } });
}));

adminRouter.post("/payments/:id/approve", requireRole(...MONEY), asyncHandler(async (req, res) => {
  const paymentId = id.parse(req.params.id);
  const expiresAt = new Date(Date.now() + ACCESS_DAYS * DAY_MS);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const p = await PaymentModel.findOneAndUpdate(
        { _id: paymentId, status: "PENDING" },
        { status: "APPROVED", reviewedBy: req.user!.id, reviewedAt: new Date() },
        { new: true, session },
      );
      if (!p) throw new ApiError(409, "This payment is not pending");
      await EnrollmentModel.updateOne(
        { userId: p.userId, courseId: p.courseId },
        { $set: { paymentId: p._id, expiresAt } }, // a renewal after expiry just moves the date
        { upsert: true, session },
      );
      await NoticeModel.create([{ userId: p.userId, courseId: p.courseId, title: "Payment approved", body: `Your payment was approved. All days of the course are unlocked until ${expiresAt.toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "long" })}.` }], { session });
    });
  } finally {
    await session.endSession();
  }
  const done = await PaymentModel.findById(paymentId).populate("userId", "name email").populate("courseId", "title").lean();
  const u = done?.userId as unknown as { name: string; email: string } | undefined;
  if (u) void sendPaymentApprovedEmail(u.email, u.name, (done?.courseId as unknown as { title: string })?.title ?? "your course", expiresAt);
  res.json({ success: true, message: "Approved and enrolled" });
}));

adminRouter.post("/payments/:id/reject", requireRole(...MONEY), asyncHandler(async (req, res) => {
  const { reason } = body(z.object({ reason: z.string().trim().min(3).max(200) }), req);
  const p = await PaymentModel.findOneAndUpdate(
    { _id: id.parse(req.params.id), status: "PENDING" },
    { status: "REJECTED", rejectReason: reason, reviewedBy: req.user!.id, reviewedAt: new Date() },
    { new: true },
  );
  if (!p) throw new ApiError(409, "This payment is not pending");
  await NoticeModel.create({ userId: p.userId, courseId: p.courseId, title: "Payment rejected", body: `Reason: ${reason}. You can submit the payment again.` });
  const who = await UserModel.findById(p.userId).select("name email").lean();
  const cname = (await CourseModel.findById(p.courseId).select("title").lean())?.title ?? "your course";
  if (who) void sendPaymentRejectedEmail(who.email, who.name, cname, reason);
  res.json({ success: true, message: "Rejected" });
}));

/* ---------- settings ---------- */
const SETTING_KEYS = ["bkash_number", "nagad_number", "support_contact", "site_name"] as const;
adminRouter.get("/settings", requireRole("SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  const rows = await SettingModel.find({ _id: { $in: SETTING_KEYS } }).lean();
  res.json({ success: true, data: { settings: Object.fromEntries(rows.map((r) => [r._id, r.value])) } });
}));
adminRouter.put("/settings", requireRole("SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const input = body(z.object(Object.fromEntries(SETTING_KEYS.map((k) => [k, z.string().trim().max(120).optional()]))), req) as Record<string, string | undefined>;
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) await SettingModel.updateOne({ _id: k }, { $set: { value: v } }, { upsert: true });
  }
  res.json({ success: true, message: "Saved" });
}));

adminRouter.use(adminExamRouter);
adminRouter.use(adminContentRouter);
