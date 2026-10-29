import { Router, type Request } from "express";
import { z } from "zod";
import { cloudinary } from "../config/cloudinary";
import { cloudinaryEnabled } from "../config/env";
import {
  AttemptModel, CourseModel, EnrollmentModel, ExamModel, MaterialModel, NoticeModel, QuestionModel, QuestionStateModel, VocabPageModel, VocabProgressModel,
} from "../models";
import { requireAuth } from "../middleware/auth";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { canStartExam, type Choice } from "../lib/exam";
import { activeFilter, hasActiveEnrollment, qExamId } from "../services/access";

export const contentRouter = Router();

async function courseCtx(req: Request) {
  const course = await CourseModel.findOne({ slug: String(req.params.slug).toLowerCase() }).lean();
  if (!course) throw new ApiError(404, "Course not found");
  const enrolled = await hasActiveEnrollment(req.user!.id, course._id);
  return { course, enrolled };
}
const dayParam = (v: unknown) => z.coerce.number().int().min(1).max(366).parse(v);
const pageParam = (v: unknown) => z.coerce.number().int().min(1).max(10).parse(v);

/* ---------- vocabulary: 50 words a day, 5 per page, 10 pages ---------- */
contentRouter.get("/courses/:slug/vocab/:day", requireAuth, asyncHandler(async (req, res) => {
  const { course, enrolled } = await courseCtx(req);
  const dayNo = dayParam(req.params.day);
  const p = await VocabProgressModel.findOne({ userId: req.user!.id, courseId: course._id, dayNo }).lean();
  const readPages = Object.keys((p?.pages as unknown as Record<string, unknown>) ?? {}).map(Number).sort((a, b) => a - b);
  res.json({ success: true, data: { dayNo, totalPages: 10, readPages, learned: readPages.length * 5, locked: !canStartExam(dayNo, course.freeDays, enrolled) } });
}));

contentRouter.get("/courses/:slug/vocab/:day/pages/:page", requireAuth, asyncHandler(async (req, res) => {
  const { course, enrolled } = await courseCtx(req);
  const dayNo = dayParam(req.params.day);
  if (!canStartExam(dayNo, course.freeDays, enrolled)) throw new ApiError(403, "Buy the course to unlock this day");
  const page = await VocabPageModel.findOne({ courseId: course._id, dayNo, pageNo: pageParam(req.params.page) }).lean();
  res.json({ success: true, data: { words: page?.words ?? [] } });
}));

// "Yes, next page": one atomic upsert per read. Revisiting only raises readCount.
contentRouter.post("/courses/:slug/vocab/:day/pages/:page/read", requireAuth, asyncHandler(async (req, res) => {
  const { course, enrolled } = await courseCtx(req);
  const dayNo = dayParam(req.params.day);
  const pageNo = pageParam(req.params.page);
  if (!canStartExam(dayNo, course.freeDays, enrolled)) throw new ApiError(403, "Buy the course to unlock this day");
  const p = await VocabProgressModel.findOneAndUpdate(
    { userId: req.user!.id, courseId: course._id, dayNo },
    { $inc: { [`pages.${pageNo}.readCount`]: 1 }, $set: { [`pages.${pageNo}.lastReadAt`]: new Date() } },
    { upsert: true, new: true },
  ).lean();
  const learned = Object.keys((p?.pages as unknown as Record<string, unknown>) ?? {}).length * 5;
  res.json({ success: true, data: { learned } });
}));

/* ---------- PDFs and solve sheets ---------- */
contentRouter.get("/courses/:slug/materials", requireAuth, asyncHandler(async (req, res) => {
  const { course, enrolled } = await courseCtx(req);
  const now = new Date();
  const items = await MaterialModel.find({ courseId: course._id, $or: [{ visibleFrom: { $exists: false } }, { visibleFrom: null }, { visibleFrom: { $lte: now } }] }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: { materials: items.map((m) => ({ id: String(m._id), title: m.title, type: m.type, dayNo: m.dayNo, pages: m.pages, isFree: m.isFree, locked: !m.isFree && !enrolled })) } });
}));

// A short-lived signed link, so a PDF URL cannot be shared for long.
contentRouter.get("/materials/:id/url", requireAuth, asyncHandler(async (req, res) => {
  const m = await MaterialModel.findById(z.string().regex(/^[a-f0-9]{24}$/i).parse(req.params.id)).lean();
  if (!m || (m.visibleFrom && m.visibleFrom > new Date())) throw new ApiError(404, "File not found");
  if (!m.isFree && !(await hasActiveEnrollment(req.user!.id, m.courseId))) throw new ApiError(403, "Buy the course to open this file");
  if (!cloudinaryEnabled) throw new ApiError(503, "File storage is not configured");
  const url = cloudinary.utils.private_download_url(m.fileKey, "", { resource_type: "raw", type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 300 });
  res.json({ success: true, data: { url, expiresInSeconds: 300 } });
}));

/* ---------- notices ---------- */
contentRouter.get("/notices", requireAuth, asyncHandler(async (req, res) => {
  const mine = (await EnrollmentModel.find(activeFilter(req.user!.id)).select("courseId").lean()).map((e) => e.courseId);
  const notices = await NoticeModel.find({
    $or: [
      { userId: req.user!.id },
      { userId: { $exists: false }, courseId: { $exists: false } },
      { userId: { $exists: false }, courseId: { $in: mine } },
    ],
  }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ success: true, data: { notices } });
}));

/* ---------- wrong / correct / unanswered / favorites across published exams ---------- */
contentRouter.get("/courses/:slug/review", requireAuth, asyncHandler(async (req, res) => {
  const { tab, subject } = z.object({
    tab: z.enum(["wrong", "correct", "unanswered", "favorite"]).default("wrong"),
    subject: z.enum(["BANGLA", "ENGLISH", "MATH", "GK", "ICT"]).optional(),
  }).parse(req.query);
  const { course, enrolled } = await courseCtx(req);
  const userId = req.user!.id;

  const exams = await ExamModel.find({ courseId: course._id, status: "RESULT_PUBLISHED" }).select("dayNo sourceExamId").lean();
  const allowed = exams.filter((e) => canStartExam(e.dayNo, course.freeDays, enrolled));
  const src = (e: { _id: unknown; sourceExamId?: unknown }) => String(qExamId(e)); // rounds share the first round's questions
  const dayOf = new Map(allowed.map((e) => [src(e), e.dayNo]));
  const srcOfExam = new Map(allowed.map((e) => [String(e._id), src(e)]));
  const examIds = [...new Set(allowed.map(src))];
  const attemptExamIds = allowed.map((e) => e._id);

  const qFilter: Record<string, unknown> = { examId: { $in: examIds } };
  if (subject) qFilter.subject = subject;
  const questions = await QuestionModel.find(qFilter).sort({ examId: 1, no: 1 }).select("+answer +explanation +shortcut").lean();
  const attempts = await AttemptModel.find({ userId, isLive: true, submittedAt: { $ne: null }, examId: { $in: attemptExamIds } }).select("examId answers").lean();
  const chosenBy = new Map<string, Choice>();
  const attempted = new Set(attempts.map((a) => srcOfExam.get(String(a.examId))));
  for (const a of attempts) for (const x of a.answers) if (x.chosen) chosenBy.set(String(x.questionId), x.chosen as Choice);
  const favs = new Set((await QuestionStateModel.find({ userId, favorite: true, examId: { $in: examIds } }).select("questionId").lean()).map((f) => String(f.questionId)));

  const rows = questions
    .filter((q) => (tab === "favorite" ? true : attempted.has(String(q.examId))))
    .map((q) => ({ q, chosen: chosenBy.get(String(q._id)) ?? null }))
    .filter(({ q, chosen }) =>
      tab === "wrong" ? chosen && chosen !== q.answer
      : tab === "correct" ? chosen === q.answer
      : tab === "unanswered" ? !chosen
      : favs.has(String(q._id)))
    .slice(0, 200)
    .map(({ q, chosen }) => ({
      id: String(q._id), dayNo: dayOf.get(String(q.examId)), subject: q.subject, text: q.text, options: q.options,
      answer: q.answer, chosen, explanation: q.explanation, shortcut: q.shortcut, favorite: favs.has(String(q._id)),
    }));
  res.json({ success: true, data: { total: rows.length, questions: rows } });
}));
