"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BottomNav } from "@/components/student/BottomNav";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type R = { id: string; title: string; date: string; totalMarks: number; participants: number; score: number; rank: number };

export default function ResultsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useRequireAuth();
  const [rows, setRows] = useState<R[] | null>(null);
  useEffect(() => { if (user) api<{ results: R[] }>(`/courses/${slug}/results`).then((d) => setRows(d.results)).catch(() => setRows([])); }, [slug, user]);
  return (
    <AppShell>
      <div className="px-6 pb-24 pt-8">
        <Link href={`/learn/${slug}`} className="mb-3 inline-flex rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-navy shadow-sm">← Back</Link>
        <p className="mt-4 text-sm text-muted">Exams you joined live</p>
        <h1 className="text-[26px] font-bold">Your results</h1>
        <div className="mt-4 flex flex-col gap-3">
          {!rows && <div className="skeleton h-28" />}
          {rows?.length === 0 && <p className="text-muted">Published results appear here after you take a live exam.</p>}
          {rows?.map((r) => (
            <div key={r.id} className="card p-4">
              <p className="text-sm text-muted">{new Date(r.date).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium" })}</p>
              <h2 className="font-bold">{r.title}</h2>
              <div className="mt-1 flex justify-between text-sm"><span>Obtained: <b>{r.score.toFixed(2)} / {r.totalMarks}</b></span><span className="text-muted">Rank {r.rank} / {r.participants}</span></div>
              <div className="mt-3 flex gap-2"><Link href={`/exam/${r.id}/result`} className="btn btn-outline flex-1">Answer sheet</Link><Link href={`/exam/${r.id}/marksheet`} className="btn btn-primary flex-1">Mark sheet</Link></div>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </AppShell>
  );
}
