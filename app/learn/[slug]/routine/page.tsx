"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BackLink } from "@/components/student/BackLink";
import { BottomNav } from "@/components/student/BottomNav";
import type { DayInfo } from "@/components/student/NextExamCard";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type Data = { course: { title: string; durationDays: number }; round: number; todayDayNo: number; enrolled: boolean; days: DayInfo[] };
const TYPE: Record<string, string> = { TOPIC: "Topic", FINAL: "Final", MODEL: "Model", MIXED: "Daily" };

function Row({ d, slug, today }: { d: DayInfo; slug: string; today: boolean }) {
  const done = d.status === "CLOSED" || d.status === "RESULT_PUBLISHED";
  const target = d.locked ? `/courses/${slug}/buy` : d.examId ? `/exam/${d.examId}` : "#";
  return (
    <Link href={target} className={`card block p-4 ${today ? "ring-2 ring-gold" : ""}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-bold">Day {d.dayNo}{today ? " · Today" : ""}</h3>
        <span className="flex items-center gap-2">
          <span className="pill bg-tint-yellow text-gold">{TYPE[d.type ?? "TOPIC"]}</span>
          <span className={`pill ${d.status === "LIVE" ? "bg-navy text-white" : done ? "bg-tint-mint text-success" : "bg-peach text-gold"}`}>{d.locked ? "🔒 Locked" : d.status === "LIVE" ? "Live" : done ? "Done" : "Upcoming"}</span>
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">{Object.values(d.topics ?? {}).join(" · ")}</p>
    </Link>
  );
}

export default function RoutinePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useRequireAuth();
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => { if (user) api<Data>(`/courses/${slug}/days`).then(setData).catch(() => {}); }, [slug, user]);

  const days = data?.days ?? [];
  const live = days.filter((d) => d.status === "LIVE");
  const upcoming = days.filter((d) => d.status === "SCHEDULED");
  const past = days.filter((d) => d.status === "CLOSED" || d.status === "RESULT_PUBLISHED").reverse();
  const group = (title: string, list: DayInfo[]) => list.length > 0 && (
    <section className="mt-6"><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{title}</h2><div className="flex flex-col gap-3">{list.map((d) => <Row key={d.dayNo} d={d} slug={slug} today={d.dayNo === data?.todayDayNo} />)}</div></section>
  );
  return (
    <AppShell>
      <div className="px-6 pb-24 pt-8">
        <BackLink href={`/learn/${slug}`} />
        <p className="text-sm text-muted">{data?.course.title} · Round {data?.round}</p>
        <h1 className="text-[26px] font-bold">Routine</h1>
        {data && <p className="mt-1 text-sm text-muted">Today is Day {data.todayDayNo} of {data.course.durationDays}. Everyone takes the same exam on the same day.</p>}
        {!data && <div className="skeleton mt-4 h-40" />}
        {group("Live now", live)}{group("Coming up", upcoming)}{group("Completed (also in Archive)", past)}
      </div>
      <BottomNav />
    </AppShell>
  );
}
