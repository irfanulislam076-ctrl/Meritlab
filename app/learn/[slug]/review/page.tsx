"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BottomNav } from "@/components/student/BottomNav";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type Q = { id: string; dayNo: number; subject: string; text: string; options: Record<string, string>; answer: string; chosen: string | null; explanation?: string; shortcut?: string; favorite: boolean };
const TABS = ["wrong", "correct", "unanswered", "favorite"] as const;
const SUBJECTS = ["BANGLA", "ENGLISH", "MATH", "GK", "ICT"];

export default function ReviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useRequireAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>("wrong");
  const [subject, setSubject] = useState("");
  const [qs, setQs] = useState<Q[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { const t = new URLSearchParams(window.location.search).get("tab"); if (t && (TABS as readonly string[]).includes(t)) setTab(t as (typeof TABS)[number]); }, []);

  useEffect(() => {
    if (!user) return;
    setQs(null);
    api<{ questions: Q[] }>(`/courses/${slug}/review?tab=${tab}${subject ? `&subject=${subject}` : ""}`).then((d) => setQs(d.questions)).catch(() => setQs([]));
  }, [slug, tab, subject, user]);

  async function fav(q: Q) {
    await api(`/questions/${q.id}/favorite`, "POST", { favorite: !q.favorite }).catch(() => {});
    setQs((l) => l && l.map((x) => (x.id === q.id ? { ...x, favorite: !x.favorite } : x)));
  }

  return (
    <AppShell>
      <div className="px-6 pb-24 pt-8">
        <Link href={`/learn/${slug}`} className="mb-3 inline-flex rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-navy shadow-sm">← Back</Link>
        <h1 className="mt-4 text-[26px] font-bold">Wrong and Unanswered</h1>
        <div className="mt-3 flex gap-2 overflow-x-auto">{TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`pill shrink-0 capitalize ${tab === t ? "bg-navy text-white" : "bg-peach text-gold"}`}>{t}</button>)}</div>
        <select className="input mt-3" value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">All subjects</option>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
        <p className="mt-3 text-sm text-muted">{qs ? `${qs.length} questions` : "Loading..."} · from published results</p>
        <div className="mt-3 flex flex-col gap-3">
          {qs?.map((q) => (
            <div key={q.id} className="card p-4">
              <p className="text-sm font-semibold text-gold">Day {q.dayNo} · {q.subject}</p>
              <p className="mt-1 font-medium">{q.text}</p>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                {(["A", "B", "C", "D"] as const).map((c) => (
                  <p key={c} className={`rounded-xl px-3 py-2 ${c === q.answer ? "bg-tint-mint" : c === q.chosen ? "bg-tint-rose" : "bg-peach/40"}`}><b>{c}</b> {q.options[c]}{c === q.answer ? " · correct" : c === q.chosen ? " · your answer" : ""}</p>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn btn-soft flex-1" onClick={() => setOpen(open === q.id ? null : q.id)}>Explanation</button>
                <button className="btn btn-outline" onClick={() => fav(q)} aria-label="Favorite">{q.favorite ? "♥" : "♡"}</button>
              </div>
              {open === q.id && <div className="mt-3 text-sm"><p className="whitespace-pre-line text-muted">{q.explanation}</p>{q.shortcut && <p className="mt-2 rounded-xl bg-peach p-3"><b>Shortcut:</b> {q.shortcut}</p>}</div>}
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </AppShell>
  );
}
