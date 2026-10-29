"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BackLink } from "@/components/student/BackLink";
import { BottomNav } from "@/components/student/BottomNav";
import { NextExamCard, type DayInfo } from "@/components/student/NextExamCard";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type Data = { course: { title: string; durationDays: number }; round: number; todayDayNo: number; enrolled: boolean; expiresAt: string | null; pending: boolean; days: DayInfo[] };
const TILES = [["Routine", "routine", "bg-tint-yellow"], ["Result", "results", "bg-tint-mint"], ["Archive", "archive", "bg-tint-lime"], ["Wrong and Unanswered", "review", "bg-tint-rose"], ["Favorite", "review?tab=favorite", "bg-tint-rose"], ["PDF and Solve sheets", "materials", "bg-tint-mint"], ["Vocabulary", "vocab", "bg-tint-lime"]];

export default function LearnPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useRequireAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (user) api<Data>(`/courses/${slug}/days`).then(setData).catch((e) => setError(e.message)); }, [slug, user]);

  return (
    <AppShell>
      <div className="px-6 pb-24 pt-8">
        <BackLink href="/home" />
        <p className="text-sm text-muted">{data ? `Day ${data.todayDayNo} of ${data.course.durationDays}${data.round > 1 ? ` · Round ${data.round}` : ""}` : " "}</p>
        <h1 className="text-[26px] font-bold">{data?.course.title ?? "Course"}</h1>
        {error && <p role="alert" className="mt-4 text-danger">{error}</p>}
        {data && (
          data.enrolled ? <p className="mt-2 text-sm text-success">Active until {data.expiresAt ? new Date(data.expiresAt).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "long" }) : "further notice"}</p>
          : data.pending ? <p className="card mt-3 p-3 text-sm">Your payment is waiting for approval. We will email you once it is confirmed.</p>
          : <div className="card mt-3 flex items-center justify-between gap-3 p-3 text-sm"><span>Free trial: only Day 1 is open.</span><Link href={`/courses/${slug}/buy`} className="btn btn-primary !px-4">Buy course</Link></div>
        )}
        {!data && !error && <div className="skeleton mt-4 h-56" />}
        {data && <NextExamCard days={data.days} total={data.course.durationDays} slug={slug} />}
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm font-semibold">
          {TILES.map(([l, h, c]) => <Link key={h} href={`/learn/${slug}/${h}`} className={`rounded-2xl p-4 ${c}`}>{l}</Link>)}
          <Link href="/notices" className="rounded-2xl bg-tint-blue p-4">Notice</Link>
        </div>
      </div>
      <BottomNav />
    </AppShell>
  );
}
