"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BackLink } from "@/components/student/BackLink";
import { BottomNav } from "@/components/student/BottomNav";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type Word = { word: string; banglaMeaning: string; englishExplanation: string };
type Info = { readPages: number[]; learned: number; locked: boolean; totalPages: number };

export default function VocabPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useRequireAuth();
  const [today, setToday] = useState(1);
  const [day, setDay] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "read">("list");
  const [info, setInfo] = useState<Info | null>(null);
  const [words, setWords] = useState<Word[] | null>(null);
  const [error, setError] = useState("");
  const base = `/courses/${slug}/vocab/${day}`;

  useEffect(() => { // today's day follows the course calendar
    if (user) api<{ todayDayNo: number }>(`/courses/${slug}/days`).then((d) => { setToday(Math.min(22, d.todayDayNo)); setDay(Math.min(22, d.todayDayNo)); }).catch(() => setDay(1));
  }, [slug, user]);

  useEffect(() => {
    if (!user || day === null) return;
    setInfo(null); setError(""); setView("list");
    api<Info>(base).then((d) => { setInfo(d); setPage(Math.min(10, (d.readPages.at(-1) ?? 0) + 1)); }).catch((e) => setError(e.message));
  }, [base, user, day]);

  const loadPage = useCallback((p: number) => { setWords(null); api<{ words: Word[] }>(`${base}/pages/${p}`).then((d) => setWords(d.words)).catch((e) => setError(e.message)); }, [base]);
  useEffect(() => { if (view === "read") loadPage(page); }, [view, page, loadPage]);

  async function next() {
    try {
      const r = await api<{ learned: number }>(`${base}/pages/${page}/read`, "POST");
      setInfo((i) => i && { ...i, learned: r.learned, readPages: Array.from(new Set([...i.readPages, page])) });
      if (page < 10) setPage(page + 1); else setView("list"); // the last page returns to the list, where the completed banner shows
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  const done = (info?.learned ?? 0) >= 50;
  return (
    <AppShell>
      <div className="px-6 pb-40 pt-8">
        {view === "read" ? <button onClick={() => setView("list")} className="mb-3 inline-flex rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-navy shadow-sm">← Word list</button> : <BackLink href={`/learn/${slug}`} />}
        <div className="flex items-center justify-between">
          <div><p className="text-sm text-muted">Day {day} · Words {((day ?? 1) - 1) * 50 + 1}–{(day ?? 1) * 50}</p><h1 className="text-[26px] font-bold">{day === today ? "Today's words" : "Vocabulary"}</h1></div>
          {view === "read" && <span className="pill bg-peach text-gold">Page {page} / 10</span>}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {Array.from({ length: 22 }, (_, i) => i + 1).map((d) => <button key={d} onClick={() => setDay(d)} className={`pill shrink-0 ${d === day ? "bg-navy text-white" : "bg-peach text-gold"}`}>{d === today ? `Today · ${d}` : `Day ${d}`}</button>)}
        </div>
        {error && <p role="alert" className="mt-4 text-sm font-medium text-danger">{error}</p>}
        {info?.locked && <div className="card mt-4 p-5"><p>This day is part of the course.</p><Link href={`/courses/${slug}/buy`} className="btn btn-primary mt-3 w-full">Buy course</Link></div>}

        {info && !info.locked && (
          <>
            {done && <div className="mt-4 rounded-2xl bg-tint-mint p-4 text-center font-bold text-success">🎉 {day === today ? "Today's task completed" : `Day ${day} completed`}<p className="mt-1 text-sm font-normal">All 50 words are done. You can read them again any time.</p></div>}
            <div className="card mt-4 p-4">
              <div className="flex justify-between text-sm"><b>{info.learned} / 50 learned</b><span className="text-muted">Daily target: 50</span></div>
              <div className="mt-2 h-2 rounded-full bg-line"><div className="h-2 rounded-full bg-navy" style={{ width: `${(info.learned / 50) * 100}%` }} /></div>
            </div>
            {view === "list" && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => { setPage(p); setView("read"); }} className={`card p-4 text-left ${info.readPages.includes(p) ? "bg-tint-mint" : p === page && !done ? "ring-2 ring-gold" : ""}`}>
                    <b>Page {p}</b><p className="text-sm text-muted">Words {(p - 1) * 5 + 1}–{p * 5} · {info.readPages.includes(p) ? "Done ✓" : "To read"}</p>
                  </button>))}
              </div>
            )}
            {view === "read" && words && (
              <div className="card mt-4 divide-y divide-line">
                {words.length === 0 && <p className="p-4 text-muted">No words on this page yet.</p>}
                {words.map((w) => (<div key={w.word} className="grid grid-cols-[1fr_1.6fr] gap-3 p-4"><b className="text-lg">{w.word}</b><div><p className="font-semibold">{w.banglaMeaning}</p><p className="text-sm text-muted">{w.englishExplanation}</p></div></div>))}
              </div>
            )}
          </>
        )}
      </div>
      {info && !info.locked && view === "list" && !done && (
        <div className="fixed bottom-14 left-0 right-0 mx-auto max-w-[480px] bg-page px-6 pb-3 pt-3"><button className="btn btn-primary w-full" onClick={() => setView("read")}>{info.readPages.length ? "Continue reading" : "Start reading"}</button></div>
      )}
      {view === "read" && (
        <div className="fixed bottom-14 left-0 right-0 mx-auto max-w-[480px] bg-page px-6 pb-3 pt-3">
          <p className="mb-2 text-center text-sm font-semibold">Did you finish reading this page?</p>
          <div className="flex gap-3"><button className="btn btn-outline flex-1" onClick={() => loadPage(page)}>Read again</button><button className="btn btn-primary flex-1" onClick={next}>{page < 10 ? "Yes, next page →" : "Yes, finish"}</button></div>
        </div>
      )}
      <BottomNav />
    </AppShell>
  );
}
