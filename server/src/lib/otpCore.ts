import crypto from "crypto";

export const OTP_MAX_ATTEMPTS = 5;

export const hashWith = (secret: string, userId: string, code: string) =>
  crypto.createHmac("sha256", secret).update(`${userId}:${code}`).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export type OtpVerdict = "OK" | "EXPIRED" | "LOCKED" | "WRONG";

/** Pure check of one stored code: expiry first, then the attempt limit, then the code itself. */
export function checkOtp(rec: { expiresAt: Date; attempts: number; codeHash: string }, submittedHash: string, now: Date = new Date()): OtpVerdict {
  if (rec.expiresAt <= now) return "EXPIRED";
  if (rec.attempts >= OTP_MAX_ATTEMPTS) return "LOCKED";
  return safeEqual(rec.codeHash, submittedHash) ? "OK" : "WRONG";
}
