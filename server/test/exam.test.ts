import assert from "node:assert/strict";
import { test } from "node:test";
import { currentRound, dayOfRound, ACCESS_DAYS, canSeeAnswers, canStartExam, examWindow, grade, rank, secondsLeft, statusAt } from "../src/lib/exam";
import { dhakaStartOfDay, parseDhakaDate } from "../src/utils/time";
import { checkOtp, hashWith, OTP_MAX_ATTEMPTS } from "../src/lib/otpCore";
import { normalizeMobile } from "../src/utils/mobile";

const qs = [
  { id: "1", answer: "A" as const, subject: "MATH" },
  { id: "2", answer: "B" as const, subject: "MATH" },
  { id: "3", answer: "C" as const, subject: "GK" },
  { id: "4", answer: "D" as const, subject: "GK" },
];

test("grading: +1 right, -0.25 wrong, 0 skipped", () => {
  const r = grade(qs, [{ questionId: "1", choice: "A" }, { questionId: "2", choice: "A" }, { questionId: "3", choice: "C" }], 0.25);
  assert.deepEqual([r.correct, r.wrong, r.skipped, r.score], [2, 1, 1, 1.75]);
  assert.equal(r.bySubject.MATH.score, 0.75);
});

test("grading: all skipped is zero, wrong answers can go negative", () => {
  assert.equal(grade(qs, [], 0.25).score, 0);
  assert.equal(grade(qs, qs.map((q) => ({ questionId: q.id, choice: "B" as const })), 0.25).score, 1 - 0.75);
});

test("grading ignores answers for questions not in the exam", () => {
  assert.equal(grade(qs, [{ questionId: "999", choice: "A" }], 0.25).wrong, 0);
});

test("rank: score desc, tie broken by earlier submit", () => {
  const t = (m: number) => new Date(2026, 10, 1, 10, m);
  const r = rank([{ id: "a", score: 70, submittedAt: t(5) }, { id: "b", score: 80, submittedAt: t(9) }, { id: "c", score: 70, submittedAt: t(2) }], 60);
  assert.deepEqual(r.ranks, [{ id: "b", rank: 1 }, { id: "c", rank: 2 }, { id: "a", rank: 3 }]);
  assert.equal(r.participants, 3);
  assert.equal(r.passed, 3);
});

test("rank: pass mark is inclusive", () => {
  const d = new Date();
  assert.equal(rank([{ id: "a", score: 60, submittedAt: d }, { id: "b", score: 59.75, submittedAt: d }], 60).passed, 1);
});

test("exam window is 12:00 AM to 11:59 PM Dhaka time", () => {
  const day = parseDhakaDate("2026-11-08");
  const w = examWindow(day);
  assert.equal(statusAt(new Date("2026-11-07T17:59:59Z"), w), "SCHEDULED"); // 23:59:59 Dhaka, day before
  assert.equal(statusAt(new Date("2026-11-07T18:00:00Z"), w), "LIVE"); // 00:00 Dhaka
  assert.equal(statusAt(new Date("2026-11-08T17:59:59Z"), w), "LIVE"); // 23:59:59 Dhaka
  assert.equal(statusAt(new Date("2026-11-08T18:00:00Z"), w), "CLOSED");
});

test("dhakaStartOfDay maps a UTC evening to the next Dhaka day", () => {
  assert.equal(dhakaStartOfDay(new Date("2026-11-07T19:00:00Z")).toISOString(), "2026-11-07T18:00:00.000Z");
});

test("timer: 60 minutes from start, capped by the window end", () => {
  const start = new Date("2026-11-08T10:00:00Z");
  const end = new Date("2026-11-08T18:00:00Z");
  assert.equal(secondsLeft(start, new Date("2026-11-08T10:30:00Z"), end), 1800);
  assert.equal(secondsLeft(start, new Date("2026-11-08T11:30:00Z"), end), 0);
  assert.equal(secondsLeft(new Date("2026-11-08T17:30:00Z"), new Date("2026-11-08T17:40:00Z"), end), 1200);
});

test("access rules", () => {
  assert.equal(canStartExam(1, 1, false), true);
  assert.equal(canStartExam(2, 1, false), false);
  assert.equal(canStartExam(2, 1, true), true);
  assert.equal(canSeeAnswers("LIVE", true), false);
  assert.equal(canSeeAnswers("CLOSED", false), false);
  assert.equal(canSeeAnswers("RESULT_PUBLISHED", true), true);
});

test("mobile numbers normalize to +8801XXXXXXXXX", () => {
  assert.equal(normalizeMobile("01712 345 678"), "+8801712345678");
  assert.equal(normalizeMobile("+8801712345678"), "+8801712345678");
  assert.equal(normalizeMobile("12345"), null);
});

const otp = (over: Partial<{ expiresAt: Date; attempts: number }> = {}) => ({
  expiresAt: new Date(Date.now() + 600_000), attempts: 0, codeHash: hashWith("secret", "user1", "123456"), ...over,
});

test("otp: right code passes, wrong code fails", () => {
  assert.equal(checkOtp(otp(), hashWith("secret", "user1", "123456")), "OK");
  assert.equal(checkOtp(otp(), hashWith("secret", "user1", "654321")), "WRONG");
});

test("otp: a code is bound to its user", () => {
  assert.equal(checkOtp(otp(), hashWith("secret", "user2", "123456")), "WRONG");
});

test("otp: expired code is refused even when correct", () => {
  assert.equal(checkOtp(otp({ expiresAt: new Date(Date.now() - 1000) }), hashWith("secret", "user1", "123456")), "EXPIRED");
});

test("otp: locked after the maximum attempts, even with the right code", () => {
  assert.equal(checkOtp(otp({ attempts: OTP_MAX_ATTEMPTS - 1 }), hashWith("secret", "user1", "123456")), "OK");
  assert.equal(checkOtp(otp({ attempts: OTP_MAX_ATTEMPTS }), hashWith("secret", "user1", "123456")), "LOCKED");
});

test("course repeats: round 1 for 30 days, then round 2 on the same days", () => {
  const start = parseDhakaDate("2026-11-01");
  const at = (iso: string) => new Date(iso);
  assert.equal(currentRound(start, 30, at("2026-10-30T00:00:00Z")), 1); // before the start
  assert.equal(currentRound(start, 30, at("2026-11-01T18:00:00Z")), 1); // Dhaka Nov 2 = day 2
  assert.equal(dayOfRound(start, 30, at("2026-11-01T18:00:00Z")), 2);
  assert.equal(currentRound(start, 30, at("2026-11-30T17:59:00Z")), 1); // Dhaka Nov 30 = day 30
  assert.equal(dayOfRound(start, 30, at("2026-11-30T17:59:00Z")), 30);
  assert.equal(currentRound(start, 30, at("2026-11-30T18:00:00Z")), 2); // Dhaka Dec 1 = round 2 day 1
  assert.equal(dayOfRound(start, 30, at("2026-11-30T18:00:00Z")), 1);
});

test("a purchase lasts three months", () => {
  assert.equal(ACCESS_DAYS, 90);
});
