"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BottomNav } from "@/components/student/BottomNav";
import { Countdown } from "@/components/student/NextExamCard";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type Live = { id: string; title: string; closesAt: string; inProgress: boolean; access: boolean; course: { title: string; slug: string } };
type Next = { id: string; title: string; opensAt: string; course: { title: string; slug: string } };

export default function ExamsPage() {
  const { user } = useRequireAuth();
  const [d, setD] = useState<{ live: Live[]; upcoming: Next[]; done: number } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (user) api<NonNullable<typeof d>>("/exams/live").then(setD).catch((e) => setError(e.message)); }, [user]);

  return (
    <AppShell>
      <div className="px-6 pb-24 pt-8">
        <h1 className="text-[26px] font-bold">Live exams</h1>
        {error && <p role="alert" className="mt-3 text-danger">{error}</p>}
        {!d && !error && <div className="skeleton mt-4 h-32" />}
        <div className="mt-4 flex flex-col gap-3">
          {d?.live.map((e) => (
            <Link key={e.id} href={e.access ? `/exam/${e.id}` : `/courses/${e.course.slug}`} className="card block p-5">
              <div className="flex items-center justify-between"><p className="text-sm text-muted">{e.course.title}</p><span className="pill bg-navy text-white">Live</span></div>
              <h2 className="mt-1 text-lg font-bold">{e.title}</h2>
              <div className="mt-3 flex items-center justify-between"><span className="text-sm text-muted">Closes in</span><Countdown to={e.closesAt} small /></div>
              <p className={`btn mt-3 w-full ${e.access ? "btn-primary" : "btn-soft"}`}>{!e.access ? "Buy course to join" : e.inProgress ? "Continue exam" : "Start exam"}</p>
            </Link>
          ))}
          {d && d.live.length === 0 && (
            <div className="card p-5 text-muted">{d.done > 0 ? "You have taken today's exam. The result is published for everyone after it closes." : "No live exam right now."}</div>
          )}
        </div>
        {d && d.upcoming.length > 0 && <>
          <h2 className="mb-2 mt-7 text-sm font-bold uppercase tracking-wide text-muted">Next exam</h2>
          {d.upcoming.map((e) => (
            <Link key={e.id} href={`/learn/${e.course.slug}`} className="card block p-4">
              <p className="text-sm text-muted">{e.course.title}</p><h3 className="font-bold">{e.title}</h3>
              <div className="mt-2 flex items-center justify-between"><span className="text-sm text-muted">Goes live in</span><Countdown to={e.opensAt} small /></div>
            </Link>
          ))}
        </>}
      </div>
      <BottomNav />
    </AppShell>
  );
}
