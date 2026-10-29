"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BackLink } from "@/components/student/BackLink";
import { BottomNav } from "@/components/student/BottomNav";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type Row = { id: string; title: string; date: string; status: string; totalMarks: number; durationMin: number; joined: boolean; score?: number; rank?: number; locked: boolean };

export default function ArchivePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useRequireAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (user) api<{ exams: Row[] }>(`/courses/${slug}/archive`).then((d) => setRows(d.exams)).catch(() => setRows([]));
  }, [slug, user]);

  return (
    <AppShell>
      <div className="px-6 pb-24 pt-8">
        <BackLink href={`/learn/${slug}`} />
        <h1 className="text-[26px] font-bold">Archive</h1>
        <p className="mt-1 text-sm text-muted">Every finished exam. Read the questions with explanations, or take it again as practice (not ranked).</p>
        <input className="input mt-4" placeholder="Search exams" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-4 flex flex-col gap-3">
          {!rows && <div className="skeleton h-28" />}
          {rows?.length === 0 && <p className="text-muted">Finished exams will appear here.</p>}
          {rows?.filter((r) => r.title.toLowerCase().includes(q.toLowerCase())).map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-center justify-between"><p className="text-sm text-muted">{new Date(r.date).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}</p>{r.locked && <span className="pill bg-peach text-gold">🔒 Course</span>}</div>
              <h2 className="font-bold">{r.title}</h2>
              <p className="text-sm text-muted">{r.totalMarks} marks · {r.durationMin} min{r.joined && r.score != null ? ` · You: ${r.score} (rank ${r.rank ?? "-"})` : ""}</p>
              {r.locked ? (
                <Link href={`/courses/${slug}/buy`} className="btn btn-soft mt-3 w-full">Buy course to open</Link>
              ) : (
                <div className="mt-3 flex gap-2">
                  <Link href={`/exam/${r.id}/sheet`} className="btn btn-outline flex-1">Questions</Link>
                  <Link href={`/exam/${r.id}`} className="btn btn-primary flex-1">Take exam</Link>
                  {r.joined && r.status === "RESULT_PUBLISHED" && <Link href={`/exam/${r.id}/result`} className="btn btn-soft flex-1">Result</Link>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </AppShell>
  );
}
