import { addDays } from "../utils/time";

export type Choice = "A" | "B" | "C" | "D";
export type GradeQuestion = { id: string; answer: Choice; subject: string };
export type GivenAnswer = { questionId: string; choice: Choice };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** +1 correct, minus `negativeMarking` wrong, 0 skipped. Only questions of the exam count. */
export function grade(questions: GradeQuestion[], answers: GivenAnswer[], negativeMarking: number) {
  const given = new Map(answers.map((a) => [a.questionId, a.choice]));
  const bySubject: Record<string, { correct: number; wrong: number; score: number }> = {};
  let correct = 0, wrong = 0, skipped = 0;
  for (const q of questions) {
    const s = (bySubject[q.subject] ??= { correct: 0, wrong: 0, score: 0 });
    const choice = given.get(q.id);
    if (!choice) skipped++;
    else if (choice === q.answer) { correct++; s.correct++; s.score += 1; }
    else { wrong++; s.wrong++; s.score -= negativeMarking; }
  }
  for (const s of Object.values(bySubject)) s.score = round2(s.score);
  return { correct, wrong, skipped, score: round2(correct - wrong * negativeMarking), bySubject };
}

export type Ranked = { id: string; score: number; submittedAt: Date };

/** Score descending, ties broken by earlier submit time. */
export function rank(attempts: Ranked[], passMark: number) {
  const sorted = [...attempts].sort((a, b) => b.score - a.score || a.submittedAt.getTime() - b.submittedAt.getTime());
  return {
    ranks: sorted.map((a, i) => ({ id: a.id, rank: i + 1 })),
    participants: sorted.length,
    passed: sorted.filter((a) => a.score >= passMark).length,
    cutMark: passMark,
  };
}

/** Live window of an exam on a Dhaka day. `dayStart` is the Dhaka day start as a UTC instant. */
export function examWindow(dayStart: Date, open = "00:00", close = "23:59") {
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return new Date(dayStart.getTime() + (h * 60 + m) * 60_000);
  };
  // The close minute is included: 23:59 means until 23:59:59.
  return { opensAt: at(open), closesAt: new Date(at(close).getTime() + 60_000) };
}

export function statusAt(now: Date, w: { opensAt: Date; closesAt: Date }): "SCHEDULED" | "LIVE" | "CLOSED" {
  return now < w.opensAt ? "SCHEDULED" : now < w.closesAt ? "LIVE" : "CLOSED";
}

/** The server decides the time: 60 minutes from start, but never past the window end. */
export function secondsLeft(startedAt: Date, now: Date, windowEnd: Date, minutes = 60) {
  const end = Math.min(startedAt.getTime() + minutes * 60_000, windowEnd.getTime());
  return Math.max(0, Math.floor((end - now.getTime()) / 1000));
}

/** Day 1 (freeDays) is open to any logged-in student; later days need an enrollment. */
export const canStartExam = (dayNo: number, freeDays: number, enrolled: boolean) => dayNo <= freeDays || enrolled;

/** Answer, explanation and shortcut stay hidden while the exam is live, or without access. */
export const canSeeAnswers = (status: string, hasAccess: boolean) => hasAccess && status !== "LIVE" && status !== "SCHEDULED";

export const dayDate = (courseStart: Date, dayNo: number) => addDays(courseStart, dayNo - 1);

export const ACCESS_DAYS = 90; // a purchase unlocks the course for three months
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Days since the course start (Dhaka days). Negative before the start. */
const dayIndex = (courseStart: Date, now: Date) => Math.floor((now.getTime() - courseStart.getTime()) / DAY_MS);

/** The course repeats every `durationDays`: round 1 starts on the start date, then round 2, and so on. */
export function currentRound(courseStart: Date, durationDays: number, now: Date = new Date()): number {
  const i = dayIndex(courseStart, now);
  return i < 0 ? 1 : Math.floor(i / durationDays) + 1;
}

/** Which routine day is "today" inside the current round (1 to durationDays). */
export function dayOfRound(courseStart: Date, durationDays: number, now: Date = new Date()): number {
  const i = dayIndex(courseStart, now);
  return i < 0 ? 1 : (i % durationDays) + 1;
}
