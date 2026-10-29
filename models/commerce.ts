import { Schema, type InferSchemaType } from "mongoose";
import { PAYMENT_METHODS, PAYMENT_STATUSES, ObjectId, getModel, withCreated } from "./shared";

const enrollmentSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    courseId: { type: ObjectId, ref: "Course", required: true },
    paymentId: { type: ObjectId, ref: "Payment" }, // absent when an admin granted free access
  },
  withCreated,
);
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });
enrollmentSchema.index({ courseId: 1 });
enrollmentSchema.index({ paymentId: 1 }, { unique: true, partialFilterExpression: { paymentId: { $type: "objectId" } } });

const paymentSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    courseId: { type: ObjectId, ref: "Course", required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    amount: { type: Number, required: true, min: 0 },
    trxId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    senderNumber: { type: String, required: true },
    status: { type: String, enum: PAYMENT_STATUSES, default: "PENDING" },
    rejectReason: String,
    reviewedBy: { type: ObjectId, ref: "User" },
    reviewedAt: Date,
  },
  withCreated,
);
paymentSchema.index({ userId: 1 });
paymentSchema.index({ courseId: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });

export type Enrollment = InferSchemaType<typeof enrollmentSchema>;
export type Payment = InferSchemaType<typeof paymentSchema>;
export const EnrollmentModel = getModel("Enrollment", enrollmentSchema);
export const PaymentModel = getModel("Payment", paymentSchema);
