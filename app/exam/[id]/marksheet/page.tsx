"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BackLink } from "@/components/student/BackLink";
import { BottomNav } from "@/components/student/BottomNav";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type R = { state: string; courseTitle?: string; examTitle?: string; date?: string; score?: number; correct?: number; wrong?: number; rank?: number | null; participants?: number; passed?: number; cutMark?: number; bySubject?: Record<string, { correct: number; wrong: number; score: number }> };

export default function MarkSheetPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useRequireAuth();
  const [r, setR] = useState<R | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (user) api<R>(`/exams/${id}/result`).then(setR).catch((e) => setError(e.message)); }, [id, user]);

  const shell = (c: React.ReactNode) => <AppShell><div className="px-6 pb-24 pt-8"><BackLink />{c}</div><BottomNav /></AppShell>;
  if (error) return shell(<p role="alert" className="text-danger">{error}</p>);
  if (!r) return shell(<div className="skeleton h-48" />);
  if (r.state !== "PUBLISHED") return shell(<p className="text-muted">The mark sheet is available after the result is published.</p>);

  const passed = (r.score ?? 0) >= (r.cutMark ?? 0);
  const tiles = [["Participants", r.participants, "bg-tint-mint"], ["Passed", r.passed, "bg-tint-mint"], ["Cut mark", r.cutMark, "bg-tint-blue"], ["Your marks", r.score?.toFixed(2), "bg-tint-blue"], ["Your result", passed ? "Passed" : "Not passed", "bg-tint-lime"], ["Position", `${r.rank} of ${r.participants}`, "bg-tint-yellow"]] as const;
  return shell(
    <>
      <p className="text-sm text-muted">{r.examTitle} · {r.date && new Date(r.date).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium" })}</p>
      <h1 className="text-[26px] font-bold">Mark sheet</h1>
      <div className="card mt-4 p-5 text-center"><p className="text-xl font-bold">{user?.name}</p><p className="text-sm text-muted">{r.courseTitle}</p></div>
      <div className="mt-3 grid grid-cols-2 gap-3">{tiles.map(([l, v, c]) => <div key={l} className={`rounded-2xl p-4 text-center ${c}`}><p className="text-sm text-muted">{l}</p><p className="text-xl font-bold">{v}</p></div>)}</div>
      <div className="card mt-4 overflow-hidden text-sm">
        <div className="grid grid-cols-4 bg-peach p-3 font-semibold text-gold"><span>Subject</span><span className="text-center">Right</span><span className="text-center">Wrong</span><span className="text-right">Marks</span></div>
        {Object.entries(r.bySubject ?? {}).map(([s, v]) => <div key={s} className="grid grid-cols-4 border-t border-line p-3"><span>{s}</span><span className="text-center">{v.correct}</span><span className="text-center">{v.wrong}</span><b className="text-right">{v.score.toFixed(2)}</b></div>)}
        <div className="grid grid-cols-4 border-t border-line p-3 font-bold"><span>Total</span><span className="text-center">{r.correct}</span><span className="text-center">{r.wrong}</span><span className="text-right">{r.score?.toFixed(2)}</span></div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3"><Link href={`/exam/${id}/result`} className="btn btn-primary">Answer sheet</Link><Link href={`/exam/${id}/merit`} className="btn btn-soft">Merit list</Link></div>
    </>,
  );
}
