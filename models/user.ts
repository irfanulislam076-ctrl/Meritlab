import { Schema, type InferSchemaType } from "mongoose";
import { ObjectId, OTP_PURPOSES, ROLES, getModel, withCreated } from "./shared";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, unique: true }, // normalized +8801XXXXXXXXX
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "STUDENT" },
    emailVerified: { type: Boolean, default: false },
    blocked: { type: Boolean, default: false },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: Date,
    noticesSeenAt: Date, // notices newer than this show the unread dot
  },
  withCreated,
);
userSchema.index({ role: 1 });

const otpCodeSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    purpose: { type: String, enum: OTP_PURPOSES, required: true },
    codeHash: { type: String, required: true }, // hash only, the plain code is never stored
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    usedAt: Date,
  },
  withCreated,
);
otpCodeSchema.index({ userId: 1, purpose: 1, createdAt: -1 });
// Documents live one hour: long enough for the "5 sends per hour" limit, then Mongo removes them.
otpCodeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 });

export type User = InferSchemaType<typeof userSchema>;
export type OtpCode = InferSchemaType<typeof otpCodeSchema>;
export const UserModel = getModel("User", userSchema);
export const OtpCodeModel = getModel("OtpCode", otpCodeSchema);
