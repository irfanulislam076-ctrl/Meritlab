"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BackLink } from "@/components/student/BackLink";
import { BottomNav } from "@/components/student/BottomNav";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type Q = { id: string; no: number; subject: string; text: string; options: Record<string, string>; answer: string; chosen: string | null; explanation?: string; shortcut?: string; favorite: boolean };
type R = { state: string; practice?: boolean; score?: number; correct?: number; wrong?: number; skipped?: number; totalMarks?: number; rank?: number | null; participants?: number; passed?: number; cutMark?: number; bySubject?: Record<string, { correct: number; wrong: number; score: number }>; questions?: Q[] };

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useRequireAuth();
  const [r, setR] = useState<R | null>(null);
  const [filter, setFilter] = useState<"all" | "wrong" | "skipped">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const practice = new URLSearchParams(window.location.search).get("practice") === "1";
    api<R>(`/exams/${id}/result${practice ? "?practice=1" : ""}`).then(setR).catch((e) => setError(e.message));
  }, [id, user]);

  async function fav(q: Q) {
    await api(`/questions/${q.id}/favorite`, "POST", { favorite: !q.favorite }).catch(() => {});
    setR((x) => x && { ...x, questions: x.questions?.map((y) => (y.id === q.id ? { ...y, favorite: !y.favorite } : y)) });
  }

  const shell = (c: React.ReactNode) => <AppShell><div className="px-6 pb-24 pt-8"><BackLink />{c}</div><BottomNav /></AppShell>;
  if (error) return shell(<p role="alert" className="text-danger">{error}</p>);
  if (!r) return shell(<div className="skeleton h-40" />);
  if (r.state === "NONE") return shell(<p className="text-muted">You have no submitted attempt for this exam.</p>);
  if (r.state === "SUBMITTED") return shell(<><h1 className="text-[26px] font-bold">Submitted</h1><p className="mt-2 text-muted">Your answers are saved. The result is published after the exam closes.</p></>);

  const qs = (r.questions ?? []).filter((q) => filter === "all" || (filter === "wrong" ? q.chosen && q.chosen !== q.answer : !q.chosen));
  return shell(
    <>
      <p className="text-sm text-muted">{r.practice ? "Practice result (not ranked)" : "Result published"}</p>
      <div className="mt-2 rounded-3xl bg-navy p-5 text-white">
        <div className="flex items-end justify-between">
          <div><p className="text-sm opacity-70">Your score</p><p className="text-5xl font-bold">{r.score?.toFixed(2)}<span className="text-lg opacity-70"> / {r.totalMarks}</span></p></div>
          {r.rank != null && <div className="text-right"><p className="text-sm opacity-70">Rank</p><p className="text-3xl font-bold">{r.rank}</p><p className="text-xs opacity-70">of {r.participants}</p></div>}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-white/10 p-2">Correct<br /><b>{r.correct}</b></div>
          <div className="rounded-xl bg-white/10 p-2">Wrong<br /><b>{r.wrong}</b></div>
          <div className="rounded-xl bg-white/10 p-2">Skipped<br /><b>{r.skipped}</b></div>
        </div>
      </div>
      {!r.practice && <p className="mt-3 text-sm text-muted">Passed {r.passed} of {r.participants} · Cut mark {r.cutMark} · {(r.score ?? 0) >= (r.cutMark ?? 0) ? "You passed" : "Below the cut mark"}</p>}
      <div className="card mt-4 divide-y divide-line px-4 text-sm">
        {Object.entries(r.bySubject ?? {}).map(([s, v]) => <div key={s} className="flex justify-between py-3"><span>{s}</span><span>{v.correct} right · {v.wrong} wrong · <b>{v.score.toFixed(2)}</b></span></div>)}
      </div>
      {!r.practice && <div className="mt-4 grid grid-cols-2 gap-3"><Link href={`/exam/${id}/marksheet`} className="btn btn-soft">Mark sheet</Link><Link href={`/exam/${id}/merit`} className="btn btn-soft">Merit list</Link></div>}
      <h2 className="mt-8 text-lg font-bold">Questions and explanations</h2>
      <div className="mt-3 flex gap-2">{(["all", "wrong", "skipped"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`pill ${filter === f ? "bg-navy text-white" : "bg-peach text-gold"}`}>{f}</button>)}</div>
      <div className="mt-4 flex flex-col gap-3">
        {qs.map((q) => {
          const ok = q.chosen === q.answer;
          return (
            <div key={q.id} className={`card p-4 ${q.chosen && !ok ? "border border-danger" : ""}`}>
              <button className="w-full text-left" onClick={() => setOpen(open === q.id ? null : q.id)}>
                <span className="mr-2">{!q.chosen ? "–" : ok ? "✓" : "✗"}</span><b>Q{q.no}.</b> {q.text}
              </button>
              {open === q.id && (
                <div className="mt-3 text-sm">
                  {(["A", "B", "C", "D"] as const).map((c) => (
                    <p key={c} className={`mb-1 rounded-xl px-3 py-2 ${c === q.answer ? "bg-tint-mint" : c === q.chosen ? "bg-tint-rose" : "bg-peach/40"}`}>
                      <b>{c}</b> {q.options[c]}{c === q.answer ? " · correct" : c === q.chosen ? " · your answer" : ""}
                    </p>
                  ))}
                  {q.explanation && <p className="mt-3 whitespace-pre-line text-muted">{q.explanation}</p>}
                  {q.shortcut && <p className="mt-2 rounded-xl bg-peach p-3"><b>Shortcut:</b> {q.shortcut}</p>}
                  {!r.practice && <button onClick={() => fav(q)} className="mt-3 text-sm font-semibold text-gold">{q.favorite ? "♥ Saved" : "♡ Save to favorites"}</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>,
  );
}
