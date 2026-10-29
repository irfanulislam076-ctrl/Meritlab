import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AttemptModel, CourseModel, EnrollmentModel, MaterialModel, NoticeModel, PaymentModel, UserModel, VocabPageModel } from "../models";
import { ACCESS_DAYS, DAY_MS } from "../lib/exam";
import { requireRole } from "../middleware/auth";
import { body } from "../middleware/validate";
import { sendNoticeEmail } from "../services/mailer";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

export const adminContentRouter = Router();
const CONTENT = ["SUPER_ADMIN", "EXAM_MANAGER"] as const;
const MONEY = ["SUPER_ADMIN", "SUPPORT"] as const;
const oid = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ---------- students ---------- */
adminContentRouter.get("/students", requireRole(...MONEY), asyncHandler(async (req, res) => {
  const search = z.string().trim().max(60).optional().parse(req.query.search);
  const filter: Record<string, unknown> = { role: "STUDENT" };
  if (search) { const re = { $regex: escapeRe(search), $options: "i" }; filter.$or = [{ name: re }, { mobile: re }, { email: re }]; }
  const students = await UserModel.find(filter).sort({ createdAt: -1 }).limit(50).select("name mobile email blocked createdAt").lean();
  res.json({ success: true, data: { students } });
}));

adminContentRouter.get("/students/:id", requireRole(...MONEY), asyncHandler(async (req, res) => {
  const id = oid.parse(req.params.id);
  const [student, enrollments, payments, results] = await Promise.all([
    UserModel.findById(id).select("name mobile email blocked createdAt").lean(),
    EnrollmentModel.find({ userId: id }).populate("courseId", "title").lean(),
    PaymentModel.find({ userId: id }).sort({ createdAt: -1 }).populate("courseId", "title").lean(),
    AttemptModel.find({ userId: id, isLive: true, submittedAt: { $ne: null } }).sort({ submittedAt: -1 }).limit(30).populate("examId", "title").lean(),
  ]);
  if (!student) throw new ApiError(404, "Student not found");
  res.json({ success: true, data: { student, enrollments, payments, results } });
}));

adminContentRouter.post("/students/:id/block", requireRole(...MONEY), asyncHandler(async (req, res) => {
  const { blocked } = body(z.object({ blocked: z.boolean() }), req);
  await UserModel.updateOne({ _id: oid.parse(req.params.id), role: "STUDENT" }, { $set: { blocked }, $inc: { tokenVersion: 1 } }); // also ends their sessions
  res.json({ success: true, message: blocked ? "Blocked" : "Unblocked" });
}));

adminContentRouter.post("/students/:id/reset-password", requireRole(...MONEY), asyncHandler(async (req, res) => {
  const { newPassword } = body(z.object({ newPassword: z.string().min(8).max(72) }), req);
  await UserModel.updateOne({ _id: oid.parse(req.params.id), role: "STUDENT" }, { $set: { passwordHash: await bcrypt.hash(newPassword, 10), failedLogins: 0 }, $unset: { lockedUntil: 1 }, $inc: { tokenVersion: 1 } });
  res.json({ success: true, message: "Password reset" });
}));

adminContentRouter.post("/students/:id/grant", requireRole(...MONEY), asyncHandler(async (req, res) => {
  const { courseId } = body(z.object({ courseId: oid }), req);
  const userId = oid.parse(req.params.id);
  await EnrollmentModel.updateOne({ userId, courseId }, { $set: { expiresAt: new Date(Date.now() + ACCESS_DAYS * DAY_MS) } }, { upsert: true }); // free access for 3 months, no payment
  res.json({ success: true, message: "Access granted" });
}));

/* ---------- notices ---------- */
adminContentRouter.get("/notices", asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { notices: await NoticeModel.find().sort({ createdAt: -1 }).limit(30).populate("courseId", "title").lean() } });
}));

adminContentRouter.post("/notices", asyncHandler(async (req, res) => {
  const input = body(z.object({ courseId: oid.optional(), title: z.string().trim().min(2).max(120), body: z.string().trim().min(2).max(2000), email: z.boolean().default(false) }), req);
  const notice = await NoticeModel.create({ courseId: input.courseId, title: input.title, body: input.body, emailed: input.email });
  if (input.email) {
    // Sent in the background in small batches so the request returns at once.
    void (async () => {
      const filter = input.courseId ? { courseId: input.courseId } : {};
      const userIds = (await EnrollmentModel.find(filter).select("userId").limit(500).lean()).map((e) => e.userId);
      const users = await UserModel.find({ _id: { $in: userIds } }).select("email").lean();
      for (let i = 0; i < users.length; i += 10) await Promise.all(users.slice(i, i + 10).map((u) => sendNoticeEmail(u.email, input.title, input.body)));
    })();
  }
  res.status(201).json({ success: true, data: { notice } });
}));

/* ---------- vocabulary CSV import ---------- */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

// Columns: course, day, page, word, Bangla meaning, English explanation. The course column is ignored, the course comes from courseId.
adminContentRouter.post("/vocab/import", requireRole(...CONTENT), asyncHandler(async (req, res) => {
  const { courseId, csv, dryRun } = body(z.object({ courseId: oid, csv: z.string().min(1).max(2_000_000), dryRun: z.boolean().default(true) }), req);
  if (!(await CourseModel.exists({ _id: courseId }))) throw new ApiError(404, "Course not found");
  let rows = parseCsv(csv.replace(/^\uFEFF/, ""));
  if (rows[0] && /word/i.test(rows[0].join(","))) rows = rows.slice(1);

  const pages = new Map<string, { dayNo: number; pageNo: number; words: { word: string; banglaMeaning: string; englishExplanation: string }[] }>();
  rows.forEach((r, i) => {
    const [, d, p, word, bn, en] = r.map((x) => x.trim());
    const dayNo = Number(d), pageNo = Number(p);
    if (!Number.isInteger(dayNo) || dayNo < 1 || !Number.isInteger(pageNo) || pageNo < 1 || pageNo > 10 || !word || !bn || !en) throw new ApiError(400, `Row ${i + 1}: needs day, page (1-10), word, Bangla meaning and English explanation`);
    const key = `${dayNo}-${pageNo}`;
    const page = pages.get(key) ?? { dayNo, pageNo, words: [] };
    if (page.words.length >= 5) throw new ApiError(400, `Day ${dayNo} page ${pageNo} has more than 5 words`);
    page.words.push({ word, banglaMeaning: bn, englishExplanation: en });
    pages.set(key, page);
  });

  const list = [...pages.values()];
  if (!dryRun) {
    await VocabPageModel.bulkWrite(list.map((p) => ({ updateOne: { filter: { courseId, dayNo: p.dayNo, pageNo: p.pageNo }, update: { $set: { words: p.words } }, upsert: true } })));
  }
  res.json({ success: true, data: { saved: !dryRun, pages: list.length, words: rows.length, preview: list.slice(0, 5) } });
}));

/* ---------- materials (upload the PDF with POST /upload/pdf first, then register it here) ---------- */
const materialSchema = z.object({
  courseId: oid, dayNo: z.number().int().min(1).max(366).optional(), type: z.enum(["EXAM_PDF", "SOLVE_SHEET", "SHORTCUT"]),
  title: z.string().trim().min(2).max(120), fileKey: z.string().min(3).max(300), pages: z.number().int().min(1).optional(),
  isFree: z.boolean().default(false), visibleFrom: z.string().datetime().optional(),
});
adminContentRouter.get("/materials", requireRole(...CONTENT), asyncHandler(async (req, res) => {
  res.json({ success: true, data: { materials: await MaterialModel.find({ courseId: oid.parse(req.query.courseId) }).sort({ createdAt: -1 }).lean() } });
}));
adminContentRouter.post("/materials", requireRole(...CONTENT), asyncHandler(async (req, res) => {
  const m = body(materialSchema, req);
  res.status(201).json({ success: true, data: { material: await MaterialModel.create({ ...m, visibleFrom: m.visibleFrom ? new Date(m.visibleFrom) : undefined }) } });
}));
adminContentRouter.patch("/materials/:id", requireRole(...CONTENT), asyncHandler(async (req, res) => {
  const m = body(z.object({ isFree: z.boolean().optional(), visibleFrom: z.string().datetime().nullable().optional(), title: z.string().trim().min(2).max(120).optional() }), req);
  const update = { ...m, ...(m.visibleFrom !== undefined ? { visibleFrom: m.visibleFrom ? new Date(m.visibleFrom) : null } : {}) };
  const doc = await MaterialModel.findByIdAndUpdate(oid.parse(req.params.id), update, { new: true });
  if (!doc) throw new ApiError(404, "File not found");
  res.json({ success: true, data: { material: doc } });
}));
