"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { L, Msg } from "./ui";

type Q = { _id?: string; no: number; subject: string; topic?: string; text: string; options: Record<"A" | "B" | "C" | "D", string>; answer: string; explanation?: string; shortcut?: string };
const SUBJECTS = ["BANGLA", "ENGLISH", "MATH", "GK", "ICT"];
const blank = (no: number): Q => ({ no, subject: "BANGLA", text: "", options: { A: "", B: "", C: "", D: "" }, answer: "A", explanation: "", shortcut: "" });
const SAMPLE = `{"questions":[{"no":1,"subject":"MATH","text":"What is 25% of 480?","options":{"A":"100","B":"120","C":"140","D":"160"},"answer":"B","explanation":"25% = 1/4, so 480 / 4 = 120.","shortcut":"25% means divide by 4."}]}`;

export function QuestionBank({ exam, target }: { exam: { _id: string; title: string }; target: number }) {
  const [list, setList] = useState<Q[]>([]);
  const [cur, setCur] = useState<Q | null>(null);
  const [json, setJson] = useState(SAMPLE);
  const [msg, setMsg] = useState("");
  const load = useCallback(() => api<{ questions: Q[] }>(`/admin/exams/${exam._id}/questions`).then((d) => setList(d.questions)).catch((e) => setMsg(e.message)), [exam._id]);
  useEffect(() => { setCur(null); load(); }, [load]);

  const missing = list.filter((q) => !q.explanation?.trim()).length;
  async function save(questions: unknown[], done?: string) {
    setMsg("");
    try { await api(`/admin/exams/${exam._id}/questions`, "POST", { questions }); setMsg(done ?? "Saved"); await load(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
  }
  const set = (patch: Partial<Q>) => setCur((c) => c && { ...c, ...patch });

  return (
    <div className="card mt-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold">Question bank · {exam.title}</h3>
        <span className={`pill ${list.length >= target ? "bg-tint-mint text-success" : "bg-tint-yellow text-gold"}`}>{list.length} / {target} questions</span>
        {missing > 0 && <span className="pill bg-tint-rose text-danger">{missing} need explanation</span>}
        <button className="btn btn-soft ml-auto" onClick={() => setCur(blank((list.at(-1)?.no ?? 0) + 1))}>+ New question</button>
      </div>
      <Msg text={msg} />
      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_1.6fr]">
        <div className="max-h-[480px] divide-y divide-line overflow-y-auto rounded-2xl border border-line">
          {list.map((q) => (
            <button key={q.no} onClick={() => setCur({ ...q })} className={`block w-full p-3 text-left text-sm ${cur?.no === q.no ? "bg-peach" : ""}`}>
              <b>Q{q.no} · {q.subject}</b><br /><span className="line-clamp-1 text-muted">{q.text}</span>
            </button>))}
          {list.length === 0 && <p className="p-3 text-sm text-muted">No questions yet.</p>}
        </div>
        {cur ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <L label="Question no"><input className="input" type="number" value={cur.no} onChange={(e) => set({ no: Number(e.target.value) })} /></L>
              <L label="Subject"><select className="input" value={cur.subject} onChange={(e) => set({ subject: e.target.value })}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></L>
              <L label="Topic"><input className="input" value={cur.topic ?? ""} onChange={(e) => set({ topic: e.target.value })} /></L>
            </div>
            <L label="Question"><textarea className="input h-20" value={cur.text} onChange={(e) => set({ text: e.target.value })} /></L>
            <div className="grid grid-cols-2 gap-3">{(["A", "B", "C", "D"] as const).map((k) => <L key={k} label={`Option ${k}${cur.answer === k ? " (correct)" : ""}`}><input className="input" value={cur.options[k]} onChange={(e) => set({ options: { ...cur.options, [k]: e.target.value } })} /></L>)}</div>
            <L label="Correct answer"><select className="input max-w-[140px]" value={cur.answer} onChange={(e) => set({ answer: e.target.value })}>{["A", "B", "C", "D"].map((k) => <option key={k}>{k}</option>)}</select></L>
            <L label="Explanation (why the answer is right and why the others are wrong)"><textarea className="input h-28" value={cur.explanation ?? ""} onChange={(e) => set({ explanation: e.target.value })} /></L>
            <L label="Shortcut (optional)"><input className="input" value={cur.shortcut ?? ""} onChange={(e) => set({ shortcut: e.target.value })} /></L>
            <button className="btn btn-primary" onClick={() => save([{ no: cur.no, subject: cur.subject, topic: cur.topic || undefined, text: cur.text, options: cur.options, answer: cur.answer, explanation: cur.explanation || undefined, shortcut: cur.shortcut || undefined }])}>Save question</button>
          </div>
        ) : <p className="text-sm text-muted">Pick a question or add a new one.</p>}
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-gold">Upload JSON</summary>
        <p className="mt-2 text-xs text-muted">Paste {"{ \"questions\": [ ... ] }"}. The same question number replaces the old one.</p>
        <textarea className="input mt-2 h-40 font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} />
        <button className="btn btn-soft mt-2" onClick={() => { try { save(JSON.parse(json).questions, "Uploaded"); } catch { setMsg("That is not valid JSON"); } }}>Upload</button>
      </details>
    </div>
  );
}
