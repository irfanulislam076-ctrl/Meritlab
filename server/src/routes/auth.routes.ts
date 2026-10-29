import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { OtpCodeModel, UserModel, type OtpPurpose } from "../models";
import { requireAuth } from "../middleware/auth";
import { body } from "../middleware/validate";
import { sendOtpEmail } from "../services/mailer";
import { checkOtp } from "../lib/otpCore";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { normalizeMobile } from "../utils/mobile";
import {
  OTP_MAX_SENDS_PER_HOUR,
  OTP_TTL_MS,
  generateOtp,
  hashOtp,
} from "../utils/otp";
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  setRefreshCookie,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/tokens";

export const authRouter = Router();

// Brute-force protection for every auth endpoint (per IP).
authRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many attempts. Please try again in a few minutes." },
  }),
);

/* ---------- validation ---------- */
const email = z.string().trim().toLowerCase().email("Enter a valid email");
const mobile = z
  .string()
  .transform((v, ctx) => {
    const n = normalizeMobile(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Enter a valid Bangladeshi mobile number" });
    return n ?? "";
  });
const password = z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long");
const code = z.string().trim().regex(/^\d{6}$/, "Enter the 6 digit code");

const registerSchema = z.object({ name: z.string().trim().min(2).max(80), mobile, email, password });
const verifySchema = z.object({ email, code });
const resendSchema = z.object({ email, purpose: z.enum(["REGISTER", "RESET"]).default("REGISTER") });
const loginSchema = z.object({ identifier: z.string().trim().min(3).max(120), password: z.string().min(1).max(72) });
const forgotSchema = z.object({ email });
const resetSchema = z.object({ email, code, newPassword: password });

/* ---------- helpers ---------- */
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;
// Compared when the user does not exist, so response time does not reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

type UserLike = {
  _id: unknown;
  name: string;
  mobile: string;
  email: string;
  role: string;
  emailVerified: boolean;
  createdAt?: Date;
};

export const publicUser = (u: UserLike) => ({
  id: String(u._id),
  name: u.name,
  mobile: u.mobile,
  email: u.email,
  role: u.role,
  emailVerified: u.emailVerified,
  createdAt: u.createdAt,
});

export async function issueOtp(user: { _id: unknown; name: string; email: string }, purpose: OtpPurpose) {
  const userId = String(user._id);
  const sentLastHour = await OtpCodeModel.countDocuments({
    userId,
    purpose,
    createdAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) },
  });
  if (sentLastHour >= OTP_MAX_SENDS_PER_HOUR) {
    throw new ApiError(429, "Too many codes requested. Please try again in an hour.");
  }

  const plain = generateOtp();
  await OtpCodeModel.create({
    userId,
    purpose,
    codeHash: hashOtp(userId, plain),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  await sendOtpEmail(user.email, user.name, plain, purpose);
}

export async function consumeOtp(userId: string, purpose: OtpPurpose, submitted: string) {
  const record = await OtpCodeModel.findOne({ userId, purpose, usedAt: null, expiresAt: { $gt: new Date() } }).sort({
    createdAt: -1,
  });
  if (!record) throw new ApiError(400, "Invalid or expired code");
  const verdict = checkOtp(record, hashOtp(userId, submitted));
  if (verdict === "LOCKED") throw new ApiError(429, "Too many wrong attempts. Request a new code.");
  record.attempts += 1;
  if (verdict !== "OK") {
    await record.save();
    throw new ApiError(400, "Invalid or expired code");
  }
  record.usedAt = new Date();
  await record.save();
}

export function startSession(res: import("express").Response, user: UserLike & { tokenVersion?: number }) {
  const id = String(user._id);
  setRefreshCookie(res, signRefreshToken(id, user.tokenVersion ?? 0));
  return signAccessToken(id, user.role);
}

/* ---------- routes ---------- */

// 1. Create the account (unverified) and email a code.
authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = body(registerSchema, req);

    const found = await UserModel.find({ $or: [{ email: input.email }, { mobile: input.mobile }] });
    if (found.some((u) => u.emailVerified)) {
      throw new ApiError(409, "An account with this email or mobile already exists");
    }

    // Only unverified leftovers remain: reuse the one with this email, drop the rest.
    let user = found.find((u) => u.email === input.email);
    const stale = found.filter((u) => u !== user).map((u) => u._id);
    if (stale.length) await UserModel.deleteMany({ _id: { $in: stale } });

    const passwordHash = await bcrypt.hash(input.password, 10);
    if (user) {
      user.name = input.name;
      user.mobile = input.mobile;
      user.passwordHash = passwordHash;
      await user.save();
    } else {
      user = await UserModel.create({ name: input.name, mobile: input.mobile, email: input.email, passwordHash });
    }

    await issueOtp(user, "REGISTER");
    res.status(201).json({ success: true, message: "Code sent to your email", data: { email: user.email } });
  }),
);

// 2. Verify the email code, then the user is logged in.
authRouter.post(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const input = body(verifySchema, req);
    const user = await UserModel.findOne({ email: input.email });
    if (!user) throw new ApiError(400, "Invalid or expired code");

    await consumeOtp(String(user._id), "REGISTER", input.code);
    user.emailVerified = true;
    await user.save();

    const accessToken = startSession(res, user);
    res.json({ success: true, data: { user: publicUser(user), accessToken } });
  }),
);

authRouter.post(
  "/resend-otp",
  asyncHandler(async (req, res) => {
    const input = body(resendSchema, req);
    const user = await UserModel.findOne({ email: input.email });
    const allowed = user && (input.purpose === "RESET" ? user.emailVerified : !user.emailVerified);
    if (allowed) await issueOtp(user, input.purpose);
    res.json({ success: true, message: "If the account exists, a new code has been sent" });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = body(loginSchema, req);
    const id = input.identifier.includes("@") ? { email: input.identifier.toLowerCase() } : { mobile: normalizeMobile(input.identifier) ?? "-" };

    const user = await UserModel.findOne(id).select("+passwordHash");
    const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);

    if (!user) throw new ApiError(401, "Wrong email/mobile or password");
    if (user.blocked) throw new ApiError(403, "This account is blocked. Contact support.");
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ApiError(429, "Too many wrong attempts. Try again in a few minutes.");
    }

    if (!ok) {
      user.failedLogins += 1;
      if (user.failedLogins >= MAX_FAILED_LOGINS) {
        user.lockedUntil = new Date(Date.now() + LOCK_MS);
        user.failedLogins = 0;
      }
      await user.save();
      throw new ApiError(401, "Wrong email/mobile or password");
    }

    if (!user.emailVerified) {
      throw new ApiError(403, "Please verify your email first", { code: "EMAIL_NOT_VERIFIED", email: user.email });
    }

    user.failedLogins = 0;
    user.lockedUntil = undefined;
    await user.save();

    const accessToken = startSession(res, user);
    res.json({ success: true, data: { user: publicUser(user), accessToken } });
  }),
);

// Uses the httpOnly refresh cookie to hand out a fresh access token.
authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new ApiError(401, "Login required");

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      clearRefreshCookie(res);
      throw new ApiError(401, "Session expired, please log in again");
    }

    const user = await UserModel.findById(payload.sub);
    if (!user || user.blocked || (user.tokenVersion ?? 0) !== payload.tv) {
      clearRefreshCookie(res);
      throw new ApiError(401, "Session expired, please log in again");
    }

    const accessToken = startSession(res, user);
    res.json({ success: true, data: { user: publicUser(user), accessToken } });
  }),
);

authRouter.post("/logout", (_req, res) => {
  clearRefreshCookie(res);
  res.json({ success: true, message: "Logged out" });
});

authRouter.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const input = body(forgotSchema, req);
    const user = await UserModel.findOne({ email: input.email });
    if (user?.emailVerified) {
      try {
        await issueOtp(user, "RESET");
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 429)) throw error;
      }
    }
    // Same answer whether or not the account exists.
    res.json({ success: true, message: "If the account exists, a code has been sent" });
  }),
);

authRouter.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const input = body(resetSchema, req);
    const user = await UserModel.findOne({ email: input.email });
    if (!user) throw new ApiError(400, "Invalid or expired code");

    await consumeOtp(String(user._id), "RESET", input.code);
    user.passwordHash = await bcrypt.hash(input.newPassword, 10);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1; // logs out every other device
    user.failedLogins = 0;
    user.lockedUntil = undefined;
    user.emailVerified = true;
    await user.save();

    clearRefreshCookie(res);
    res.json({ success: true, message: "Password updated. Please log in." });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await UserModel.findById(req.user!.id);
    if (!user) throw new ApiError(404, "User not found");
    res.json({ success: true, data: { user: publicUser(user) } });
  }),
);
