import { Router, type Request } from "express";
import { z } from "zod";
import { AttemptModel, CourseModel, ExamModel, PaymentModel, QuestionModel, QuestionStateModel, RoutineDayModel, UserModel, EnrollmentModel } from "../models";
import { requireAuth } from "../middleware/auth";
import { body } from "../middleware/validate";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { canSeeAnswers, canStartExam, currentRound, dayOfRound, grade, secondsLeft, type Choice } from "../lib/exam";
import { activeFilter, hasActiveEnrollment, qExamId } from "../services/access";
import { advanceExam, refreshCourse, roundFilter, submitAttempt } from "../services/examService";

export const examRouter = Router();
const oid = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

async function load(req: Request) {
  const exam = await advanceExam(oid.parse(req.params.id));
  if (!exam) throw new ApiError(404, "Exam not found");
  const course = await CourseModel.findById(exam.courseId).lean();
  if (!course) throw new ApiError(404, "Course not found");
  const enrolled = await hasActiveEnrollment(req.user!.id, course._id);
  return { exam, course, enrolled, access: canStartExam(exam.dayNo, course.freeDays, enrolled) };
}

const windowEnd = (exam: { closesAt: Date; durationMin: number }, a: { isLive: boolean; startedAt: Date }) =>
  a.isLive ? exam.closesAt : new Date(a.startedAt.getTime() + exam.durationMin * 60_000);

/* ---------- live exams across courses (the Exams tab) ---------- */
examRouter.get("/exams/live", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const courses = await CourseModel.find({ status: "LIVE" }).lean();
  const live: unknown[] = [];
  const upcoming: unknown[] = [];
  let done = 0;
  for (const c of courses) {
    await refreshCourse(c._id);
    const enrolled = await hasActiveEnrollment(userId, c._id);
    const exams = await ExamModel.find({ courseId: c._id, status: "LIVE" }).sort({ dayNo: 1 }).lean();
    const mine = await AttemptModel.find({ userId, isLive: true, examId: { $in: exams.map((e) => e._id) } }).select("examId submittedAt").lean();
    const byExam = new Map(mine.map((a) => [String(a.examId), a]));
    for (const e of exams) {
      const a = byExam.get(String(e._id));
      if (a?.submittedAt) { done++; continue; } // taken: it leaves the live list
      live.push({ id: String(e._id), title: e.title, dayNo: e.dayNo, closesAt: e.closesAt, inProgress: !!a, access: canStartExam(e.dayNo, c.freeDays, enrolled), course: { title: c.title, slug: c.slug } });
    }
    const next = await ExamModel.findOne({ courseId: c._id, status: "SCHEDULED" }).sort({ opensAt: 1 }).lean();
    if (next) upcoming.push({ id: String(next._id), title: next.title, dayNo: next.dayNo, opensAt: next.opensAt, course: { title: c.title, slug: c.slug } });
  }
  res.json({ success: true, data: { live, upcoming, done } });
}));

/* ---------- a course: today's round and day list ---------- */
examRouter.get("/courses/:slug/days", requireAuth, asyncHandler(async (req, res) => {
  const course = await CourseModel.findOne({ slug: String(req.params.slug).toLowerCase(), status: "LIVE" }).lean();
  if (!course) throw new ApiError(404, "Course not found");
  const userId = req.user!.id;
  await refreshCourse(course._id);
  const round = currentRound(course.startDate, course.durationDays);
  const [enrollment, pending, days, exams, mine] = await Promise.all([
    EnrollmentModel.findOne(activeFilter(userId, course._id)).lean(),
    PaymentModel.exists({ userId, courseId: course._id, status: "PENDING" }),
    RoutineDayModel.find({ courseId: course._id }).sort({ dayNo: 1 }).lean(),
    ExamModel.find({ courseId: course._id, ...roundFilter(round) }).lean(),
    AttemptModel.find({ userId, isLive: true }).select("examId submittedAt").lean(),
  ]);
  const enrolled = !!enrollment;
  const byDay = new Map(exams.map((e) => [e.dayNo, e]));
  const taken = new Map(mine.map((a) => [String(a.examId), !!a.submittedAt]));
  res.json({ success: true, data: {
    course: { title: course.title, durationDays: course.durationDays, slug: course.slug },
    round, todayDayNo: dayOfRound(course.startDate, course.durationDays), enrolled, expiresAt: enrollment?.expiresAt ?? null, pending: !!pending,
    days: days.map((d) => {
      const e = byDay.get(d.dayNo);
      return {
        dayNo: d.dayNo, type: d.type, topics: d.topics, examId: e ? String(e._id) : null, date: e?.opensAt ?? d.date,
        opensAt: e?.opensAt, closesAt: e?.closesAt, totalMarks: e?.totalMarks, durationMin: e?.durationMin,
        status: e?.status ?? "SCHEDULED", joined: e ? taken.has(String(e._id)) : false, submitted: e ? taken.get(String(e._id)) === true : false,
        locked: !canStartExam(d.dayNo, course.freeDays, enrolled),
      };
    }),
  } });
}));

examRouter.get("/courses/:slug/archive", requireAuth, asyncHandler(async (req, res) => {
  const course = await CourseModel.findOne({ slug: String(req.params.slug).toLowerCase() }).lean();
  if (!course) throw new ApiError(404, "Course not found");
  await refreshCourse(course._id);
  const enrolled = await hasActiveEnrollment(req.user!.id, course._id);
  const exams = await ExamModel.find({ courseId: course._id, status: { $in: ["CLOSED", "RESULT_PUBLISHED"] } }).sort({ opensAt: -1 }).lean();
  const mine = await AttemptModel.find({ userId: req.user!.id, isLive: true, examId: { $in: exams.map((e) => e._id) } }).select("examId score rank").lean();
  const byExam = new Map(mine.map((a) => [String(a.examId), a]));
  res.json({ success: true, data: { enrolled, exams: exams.map((e) => ({
    id: String(e._id), title: e.title, dayNo: e.dayNo, date: e.opensAt, status: e.status, totalMarks: e.totalMarks, durationMin: e.durationMin,
    joined: byExam.has(String(e._id)), score: byExam.get(String(e._id))?.score, rank: byExam.get(String(e._id))?.rank, locked: !canStartExam(e.dayNo, course.freeDays, enrolled),
  })) } });
}));

examRouter.get("/courses/:slug/results", requireAuth, asyncHandler(async (req, res) => {
  const course = await CourseModel.findOne({ slug: String(req.params.slug).toLowerCase() }).lean();
  if (!course) throw new ApiError(404, "Course not found");
  const exams = await ExamModel.find({ courseId: course._id, status: "RESULT_PUBLISHED" }).sort({ opensAt: -1 }).lean();
  const mine = await AttemptModel.find({ userId: req.user!.id, isLive: true, submittedAt: { $ne: null }, examId: { $in: exams.map((e) => e._id) } }).select("examId score rank").lean();
  const by = new Map(mine.map((a) => [String(a.examId), a]));
  res.json({ success: true, data: { results: exams.filter((e) => by.has(String(e._id))).map((e) => ({ id: String(e._id), title: e.title, date: e.opensAt, totalMarks: e.totalMarks, participants: e.participants, score: by.get(String(e._id))!.score, rank: by.get(String(e._id))!.rank })) } });
}));

/* ---------- exam meta ---------- */
examRouter.get("/exams/:id", requireAuth, asyncHandler(async (req, res) => {
  const { exam, course, access } = await load(req);
  const live = await AttemptModel.findOne({ examId: exam._id, userId: req.user!.id, isLive: true }).select("submittedAt").lean();
  const day = await RoutineDayModel.findById(exam.routineDayId).select("topics").lean();
  res.json({ success: true, data: { exam: {
    id: String(exam._id), courseSlug: course.slug, title: exam.title, dayNo: exam.dayNo, status: exam.status, opensAt: exam.opensAt, closesAt: exam.closesAt,
    totalMarks: exam.totalMarks, durationMin: exam.durationMin, topics: day?.topics, access, joined: !!live, submitted: !!live?.submittedAt,
  } } });
}));

/* ---------- take the exam ---------- */
examRouter.post("/exams/:id/start", requireAuth, asyncHandler(async (req, res) => {
  const { exam, course, access } = await load(req);
  if (!access) throw new ApiError(403, "Buy the course to start this exam");
  const userId = req.user!.id;
  const live = exam.status === "LIVE";
  if (!live && exam.status === "SCHEDULED") throw new ApiError(409, "This exam has not started yet");

  if (live && (await AttemptModel.exists({ examId: exam._id, userId, isLive: true, submittedAt: { $ne: null } }))) {
    throw new ApiError(409, "You have already submitted this exam");
  }
  let attempt = await AttemptModel.findOne({ examId: exam._id, userId, isLive: live, submittedAt: null }).sort({ startedAt: -1 }).lean();
  if (attempt && secondsLeft(attempt.startedAt, new Date(), windowEnd(exam, attempt)) <= 0) {
    await submitAttempt(attempt._id, exam, course);
    if (live) throw new ApiError(409, "Your time is over and the exam was submitted");
    attempt = null;
  }
  if (!attempt) {
    try {
      attempt = (await AttemptModel.create({ userId, examId: exam._id, isLive: live })).toObject();
    } catch {
      attempt = await AttemptModel.findOne({ examId: exam._id, userId, isLive: live, submittedAt: null }).lean(); // double tap: the unique index kept one
      if (!attempt) throw new ApiError(409, "Could not start the exam, try again");
    }
  }
  const questions = await QuestionModel.find({ examId: qExamId(exam) }).sort({ no: 1 }).lean(); // answer/explanation/shortcut are select:false
  res.json({ success: true, data: {
    practice: !live, secondsLeft: secondsLeft(attempt.startedAt, new Date(), windowEnd(exam, attempt)),
    questions: questions.map((q) => ({ id: String(q._id), no: q.no, subject: q.subject, text: q.text, options: q.options })),
    locked: Object.fromEntries(attempt.answers.map((a) => [String(a.questionId), a.chosen])),
  } });
}));

examRouter.post("/exams/:id/answer", requireAuth, asyncHandler(async (req, res) => {
  const { exam, course } = await load(req);
  const input = body(z.object({ questionId: oid, choice: z.enum(["A", "B", "C", "D"]) }), req);
  const attempt = await AttemptModel.findOne({ examId: exam._id, userId: req.user!.id, submittedAt: null }).sort({ startedAt: -1 }).lean();
  if (!attempt) throw new ApiError(409, "No exam in progress");
  if (secondsLeft(attempt.startedAt, new Date(), windowEnd(exam, attempt)) <= 0) {
    await submitAttempt(attempt._id, exam, course);
    throw new ApiError(409, "Time is over");
  }
  if (!(await QuestionModel.exists({ _id: input.questionId, examId: qExamId(exam) }))) throw new ApiError(404, "Question not found");
  // The first tap wins: the filter refuses a second answer for the same question.
  const r = await AttemptModel.updateOne(
    { _id: attempt._id, submittedAt: null, "answers.questionId": { $ne: input.questionId } },
    { $push: { answers: { questionId: input.questionId, chosen: input.choice, lockedAt: new Date() } } },
  );
  res.json({ success: true, data: { locked: true, alreadyLocked: r.modifiedCount === 0 } });
}));

examRouter.post("/exams/:id/submit", requireAuth, asyncHandler(async (req, res) => {
  const { exam, course } = await load(req);
  const attempt = await AttemptModel.findOne({ examId: exam._id, userId: req.user!.id, submittedAt: null }).sort({ startedAt: -1 }).lean();
  if (!attempt) throw new ApiError(409, "No exam in progress");
  await submitAttempt(attempt._id, exam, course);
  res.json({ success: true, message: "Submitted", data: { practice: !attempt.isLive } });
}));

/* ---------- result, answer sheet, merit list ---------- */
examRouter.get("/exams/:id/result", requireAuth, asyncHandler(async (req, res) => {
  const { exam, course, access } = await load(req);
  const practice = req.query.practice === "1";
  const userId = req.user!.id;
  const attempt = await AttemptModel.findOne({ examId: exam._id, userId, isLive: !practice, submittedAt: { $ne: null } }).sort({ submittedAt: -1 }).lean();
  if (!attempt) return res.json({ success: true, data: { state: "NONE" } });
  const published = exam.status === "RESULT_PUBLISHED";
  // Before publish a live attempt only shows "submitted". Practice shows at once (never ranked).
  if (!practice && !published) return res.json({ success: true, data: { state: "SUBMITTED" } });
  if (!canSeeAnswers(practice ? "CLOSED" : exam.status, access)) throw new ApiError(403, "Buy the course to see this");

  const qid = qExamId(exam);
  const questions = await QuestionModel.find({ examId: qid }).sort({ no: 1 }).select("+answer +explanation +shortcut").lean();
  const chosen = new Map(attempt.answers.map((a) => [String(a.questionId), a.chosen as Choice | null]));
  const favs = new Set((await QuestionStateModel.find({ userId, examId: qid, favorite: true }).select("questionId").lean()).map((f) => String(f.questionId)));
  const g = grade(questions.map((q) => ({ id: String(q._id), answer: q.answer as Choice, subject: q.subject })), [...chosen].filter(([, c]) => c).map(([questionId, c]) => ({ questionId, choice: c as Choice })), course.negativeMarking);
  res.json({ success: true, data: {
    state: "PUBLISHED", practice, courseTitle: course.title, examTitle: exam.title, date: exam.opensAt, score: attempt.score, correct: g.correct, wrong: g.wrong, skipped: g.skipped, totalMarks: exam.totalMarks,
    rank: practice ? null : attempt.rank, participants: exam.participants, passed: exam.passedCount, cutMark: exam.cutMark, bySubject: g.bySubject,
    questions: questions.map((q) => ({
      id: String(q._id), no: q.no, subject: q.subject, text: q.text, options: q.options, answer: q.answer, chosen: chosen.get(String(q._id)) ?? null,
      explanation: q.explanation, shortcut: q.shortcut, favorite: favs.has(String(q._id)),
    })),
  } });
}));

// Questions with answers and explanations of a closed exam, for anyone with access (archive view, no attempt needed).
examRouter.get("/exams/:id/sheet", requireAuth, asyncHandler(async (req, res) => {
  const { exam, access } = await load(req);
  if (exam.status !== "RESULT_PUBLISHED" && exam.status !== "CLOSED") throw new ApiError(409, "Available after the exam closes");
  if (!access) throw new ApiError(403, "Buy the course to see this");
  const questions = await QuestionModel.find({ examId: qExamId(exam) }).sort({ no: 1 }).select("+answer +explanation +shortcut").lean();
  res.json({ success: true, data: { title: exam.title, questions: questions.map((q) => ({ id: String(q._id), no: q.no, subject: q.subject, text: q.text, options: q.options, answer: q.answer, explanation: q.explanation, shortcut: q.shortcut })) } });
}));

examRouter.get("/exams/:id/merit", requireAuth, asyncHandler(async (req, res) => {
  const { exam } = await load(req);
  if (exam.status !== "RESULT_PUBLISHED") throw new ApiError(409, "The result is not published yet");
  const search = z.string().trim().max(60).optional().parse(req.query.search);
  const filter: Record<string, unknown> = { examId: exam._id, isLive: true, rank: { $ne: null } };
  if (search) {
    const users = await UserModel.find({ name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }).select("_id").limit(200).lean();
    filter.userId = { $in: users.map((u) => u._id) };
  }
  const rows = await AttemptModel.find(filter).sort({ rank: 1 }).limit(100).populate("userId", "name").lean();
  const me = await AttemptModel.findOne({ examId: exam._id, userId: req.user!.id, isLive: true }).select("rank score").lean();
  res.json({ success: true, data: {
    rows: rows.map((r) => ({ rank: r.rank, name: (r.userId as unknown as { name: string })?.name ?? "Student", score: r.score, me: String((r.userId as unknown as { _id: unknown })?._id) === req.user!.id })),
    me: me ? { rank: me.rank, score: me.score } : null, participants: exam.participants,
  } });
}));

examRouter.post("/questions/:id/favorite", requireAuth, asyncHandler(async (req, res) => {
  const { favorite } = body(z.object({ favorite: z.boolean() }), req);
  const q = await QuestionModel.findById(oid.parse(req.params.id)).lean();
  const exam = q && (await ExamModel.findById(q.examId).lean());
  if (!q || !exam) throw new ApiError(404, "Question not found");
  const enrolled = await hasActiveEnrollment(req.user!.id, exam.courseId);
  if (!(enrolled || exam.dayNo <= 1)) throw new ApiError(403, "Not allowed");
  await QuestionStateModel.updateOne({ userId: req.user!.id, questionId: q._id }, { $set: { favorite, courseId: exam.courseId, examId: exam._id } }, { upsert: true });
  res.json({ success: true });
}));
