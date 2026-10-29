import { Schema, type InferSchemaType } from "mongoose";
import { MATERIAL_TYPES, ObjectId, getModel, plain, withCreated } from "./shared";

const materialSchema = new Schema(
  {
    courseId: { type: ObjectId, ref: "Course", required: true },
    dayNo: Number,
    type: { type: String, enum: MATERIAL_TYPES, required: true },
    title: { type: String, required: true },
    fileKey: { type: String, required: true }, // storage object key, served through short-lived signed URLs
    pages: Number,
    isFree: { type: Boolean, default: false },
    visibleFrom: Date, // absent means visible immediately
  },
  withCreated,
);
materialSchema.index({ courseId: 1, dayNo: 1 });

// One document per vocabulary page (5 words), so a page is a single read.
const vocabWordSchema = new Schema(
  {
    word: { type: String, required: true, trim: true },
    banglaMeaning: { type: String, required: true },
    englishExplanation: { type: String, required: true },
  },
  { _id: false },
);
const vocabPageSchema = new Schema(
  {
    courseId: { type: ObjectId, ref: "Course", required: true },
    dayNo: { type: Number, required: true, min: 1 },
    pageNo: { type: Number, required: true, min: 1 },
    words: {
      type: [vocabWordSchema],
      default: [],
      validate: { validator: (v: unknown[]) => v.length <= 5, message: "A page holds at most 5 words" },
    },
  },
  plain,
);
vocabPageSchema.index({ courseId: 1, dayNo: 1, pageNo: 1 }, { unique: true });

// One document per student, course and day. `pages` is keyed by page number ("1" to "10"),
// so reading a page is one atomic upsert: { $inc: { "pages.5.readCount": 1 }, $set: { "pages.5.lastReadAt": now } }.
// "Learned today" is the number of keys in `pages`, times 5.
const vocabProgressSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    courseId: { type: ObjectId, ref: "Course", required: true },
    dayNo: { type: Number, required: true, min: 1 },
    pages: {
      type: Map,
      of: new Schema({ readCount: { type: Number, default: 0 }, lastReadAt: Date }, { _id: false }),
      default: {},
    },
  },
  plain,
);
vocabProgressSchema.index({ userId: 1, courseId: 1, dayNo: 1 }, { unique: true });

const noticeSchema = new Schema(
  {
    courseId: { type: ObjectId, ref: "Course" }, // absent means all students
    userId: { type: ObjectId, ref: "User" }, // set for a notice addressed to one student
    title: { type: String, required: true },
    body: { type: String, required: true },
    emailed: { type: Boolean, default: false },
  },
  withCreated,
);
noticeSchema.index({ courseId: 1, createdAt: -1 });
noticeSchema.index({ userId: 1, createdAt: -1 });

// Site name, support contact, bKash and Nagad numbers, auto open/close and auto publish toggles.
// The key is the _id, e.g. "bkash_number".
const settingSchema = new Schema(
  {
    _id: { type: String, required: true },
    value: { type: String, default: "" },
  },
  { versionKey: false, timestamps: { createdAt: false, updatedAt: true } },
);

export type Material = InferSchemaType<typeof materialSchema>;
export type VocabPage = InferSchemaType<typeof vocabPageSchema>;
export type VocabProgress = InferSchemaType<typeof vocabProgressSchema>;
export type Notice = InferSchemaType<typeof noticeSchema>;
export type Setting = InferSchemaType<typeof settingSchema>;
export const MaterialModel = getModel("Material", materialSchema);
export const VocabPageModel = getModel("VocabPage", vocabPageSchema);
export const VocabProgressModel = getModel("VocabProgress", vocabProgressSchema);
export const NoticeModel = getModel("Notice", noticeSchema);
export const SettingModel = getModel("Setting", settingSchema);
