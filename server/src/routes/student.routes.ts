import { Router } from "express";
import { z } from "zod";
import { CourseModel, EnrollmentModel, PaymentModel, SettingModel, UserModel } from "../models";
import { activeFilter, hasActiveEnrollment } from "../services/access";
import { sendPaymentReceivedEmail } from "../services/mailer";
import { requireAuth } from "../middleware/auth";
import { body } from "../middleware/validate";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { normalizeMobile } from "../utils/mobile";

export const studentRouter = Router();

// Numbers students send money to, shown on the checkout screen.
studentRouter.get("/settings/public", asyncHandler(async (_req, res) => {
  const rows = await SettingModel.find({ _id: { $in: ["bkash_number", "nagad_number", "support_contact"] } }).lean();
  res.json({ success: true, data: { settings: Object.fromEntries(rows.map((r) => [r._id, r.value])) } });
}));

const paymentSchema = z.object({
  courseId: z.string().regex(/^[a-f0-9]{24}$/i),
  method: z.enum(["BKASH", "NAGAD"]),
  trxId: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,20}$/, "Enter the transaction ID from the SMS"),
  senderNumber: z.string().transform((v, ctx) => {
    const n = normalizeMobile(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Enter the number you paid from" });
    return n ?? "";
  }),
});

// The amount always comes from the course price, never from the client.
studentRouter.post("/payments", requireAuth, asyncHandler(async (req, res) => {
  const input = body(paymentSchema, req);
  const course = await CourseModel.findOne({ _id: input.courseId, status: "LIVE" }).lean();
  if (!course) throw new ApiError(404, "Course not found");

  const userId = req.user!.id;
  if (await hasActiveEnrollment(userId, course._id)) throw new ApiError(409, "You already have access to this course");
  if (await PaymentModel.exists({ userId, courseId: course._id, status: "PENDING" })) throw new ApiError(409, "Your payment is already waiting for approval");

  const payment = await PaymentModel.create({ userId, courseId: course._id, method: input.method, amount: course.priceBdt, trxId: input.trxId, senderNumber: input.senderNumber });
  const buyer = await UserModel.findById(userId).select("name email").lean();
  if (buyer) void sendPaymentReceivedEmail(buyer.email, buyer.name, course.title);
  res.status(201).json({ success: true, message: "Payment submitted. We will approve it soon.", data: { payment } });
}));

// Is this course active for me, waiting for approval, or expired?
studentRouter.get("/courses/:slug/status", requireAuth, asyncHandler(async (req, res) => {
  const course = await CourseModel.findOne({ slug: String(req.params.slug).toLowerCase() }).select("_id").lean();
  if (!course) throw new ApiError(404, "Course not found");
  const userId = req.user!.id;
  const active = await EnrollmentModel.findOne(activeFilter(userId, course._id)).lean();
  const [any, pending] = await Promise.all([EnrollmentModel.exists({ userId, courseId: course._id }), PaymentModel.exists({ userId, courseId: course._id, status: "PENDING" })]);
  res.json({ success: true, data: { enrolled: !!active, expiresAt: active?.expiresAt ?? null, expired: !active && !!any, pending: !!pending } });
}));

studentRouter.get("/me/enrollments", requireAuth, asyncHandler(async (req, res) => {
  const enrollments = await EnrollmentModel.find({ userId: req.user!.id }).populate("courseId").lean();
  res.json({ success: true, data: { enrollments } });
}));

studentRouter.get("/me/payments", requireAuth, asyncHandler(async (req, res) => {
  const payments = await PaymentModel.find({ userId: req.user!.id }).sort({ createdAt: -1 }).populate("courseId", "title").lean();
  res.json({ success: true, data: { payments } });
}));
