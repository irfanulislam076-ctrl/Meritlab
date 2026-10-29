"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BackLink } from "@/components/student/BackLink";
import { BottomNav } from "@/components/student/BottomNav";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type Q = { id: string; no: number; subject: string; text: string; options: Record<string, string>; answer: string; explanation?: string; shortcut?: string };

export default function SheetPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useRequireAuth();
  const [d, setD] = useState<{ title: string; questions: Q[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (user) api<NonNullable<typeof d>>(`/exams/${id}/sheet`).then(setD).catch((e) => setError(e.message)); }, [id, user]);

  return (
    <AppShell>
      <div className="px-6 pb-24 pt-8">
        <BackLink />
        <h1 className="text-[26px] font-bold">{d?.title ?? "Questions"}</h1>
        {error && <p role="alert" className="mt-3 text-danger">{error}</p>}
        {!d && !error && <div className="skeleton mt-4 h-40" />}
        <div className="mt-4 flex flex-col gap-3">
          {d?.questions.map((q) => (
            <div key={q.id} className="card p-4">
              <p className="text-sm font-semibold text-gold">Q{q.no} · {q.subject}</p>
              <p className="mt-1 font-medium">{q.text}</p>
              <div className="mt-3 flex flex-col gap-2 text-sm">{(["A", "B", "C", "D"] as const).map((c) => <p key={c} className={`rounded-xl px-3 py-2 ${c === q.answer ? "bg-tint-mint font-semibold" : "bg-peach/40"}`}><b>{c}</b> {q.options[c]}{c === q.answer ? " · correct" : ""}</p>)}</div>
              <button className="btn btn-soft mt-3 w-full" onClick={() => setOpen(open === q.id ? null : q.id)}>Explanation</button>
              {open === q.id && <div className="mt-3 text-sm"><p className="whitespace-pre-line text-muted">{q.explanation}</p>{q.shortcut && <p className="mt-2 rounded-xl bg-peach p-3"><b>Shortcut:</b> {q.shortcut}</p>}</div>}
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </AppShell>
  );
}
