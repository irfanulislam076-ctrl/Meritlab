import { Router } from "express";
import { z } from "zod";
import { CourseModel, ExamModel, QuestionModel } from "../models";
import { requireRole } from "../middleware/auth";
import { body } from "../middleware/validate";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { currentRound } from "../lib/exam";
import { qExamId } from "../services/access";
import { advanceExam, closeExam, publishResult, refreshCourse, roundFilter } from "../services/examService";

export const adminExamRouter = Router();
const CONTENT = ["SUPER_ADMIN", "EXAM_MANAGER"] as const;
const oid = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

// Exams of the round that is running now. Questions belong to the first round's exam (questionExamId).
adminExamRouter.get("/exams", requireRole(...CONTENT), asyncHandler(async (req, res) => {
  const courseId = oid.parse(req.query.courseId);
  await refreshCourse(courseId);
  const course = await CourseModel.findById(courseId).lean();
  if (!course) throw new ApiError(404, "Course not found");
  const exams = await ExamModel.find({ courseId, ...roundFilter(currentRound(course.startDate, course.durationDays)) }).sort({ dayNo: 1 }).lean();
  const ids = exams.map((e) => qExamId(e));
  const counts = await QuestionModel.aggregate([{ $match: { examId: { $in: ids } } }, { $group: { _id: "$examId", n: { $sum: 1 } } }]);
  const n = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ success: true, data: { exams: exams.map((e) => ({ ...e, questionExamId: String(qExamId(e)), questionCount: n.get(String(qExamId(e))) ?? 0 })) } });
}));

// Manual overrides. After any of these the clock no longer moves this exam by itself.
adminExamRouter.post("/exams/:id/:action(open|close|publish|unpublish|auto)", requireRole(...CONTENT), asyncHandler(async (req, res) => {
  const id = oid.parse(req.params.id);
  const exam = await ExamModel.findById(id).lean();
  const course = exam && (await CourseModel.findById(exam.courseId).lean());
  if (!exam || !course) throw new ApiError(404, "Exam not found");
  switch (req.params.action) {
    case "open": await ExamModel.updateOne({ _id: id }, { $set: { status: "LIVE", manualOverride: true } }); break;
    case "close": await ExamModel.updateOne({ _id: id }, { $set: { manualOverride: true } }); await closeExam(id); break;
    case "publish": await ExamModel.updateOne({ _id: id }, { $set: { manualOverride: true } }); await closeExam(id); await publishResult(exam, course); break;
    case "unpublish": await ExamModel.updateOne({ _id: id }, { $set: { status: "CLOSED", manualOverride: true }, $unset: { publishedAt: 1 } }); break;
    case "auto": await ExamModel.updateOne({ _id: id }, { $set: { manualOverride: false } }); await advanceExam(id); break;
  }
  res.json({ success: true, message: "Done" });
}));

/* ---------- question bank ---------- */
adminExamRouter.get("/exams/:id/questions", requireRole(...CONTENT), asyncHandler(async (req, res) => {
  const questions = await QuestionModel.find({ examId: oid.parse(req.params.id) }).sort({ no: 1 }).select("+answer +explanation +shortcut").lean();
  res.json({ success: true, data: { questions } });
}));

const questionSchema = z.object({
  no: z.number().int().min(1).max(200),
  subject: z.enum(["BANGLA", "ENGLISH", "MATH", "GK", "ICT"]),
  topic: z.string().max(80).optional(),
  qType: z.enum(["PYQ_STYLE", "STANDARD", "PREDICTED"]).optional(),
  text: z.string().min(2).max(1000),
  options: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1), D: z.string().min(1) }),
  answer: z.enum(["A", "B", "C", "D"]),
  explanation: z.string().max(4000).optional(),
  shortcut: z.string().max(1000).optional(),
});

// Body: { questions: [...] }. Same question number replaces the old one.
adminExamRouter.post("/exams/:id/questions", requireRole(...CONTENT), asyncHandler(async (req, res) => {
  const examId = oid.parse(req.params.id);
  if (!(await ExamModel.exists({ _id: examId }))) throw new ApiError(404, "Exam not found");
  const { questions } = body(z.object({ questions: z.array(questionSchema).min(1).max(200) }), req);
  await QuestionModel.bulkWrite(questions.map((q) => ({ updateOne: { filter: { examId, no: q.no }, update: { $set: { ...q, examId } }, upsert: true } })));
  res.json({ success: true, message: `${questions.length} questions saved` });
}));
