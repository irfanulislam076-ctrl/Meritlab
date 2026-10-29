import { EnrollmentModel } from "../models";

/** An enrollment counts while it has no expiry (old records) or the expiry is in the future. */
export const activeFilter = (userId: unknown, courseId?: unknown) => ({
  userId,
  ...(courseId ? { courseId } : {}),
  $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
});

export const hasActiveEnrollment = async (userId: unknown, courseId: unknown) => !!(await EnrollmentModel.exists(activeFilter(userId, courseId)));

/** Rounds after the first reuse the questions of the first round's exam. */
export const qExamId = (exam: { _id: unknown; sourceExamId?: unknown }) => exam.sourceExamId ?? exam._id;
