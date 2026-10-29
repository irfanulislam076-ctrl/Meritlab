import { Schema, type InferSchemaType } from "mongoose";
import { COURSE_STATUSES, ROUTINE_TYPES, ObjectId, getModel, plain, withCreated } from "./shared";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    icon: { type: String, default: "landmark" },
    color: { type: String, default: "yellow" },
    sortOrder: { type: Number, default: 0 },
    hidden: { type: Boolean, default: false },
  },
  plain,
);

const courseSchema = new Schema(
  {
    categoryId: { type: ObjectId, ref: "Category", required: true, index: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true },
    thumbnailUrl: String,
    durationDays: { type: Number, default: 30, min: 1 },
    priceBdt: { type: Number, required: true, min: 0 },
    freeDays: { type: Number, default: 1, min: 0 },
    startDate: { type: Date, required: true }, // start of the Dhaka day, as a UTC instant
    examOpenTime: { type: String, default: "00:00" },
    examCloseTime: { type: String, default: "23:59" },
    negativeMarking: { type: Number, default: 0.25, min: 0 },
    passMark: { type: Number, default: 60, min: 0 },
    // Questions per subject in the daily exam. Configurable per course.
    subjectCounts: {
      BANGLA: { type: Number, default: 25 },
      ENGLISH: { type: Number, default: 25 },
      MATH: { type: Number, default: 20 },
      GK: { type: Number, default: 20 },
      ICT: { type: Number, default: 10 },
    },
    status: { type: String, enum: COURSE_STATUSES, default: "DRAFT" },
  },
  withCreated,
);
courseSchema.index({ status: 1 });

const routineDaySchema = new Schema(
  {
    courseId: { type: ObjectId, ref: "Course", required: true },
    dayNo: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true }, // start of the Dhaka day, as a UTC instant
    type: { type: String, enum: ROUTINE_TYPES, default: "TOPIC" },
    topics: { bangla: String, english: String, math: String, gk: String, ict: String },
    vocabFrom: Number,
    vocabTo: Number,
  },
  plain,
);
routineDaySchema.index({ courseId: 1, dayNo: 1 }, { unique: true });
routineDaySchema.index({ courseId: 1, date: 1 });

export type Category = InferSchemaType<typeof categorySchema>;
export type Course = InferSchemaType<typeof courseSchema>;
export type RoutineDay = InferSchemaType<typeof routineDaySchema>;
export const CategoryModel = getModel("Category", categorySchema);
export const CourseModel = getModel("Course", courseSchema);
export const RoutineDayModel = getModel("RoutineDay", routineDaySchema);
