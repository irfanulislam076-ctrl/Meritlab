import { AttemptModel, CourseModel, ExamModel, QuestionModel, RoutineDayModel } from "../models";
import { currentRound, examWindow, grade, rank, statusAt, DAY_MS, type Choice } from "../lib/exam";
import { addDays } from "../utils/time";
import { qExamId } from "./access";

const LABEL = { TOPIC: "Topic exam", FINAL: "Final exam", MODEL: "Model test", MIXED: "Daily exam" } as const;

type ExamLean = { _id: unknown; sourceExamId?: unknown; courseId: unknown; durationMin: number; closesAt: Date; opensAt: Date; status: string; manualOverride?: boolean | null };
type CourseLean = { negativeMarking: number; passMark: number };

export const roundFilter = (round: number) => (round === 1 ? { $or: [{ round: 1 }, { round: { $exists: false } }] } : { round });

/**
 * Exams for every routine day of every round up to tomorrow's round. The course is a rolling calendar:
 * it repeats every durationDays, so a new student starts at whatever day is live today, and when the
 * last day passes round 2 begins with the same questions on new dates.
 */
export async function ensureExams(courseId: unknown) {
  const course = await CourseModel.findById(courseId).lean();
  if (!course) return;
  await ExamModel.updateMany({ courseId, round: { $exists: false } }, { $set: { round: 1 } });
  const days = await RoutineDayModel.find({ courseId }).sort({ dayNo: 1 }).lean();
  if (!days.length) return;
  const lastRound = currentRound(course.startDate, course.durationDays, new Date(Date.now() + DAY_MS));
  const have = new Set((await ExamModel.find({ courseId }).select("routineDayId round").lean()).map((e) => `${e.routineDayId}-${e.round ?? 1}`));

  const build = (round: number, firstOf: Map<string, unknown>) =>
    days.filter((d) => !have.has(`${d._id}-${round}`)).map((d) => {
      const w = examWindow(addDays(d.date, (round - 1) * course.durationDays), course.examOpenTime, course.examCloseTime);
      return {
        courseId, routineDayId: d._id, round, dayNo: d.dayNo, type: d.type,
        title: `Day ${d.dayNo} · ${LABEL[d.type as keyof typeof LABEL]}${round > 1 ? ` · Round ${round}` : ""}`,
        opensAt: w.opensAt, closesAt: w.closesAt, ...(round > 1 ? { sourceExamId: firstOf.get(String(d._id)) } : {}),
      };
    });

  const first = build(1, new Map());
  if (first.length) await ExamModel.insertMany(first, { ordered: false }).catch(() => undefined);
  if (lastRound < 2) return;
  const firstOf = new Map((await ExamModel.find({ courseId, ...roundFilter(1) }).select("routineDayId").lean()).map((e) => [String(e.routineDayId), e._id]));
  for (let r = 2; r <= lastRound; r++) {
    const docs = build(r, firstOf);
    if (docs.length) await ExamModel.insertMany(docs, { ordered: false }).catch(() => undefined);
  }
}

/** Creates missing exams and moves every exam whose time has come (live, closed, result published). */
export async function refreshCourse(courseId: unknown) {
  await ensureExams(courseId);
  const due = await ExamModel.find({ courseId, status: { $ne: "RESULT_PUBLISHED" }, opensAt: { $lte: new Date() } }).select("_id").lean();
  for (const e of due) await advanceExam(e._id);
}

/** Grades one attempt on the server. Safe to call twice: only an unsubmitted attempt is written. */
export async function submitAttempt(attemptId: unknown, exam: ExamLean, course: CourseLean) {
  const attempt = await AttemptModel.findOne({ _id: attemptId, submittedAt: null }).lean();
  if (!attempt) return null;
  const questions = await QuestionModel.find({ examId: qExamId(exam) }).select("+answer").lean();
  const result = grade(
    questions.map((q) => ({ id: String(q._id), answer: q.answer as Choice, subject: q.subject })),
    attempt.answers.filter((a) => a.chosen).map((a) => ({ questionId: String(a.questionId), choice: a.chosen as Choice })),
    course.negativeMarking,
  );
  const at = attempt.isLive
    ? Math.min(Date.now(), exam.closesAt.getTime(), attempt.startedAt.getTime() + exam.durationMin * 60_000)
    : Date.now();
  await AttemptModel.updateOne(
    { _id: attempt._id, submittedAt: null },
    { $set: { submittedAt: new Date(at), score: result.score, correct: result.correct, wrong: result.wrong, skipped: result.skipped } },
  );
  return result;
}

async function closeAttempts(exam: ExamLean, course: CourseLean) {
  const open = await AttemptModel.find({ examId: exam._id, isLive: true, submittedAt: null }).select("_id").lean();
  for (const a of open) await submitAttempt(a._id, exam, course);
}

/** Ranks every submitted live attempt and publishes the result. Practice attempts never count. */
export async function publishResult(exam: ExamLean, course: CourseLean & { passMark: number }) {
  const attempts = await AttemptModel.find({ examId: exam._id, isLive: true, submittedAt: { $ne: null } }).select("score submittedAt").lean();
  const r = rank(attempts.map((a) => ({ id: String(a._id), score: a.score ?? 0, submittedAt: a.submittedAt as Date })), course.passMark);
  if (r.ranks.length) {
    await AttemptModel.bulkWrite(r.ranks.map((x) => ({ updateOne: { filter: { _id: x.id }, update: { $set: { rank: x.rank } } } })));
  }
  await ExamModel.updateOne({ _id: exam._id }, { $set: { status: "RESULT_PUBLISHED", participants: r.participants, passedCount: r.passed, cutMark: r.cutMark, publishedAt: new Date() } });
}

export async function closeExam(examId: unknown) {
  const exam = await ExamModel.findById(examId).lean();
  const course = exam && (await CourseModel.findById(exam.courseId).lean());
  if (!exam || !course) return;
  await closeAttempts(exam, course);
  await ExamModel.updateOne({ _id: exam._id }, { $set: { status: "CLOSED" } });
}

/** SCHEDULED -> LIVE -> CLOSED -> RESULT_PUBLISHED by the clock, unless an admin took over by hand. */
export async function advanceExam(examId: unknown) {
  const exam = await ExamModel.findById(examId).lean();
  if (!exam) return null;
  if (!exam.manualOverride && exam.status !== "RESULT_PUBLISHED") {
    const course = await CourseModel.findById(exam.courseId).lean();
    const s = statusAt(new Date(), { opensAt: exam.opensAt, closesAt: exam.closesAt });
    if (course && s === "LIVE" && exam.status === "SCHEDULED") await ExamModel.updateOne({ _id: exam._id }, { $set: { status: "LIVE" } });
    if (course && s === "CLOSED") {
      await closeAttempts(exam, course);
      await publishResult(exam, course);
    }
    return ExamModel.findById(examId).lean();
  }
  return exam;
}

/** Called by cron every minute and also lazily on reads. */
export async function tickAll() {
  const courses = await CourseModel.find({ status: "LIVE" }).select("_id").lean();
  for (const c of courses) await refreshCourse(c._id);
  return courses.length;
}
