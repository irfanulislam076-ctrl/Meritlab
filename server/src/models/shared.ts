import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const ObjectId = Schema.Types.ObjectId;

export const ROLES = ["STUDENT", "SUPER_ADMIN", "EXAM_MANAGER", "SUPPORT"] as const;
export const OTP_PURPOSES = ["REGISTER", "RESET", "ADMIN_LOGIN"] as const;
export const COURSE_STATUSES = ["DRAFT", "LIVE", "ARCHIVED"] as const;
export const ROUTINE_TYPES = ["TOPIC", "FINAL", "MODEL", "MIXED"] as const;
export const EXAM_STATUSES = ["SCHEDULED", "LIVE", "CLOSED", "RESULT_PUBLISHED"] as const;
export const SUBJECTS = ["BANGLA", "ENGLISH", "MATH", "GK", "ICT"] as const;
export const Q_TYPES = ["PYQ_STYLE", "STANDARD", "PREDICTED"] as const;
export const CHOICES = ["A", "B", "C", "D"] as const;
export const PAYMENT_METHODS = ["BKASH", "NAGAD"] as const;
export const PAYMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export const MATERIAL_TYPES = ["EXAM_PDF", "SOLVE_SHEET", "SHORTCUT"] as const;

export type Role = (typeof ROLES)[number];
export type OtpPurpose = (typeof OTP_PURPOSES)[number];
export type CourseStatus = (typeof COURSE_STATUSES)[number];
export type RoutineType = (typeof ROUTINE_TYPES)[number];
export type ExamStatus = (typeof EXAM_STATUSES)[number];
export type Subject = (typeof SUBJECTS)[number];
export type QType = (typeof Q_TYPES)[number];
export type Choice = (typeof CHOICES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type MaterialType = (typeof MATERIAL_TYPES)[number];

/** No __v, and only a createdAt timestamp. */
export const withCreated = { versionKey: false, timestamps: { createdAt: true, updatedAt: false } } as const;
export const plain = { versionKey: false } as const;

/** Reuses the compiled model across Next.js hot reloads and serverless invocations. */
export function getModel<S extends Schema>(name: string, schema: S): Model<InferSchemaType<S>> {
  return (
    (models[name] as Model<InferSchemaType<S>> | undefined) ??
    model<InferSchemaType<S>>(name, schema as unknown as Schema<InferSchemaType<S>>)
  );
}
