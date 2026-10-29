import { Schema, type InferSchemaType } from "mongoose";
import {
  CHOICES,
  EXAM_STATUSES,
  Q_TYPES,
  ROUTINE_TYPES,
  SUBJECTS,
  ObjectId,
  getModel,
  plain,
  withCreated,
} from "./shared";

const examSchema = new Schema(
  {
    courseId: { type: ObjectId, ref: "Course", required: true },
    routineDayId: { type: ObjectId, ref: "RoutineDay", required: true },
    round: { type: Number, default: 1 }, // the course repeats every durationDays; each repeat is a new round
    sourceExamId: { type: ObjectId, ref: "Exam" }, // rounds after the first reuse the first round's questions
    dayNo: { type: Number, required: true }, // copied from the routine so lists need no lookup
    type: { type: String, enum: ROUTINE_TYPES, default: "TOPIC" },
    title: { type: String, required: true },
    totalMarks: { type: Number, default: 100 },
    durationMin: { type: Number, default: 60 },
    opensAt: { type: Date, required: true },
    closesAt: { type: Date, required: true },
    status: { type: String, enum: EXAM_STATUSES, default: "SCHEDULED" },
    manualOverride: { type: Boolean, default: false },
    // Filled when the result is published.
    participants: Number,
    passedCount: Number,
    cutMark: Number,
    publishedAt: Date,
  },
  plain,
);
examSchema.index({ routineDayId: 1, round: 1 }, { unique: true });
examSchema.index({ courseId: 1, opensAt: 1 });
examSchema.index({ status: 1, opensAt: 1 });
examSchema.index({ status: 1, closesAt: 1 });

const questionSchema = new Schema(
  {
    examId: { type: ObjectId, ref: "Exam", required: true },
    no: { type: Number, required: true, min: 1 },
    subject: { type: String, enum: SUBJECTS, required: true },
    subSection: String,
    topic: String,
    qType: { type: String, enum: Q_TYPES, default: "STANDARD" },
    difficulty: String,
    text: { type: String, required: true },
    options: {
      A: { type: String, required: true },
      B: { type: String, required: true },
      C: { type: String, required: true },
      D: { type: String, required: true },
    },
    // Hidden by default, so a plain query can never leak them during a live exam.
    // Grading and answer sheets opt in with .select("+answer +explanation +shortcut").
    answer: { type: String, enum: CHOICES, required: true, select: false },
    explanation: { type: String, select: false },
    shortcut: { type: String, select: false },
    needsReview: { type: Boolean, default: false },
    reviewNote: String,
  },
  plain,
);
questionSchema.index({ examId: 1, no: 1 }, { unique: true });
questionSchema.index({ examId: 1, subject: 1 });

const attemptAnswerSchema = new Schema(
  {
    questionId: { type: ObjectId, ref: "Question", required: true },
    chosen: { type: String, enum: [...CHOICES, null], default: null }, // null means skipped
    isCorrect: { type: Boolean, default: null },
    lockedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const attemptSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    examId: { type: ObjectId, ref: "Exam", required: true },
    startedAt: { type: Date, default: Date.now },
    submittedAt: Date,
    isLive: { type: Boolean, default: true }, // false means practice mode, never ranked
    score: Number,
    correct: Number,
    wrong: Number,
    skipped: Number,
    rank: Number,
    // Embedded: at most 100 entries, pushed one at a time as the student locks each answer:
    // updateOne({ _id, "answers.questionId": { $ne: qid } }, { $push: { answers: {...} } })
    // makes the first tap win, atomically.
    answers: { type: [attemptAnswerSchema], default: [] },
  },
  plain,
);
// One live attempt per student per exam. Practice attempts are unlimited.
attemptSchema.index({ examId: 1, userId: 1 }, { unique: true, partialFilterExpression: { isLive: true } });
attemptSchema.index({ userId: 1, examId: 1, startedAt: -1 });
attemptSchema.index({ examId: 1, isLive: 1, score: -1, submittedAt: 1 }); // merit list order

// Favorite heart and "mark as read" flag, one document per student and question.
const questionStateSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    questionId: { type: ObjectId, ref: "Question", required: true },
    courseId: { type: ObjectId, ref: "Course", required: true }, // denormalized for course-level lists
    examId: { type: ObjectId, ref: "Exam", required: true },
    favorite: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
  },
  withCreated,
);
questionStateSchema.index({ userId: 1, questionId: 1 }, { unique: true });
questionStateSchema.index({ userId: 1, courseId: 1, favorite: 1 });

export type Exam = InferSchemaType<typeof examSchema>;
export type Question = InferSchemaType<typeof questionSchema>;
export type Attempt = InferSchemaType<typeof attemptSchema>;
export type QuestionState = InferSchemaType<typeof questionStateSchema>;
export const ExamModel = getModel("Exam", examSchema);
export const QuestionModel = getModel("Question", questionSchema);
export const AttemptModel = getModel("Attempt", attemptSchema);
export const QuestionStateModel = getModel("QuestionState", questionStateSchema);
