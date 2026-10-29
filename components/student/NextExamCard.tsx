"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export type DayInfo = {
  dayNo: number; type?: string; date: string; topics: Record<string, string>; examId: string | null; status: string; opensAt?: string; closesAt?: string;
  totalMarks?: number; durationMin?: number; joined?: boolean; submitted?: boolean; locked?: boolean;
};

export function Countdown({ to, small }: { to: string; small?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return <span className={`${small ? "text-lg" : "text-3xl"} font-bold tabular-nums`}>{p(Math.floor(s / 3600))} : {p(Math.floor((s % 3600) / 60))} : {p(s % 60)}</span>;
}

const topicLine = (t: Record<string, string>) => Object.entries(t ?? {}).map(([k, v]) => `${k[0].toUpperCase()}${k.slice(1)}: ${v}`).join(" · ");
const dateText = (d: string) => new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", weekday: "short", day: "2-digit", month: "short", year: "numeric" });

function Card({ d, total, slug, kind }: { d: DayInfo; total: number; slug: string; kind: "live" | "next" }) {
  const live = kind === "live";
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div><p className="text-sm text-muted">Day {d.dayNo} of {total}</p><p className="text-lg font-bold">{dateText(d.date)}</p></div>
        <span className={`pill ${live ? "bg-navy text-white" : "bg-peach text-gold"}`}>{live ? "Live now" : "Upcoming"}</span>
      </div>
      <div className="mt-3 flex justify-between text-sm text-muted"><span>Total marks: {d.totalMarks ?? 100}</span><span>Duration: {d.durationMin ?? 60} mins</span></div>
      <div className="mt-3 rounded-2xl bg-peach/50 p-4 text-sm"><p className="font-bold">Day {d.dayNo} · {live ? "Exam topics" : "Next exam topics"}</p><p className="mt-1 text-muted">{topicLine(d.topics)}</p></div>
      {(live ? d.closesAt : d.opensAt) && <div className="mt-3 flex items-center justify-between"><span className="text-sm text-muted">{live ? "Closes in" : "Goes live in"}</span><Countdown to={(live ? d.closesAt : d.opensAt)!} /></div>}
      {live && d.examId && (d.locked
        ? <Link href={`/courses/${slug}/buy`} className="btn btn-primary mt-4 w-full">Buy course to join</Link>
        : <Link href={`/exam/${d.examId}`} className="btn btn-primary mt-4 w-full">{d.joined ? "Continue exam" : "Start exam"}</Link>)}
    </div>
  );
}

/** Course home: only today's live exam, or the next one. Everything else lives under Routine, Archive and Result. */
export function NextExamCard({ days, total, slug }: { days: DayInfo[]; total: number; slug: string }) {
  const live = days.find((d) => d.status === "LIVE");
  const upcoming = days.filter((d) => d.status === "SCHEDULED").sort((a, b) => +new Date(a.opensAt ?? a.date) - +new Date(b.opensAt ?? b.date))[0];
  return (
    <div className="mt-4 flex flex-col gap-3">
      {live && !live.submitted && <Card d={live} total={total} slug={slug} kind="live" />}
      {live?.submitted && (
        <div className="card p-5"><p className="font-bold">Day {live.dayNo} exam submitted ✓</p><p className="mt-1 text-sm text-muted">Everyone gets the result together after the exam closes{live.closesAt ? ` at ${new Date(live.closesAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka", timeStyle: "short" })}` : ""}.</p></div>
      )}
      {(!live || live.submitted) && upcoming && <Card d={upcoming} total={total} slug={slug} kind="next" />}
      {!live && !upcoming && <div className="card p-5 text-muted">No exam is scheduled right now.</div>}
    </div>
  );
}
