import crypto from "crypto";
import { env } from "../config/env";
import { OTP_MAX_ATTEMPTS, hashWith, safeEqual } from "../lib/otpCore";

export { OTP_MAX_ATTEMPTS, safeEqual };
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_SENDS_PER_HOUR = 5;

export const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
export const hashOtp = (userId: string, code: string) => hashWith(env.JWT_SECRET, userId, code);
