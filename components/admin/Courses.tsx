"use client";
import { useEffect, useState } from "react";
import { api, uploadFile } from "@/lib/api";
import { L, Msg, dhakaDate, useAdminCourses, type AdminCourse } from "./ui";

type Cat = { _id: string; name: string };
type Day = { dayNo: number; type: string; topics: Record<string, string>; vocabFrom?: number; vocabTo?: number };
const SUBJ = ["BANGLA", "ENGLISH", "MATH", "GK", "ICT"];
const TOPIC_KEYS = ["bangla", "english", "math", "gk", "ict"];
const BLANK = { categoryId: "", title: "", description: "", thumbnailUrl: "", durationDays: 30, priceBdt: 499, freeDays: 1, startDate: dhakaDate(new Date().toISOString()), examOpenTime: "00:00", examCloseTime: "23:59", negativeMarking: 0.25, passMark: 60, subjectCounts: { BANGLA: 25, ENGLISH: 25, MATH: 20, GK: 20, ICT: 10 }, status: "DRAFT" };

function Routine({ course, onClose }: { course: AdminCourse; onClose: () => void }) {
  const [days, setDays] = useState<Day[]>([]);
  const [csv, setCsv] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { api<{ days: Day[] }>(`/admin/courses/${course._id}/routine`).then((d) => setDays(d.days)).catch((e) => setMsg(e.message)); }, [course._id]);
  const upd = (i: number, patch: Partial<Day>) => setDays((l) => l.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  function importCsv() {
    // day,type,bangla,english,math,gk,ict[,vocabFrom,vocabTo]  (type: TOPIC, FINAL, MODEL or MIXED)
    const rows = csv.split(/\r?\n/).map((r) => r.split(",").map((c) => c.trim())).filter((r) => /^\d+$/.test(r[0]));
    setDays(rows.map((r) => ({ dayNo: Number(r[0]), type: (r[1] || "TOPIC").toUpperCase(), topics: Object.fromEntries(TOPIC_KEYS.map((k, i) => [k, r[2 + i] ?? ""])), vocabFrom: r[7] ? Number(r[7]) : undefined, vocabTo: r[8] ? Number(r[8]) : undefined })));
    setMsg(`${rows.length} days loaded. Press Save routine.`);
  }
  async function save() {
    setMsg("");
    try { await api(`/admin/courses/${course._id}/routine`, "PUT", { days: days.map((d) => ({ dayNo: d.dayNo, type: d.type, topics: d.topics, vocabFrom: d.vocabFrom, vocabTo: d.vocabTo })) }); setMsg("Routine saved"); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
  }
  return (
    <div className="card mt-4 p-4">
      <div className="flex items-center justify-between"><h3 className="font-bold">Routine · {course.title}</h3><div className="flex gap-2"><button className="btn btn-soft" onClick={() => setDays([...days, { dayNo: (days.at(-1)?.dayNo ?? 0) + 1, type: "TOPIC", topics: {} }])}>Add day</button><button className="btn btn-primary" onClick={save}>Save routine</button><button className="btn btn-outline" onClick={onClose}>Close</button></div></div>
      <Msg text={msg} />
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
        <thead className="text-left text-gold"><tr><th>Day</th><th>Type</th>{TOPIC_KEYS.map((k) => <th key={k} className="capitalize">{k}</th>)}<th>Vocab</th></tr></thead>
        <tbody>{days.map((d, i) => (
          <tr key={d.dayNo} className="border-t border-line">
            <td className="py-1 pr-2 font-bold">{d.dayNo}</td>
            <td><select className="input !py-1" value={d.type} onChange={(e) => upd(i, { type: e.target.value })}>{["TOPIC", "FINAL", "MODEL", "MIXED"].map((t) => <option key={t}>{t}</option>)}</select></td>
            {TOPIC_KEYS.map((k) => <td key={k} className="px-1"><input className="input !py-1" value={d.topics?.[k] ?? ""} onChange={(e) => upd(i, { topics: { ...d.topics, [k]: e.target.value } })} /></td>)}
            <td className="text-xs text-muted">{d.vocabFrom ? `${d.vocabFrom}–${d.vocabTo}` : "—"}</td>
          </tr>))}</tbody>
      </table></div>
      <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-gold">Import from CSV</summary>
        <p className="mt-2 text-xs text-muted">One row per day: day,type,bangla,english,math,gk,ict,vocabFrom,vocabTo. Dates follow the course start date.</p>
        <textarea className="input mt-2 h-32 font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="1,TOPIC,Alphabet,Noun,Percentage,BD history,Hardware,1,50" />
        <button className="btn btn-soft mt-2" onClick={importCsv}>Load rows</button></details>
    </div>
  );
}

export function Courses() {
  const { courses, reload } = useAdminCourses();
  const [cats, setCats] = useState<Cat[]>([]);
  const [form, setForm] = useState<(typeof BLANK & { _id?: string }) | null>(null);
  const [routine, setRoutine] = useState<AdminCourse | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { api<{ categories: Cat[] }>("/admin/categories").then((d) => setCats(d.categories)).catch(() => {}); }, []);

  async function save() {
    if (!form) return;
    setMsg("");
    const { _id, ...rest } = form;
    const payload = { ...rest, thumbnailUrl: rest.thumbnailUrl || undefined, categoryId: rest.categoryId || cats[0]?._id };
    try { await (_id ? api(`/admin/courses/${_id}`, "PATCH", payload) : api("/admin/courses", "POST", payload)); setForm(null); reload(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
  }
  const set = (k: string, v: unknown) => setForm((f) => f && { ...f, [k]: v });
  const num = (k: string) => (e: { target: { value: string } }) => set(k, Number(e.target.value));

  return (
    <>
      <div className="mb-3 flex justify-end"><button className="btn btn-primary" onClick={() => setForm({ ...BLANK, categoryId: cats[0]?._id ?? "" })}>+ Create course</button></div>
      <div className="card overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="bg-peach text-gold"><tr>{["Course", "Days", "Price", "Students", "Status", ""].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
        <tbody>{courses.map((c) => (
          <tr key={c._id} className="border-t border-line"><td className="p-3 font-semibold">{c.title}</td><td className="p-3">{c.durationDays}</td><td className="p-3">৳{c.priceBdt}</td><td className="p-3">{c.students}</td><td className="p-3">{c.status}</td>
            <td className="flex gap-2 p-3"><button className="btn btn-outline" onClick={() => setForm({ ...BLANK, ...c, startDate: dhakaDate(c.startDate), thumbnailUrl: c.thumbnailUrl ?? "" } as never)}>Edit</button><button className="btn btn-soft" onClick={() => setRoutine(c)}>Routine</button></td></tr>))}</tbody>
      </table></div>
      {routine && <Routine course={routine} onClose={() => setRoutine(null)} />}
      {form && (
        <div className="card mt-4 grid gap-3 p-5 md:grid-cols-2">
          <h3 className="font-bold md:col-span-2">{form._id ? "Edit course" : "Create course"}</h3>
          <L label="Course name"><input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} /></L>
          <L label="Category"><select className="input" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>{cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></L>
          <div className="md:col-span-2"><L label="Description"><textarea className="input h-24" value={form.description} onChange={(e) => set("description", e.target.value)} /></L></div>
          <L label="Duration (days)"><input className="input" type="number" value={form.durationDays} onChange={num("durationDays")} /></L>
          <L label="Price (BDT)"><input className="input" type="number" value={form.priceBdt} onChange={num("priceBdt")} /></L>
          <L label="Start date"><input className="input" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></L>
          <L label="Free days"><input className="input" type="number" value={form.freeDays} onChange={num("freeDays")} /></L>
          <L label="Exam goes live at"><input className="input" type="time" value={form.examOpenTime} onChange={(e) => set("examOpenTime", e.target.value)} /></L>
          <L label="Auto close at"><input className="input" type="time" value={form.examCloseTime} onChange={(e) => set("examCloseTime", e.target.value)} /></L>
          <L label="Negative marking per wrong"><input className="input" type="number" step="0.05" value={form.negativeMarking} onChange={num("negativeMarking")} /></L>
          <L label="Pass mark"><input className="input" type="number" value={form.passMark} onChange={num("passMark")} /></L>
          <div className="grid grid-cols-5 gap-2 md:col-span-2">{SUBJ.map((s) => <L key={s} label={`${s} count`}><input className="input" type="number" value={form.subjectCounts[s]} onChange={(e) => set("subjectCounts", { ...form.subjectCounts, [s]: Number(e.target.value) })} /></L>)}</div>
          <L label="Status"><select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>{["DRAFT", "LIVE", "ARCHIVED"].map((s) => <option key={s}>{s}</option>)}</select></L>
          <L label="Thumbnail"><input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { set("thumbnailUrl", (await uploadFile("/upload/image", f)).url); } catch (err) { setMsg(err instanceof Error ? err.message : "Upload failed"); } } }} /></L>
          <div className="md:col-span-2"><Msg text={msg} /><div className="flex gap-2"><button className="btn btn-primary" onClick={save}>Save</button><button className="btn btn-outline" onClick={() => setForm(null)}>Cancel</button></div></div>
        </div>
      )}
    </>
  );
}
