"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BackLink } from "@/components/student/BackLink";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type Meta = { id: string; courseSlug: string; title: string; dayNo: number; status: string; opensAt: string; closesAt: string; totalMarks: number; durationMin: number; topics?: Record<string, string>; access: boolean; joined: boolean; submitted: boolean };
type Q = { id: string; no: number; subject: string; text: string; options: Record<"A" | "B" | "C" | "D", string> };
type Run = { practice: boolean; secondsLeft: number; questions: Q[]; locked: Record<string, string | null> };
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useRequireAuth();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [locked, setLocked] = useState<Record<string, string | null>>({});
  const [left, setLeft] = useState(0);
  const [subject, setSubject] = useState("ALL");
  const [error, setError] = useState("");
  const submitting = useRef(false);

  useEffect(() => {
    if (user) api<{ exam: Meta }>(`/exams/${id}`).then((d) => setMeta(d.exam)).catch((e) => setError(e.message));
  }, [id, user]);

  const finish = useCallback(async (practice: boolean) => {
    if (submitting.current) return;
    submitting.current = true;
    await api(`/exams/${id}/submit`, "POST").catch(() => {});
    router.replace(`/exam/${id}/result${practice ? "?practice=1" : ""}`);
  }, [id, router]);

  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [run]);
  useEffect(() => { if (run && left <= 0) finish(run.practice); }, [left, run, finish]);

  async function start() {
    setError("");
    try {
      const r = await api<Run>(`/exams/${id}/start`, "POST");
      setRun(r); setLocked(r.locked); setLeft(r.secondsLeft);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function pick(q: Q, choice: string) {
    if (locked[q.id]) return; // first tap wins
    setLocked((l) => ({ ...l, [q.id]: choice }));
    try { await api(`/exams/${id}/answer`, "POST", { questionId: q.id, choice }); }
    catch (e) {
      setLocked((l) => { const n = { ...l }; delete n[q.id]; return n; });
      setError(e instanceof Error ? e.message : "Could not save the answer");
    }
  }

  if (!meta) return <AppShell><div className="px-6 pt-8">{error ? <p role="alert" className="text-danger">{error}</p> : <div className="skeleton h-40" />}</div></AppShell>;

  if (!run) {
    const live = meta.status === "LIVE";
    const closed = meta.status === "CLOSED" || meta.status === "RESULT_PUBLISHED";
    return (
      <AppShell>
        <div className="px-6 pb-8 pt-8">
          <BackLink />
          <h1 className="mt-4 text-[26px] font-bold">{meta.title}</h1>
          <p className="mt-1 text-sm text-muted">{meta.totalMarks} marks · {meta.durationMin} minutes · {new Date(meta.opensAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" })} to {new Date(meta.closesAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka", timeStyle: "short" })}</p>
          {meta.topics && <p className="card mt-5 p-4 text-sm">{Object.entries(meta.topics).map(([k, v]) => `${k[0].toUpperCase()}${k.slice(1)}: ${v}`).join(" · ")}</p>}
          {error && <p role="alert" className="mt-4 text-sm font-medium text-danger">{error}</p>}
          <div className="mt-6 flex flex-col gap-3">
            {!meta.access && <Link href={`/courses/${meta.courseSlug}/buy`} className="btn btn-primary">Buy course</Link>}
            {meta.access && live && !meta.submitted && <button onClick={start} className="btn btn-primary">{meta.joined ? "Continue exam" : "Start exam"}</button>}
            {meta.access && live && meta.submitted && <p className="text-muted">You submitted this exam. The result comes after it closes.</p>}
            {meta.status === "SCHEDULED" && <p className="text-muted">This exam is not open yet.</p>}
            {meta.access && closed && <button onClick={start} className="btn btn-primary">Practice (not ranked)</button>}
            {(meta.joined && (meta.submitted || closed)) && <Link href={`/exam/${id}/result`} className="btn btn-soft">My result</Link>}
            {meta.status === "RESULT_PUBLISHED" && <Link href={`/exam/${id}/merit`} className="btn btn-outline">Merit list</Link>}
          </div>
        </div>
      </AppShell>
    );
  }

  const subjects = ["ALL", ...Array.from(new Set(run.questions.map((q) => q.subject)))];
  const shown = run.questions.filter((q) => subject === "ALL" || q.subject === subject);
  const answered = Object.keys(locked).length;
  return (
    <AppShell>
      <div className="fixed left-0 right-0 top-0 z-30 mx-auto max-w-[480px] bg-page px-6 pb-3 pt-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><button onClick={() => router.push("/exams")} aria-label="Leave exam" className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-sm">←</button><h1 className="text-base font-bold">{meta.title}{run.practice ? " · Practice" : ""}</h1></div>
          <span className={`pill ${left < 300 ? "bg-danger text-white" : "bg-peach text-gold"}`}>{mmss(Math.max(0, left))}</span>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {subjects.map((s) => <button key={s} onClick={() => setSubject(s)} className={`pill shrink-0 ${subject === s ? "bg-navy text-white" : "bg-peach text-gold"}`}>{s === "ALL" ? `All ${run.questions.length}` : `${s} ${run.questions.filter((q) => q.subject === s).length}`}</button>)}
        </div>
        <p className="mt-2 text-xs text-muted">Once you pick an option, it is locked.</p>
        {error && <p role="alert" className="text-xs font-medium text-danger">{error}</p>}
      </div>
      <div className="flex flex-col gap-4 px-6 pb-28 pt-[168px]">
        {shown.map((q) => (
          <div key={q.id} className="card p-4">
            <p className="text-sm font-semibold text-gold">Q{q.no} · {q.subject}</p>
            <p className="mt-1 font-medium">{q.text}</p>
            <div className="mt-3 flex flex-col gap-2">
              {(["A", "B", "C", "D"] as const).map((c) => (
                <button key={c} onClick={() => pick(q, c)} className={`rounded-2xl border px-4 py-3 text-left ${locked[q.id] === c ? "border-navy bg-peach font-semibold" : "border-line"}`}>
                  <b className="mr-3">{c}</b>{q.options[c]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="fixed bottom-0 left-0 right-0 mx-auto flex max-w-[480px] items-center justify-between border-t border-line bg-white px-6 py-4">
        <div><p className="text-xs text-muted">Answered</p><p className="font-bold">{answered} / {run.questions.length}</p></div>
        <button className="btn btn-primary" onClick={() => confirm("Submit the exam now?") && finish(run.practice)}>Submit exam</button>
      </div>
    </AppShell>
  );
}
