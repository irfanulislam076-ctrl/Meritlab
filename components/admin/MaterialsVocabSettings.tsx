"use client";
import { useCallback, useEffect, useState } from "react";
import { api, uploadFile } from "@/lib/api";
import { CourseSelect, L, Msg, useAdminCourses } from "./ui";

type M = { _id: string; title: string; type: string; dayNo?: number; pages?: number; isFree: boolean; visibleFrom?: string };

export function Materials() {
  const { courses } = useAdminCourses();
  const [courseId, setCourseId] = useState("");
  const [items, setItems] = useState<M[]>([]);
  const [f, setF] = useState({ title: "", type: "EXAM_PDF", dayNo: "", pages: "", isFree: false, visibleFrom: "" });
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (!courseId && courses[0]) setCourseId(courses[0]._id); }, [courses, courseId]);
  const load = useCallback(() => { if (courseId) api<{ materials: M[] }>(`/admin/materials?courseId=${courseId}`).then((d) => setItems(d.materials)).catch((e) => setMsg(e.message)); }, [courseId]);
  useEffect(() => { load(); }, [load]);

  async function upload() {
    setMsg("");
    try {
      if (!file) throw new Error("Choose a PDF first");
      const up = await uploadFile("/upload/pdf", file);
      await api("/admin/materials", "POST", { courseId, type: f.type, title: f.title, fileKey: up.publicId, isFree: f.isFree, ...(f.dayNo ? { dayNo: Number(f.dayNo) } : {}), ...(f.pages ? { pages: Number(f.pages) } : {}), ...(f.visibleFrom ? { visibleFrom: new Date(f.visibleFrom).toISOString() } : {}) });
      setFile(null); setF({ ...f, title: "" }); load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
  }
  return (
    <>
      <CourseSelect value={courseId} onChange={setCourseId} courses={courses} /><Msg text={msg} />
      <div className="card mt-3 grid gap-3 p-4 md:grid-cols-3">
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <L label="Title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></L>
        <L label="Type"><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{["EXAM_PDF", "SOLVE_SHEET", "SHORTCUT"].map((t) => <option key={t}>{t}</option>)}</select></L>
        <L label="Day"><input className="input" type="number" value={f.dayNo} onChange={(e) => setF({ ...f, dayNo: e.target.value })} /></L>
        <L label="Pages"><input className="input" type="number" value={f.pages} onChange={(e) => setF({ ...f, pages: e.target.value })} /></L>
        <L label="Visible from (blank = now)"><input className="input" type="datetime-local" value={f.visibleFrom} onChange={(e) => setF({ ...f, visibleFrom: e.target.value })} /></L>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isFree} onChange={(e) => setF({ ...f, isFree: e.target.checked })} /> Free for everyone</label>
        <button className="btn btn-primary md:col-span-2" onClick={upload}>Upload</button>
      </div>
      <div className="card mt-3 divide-y divide-line text-sm">{items.map((m) => (
        <div key={m._id} className="flex items-center justify-between p-3"><span><b>{m.title}</b> · {m.type}{m.dayNo ? ` · Day ${m.dayNo}` : ""}{m.visibleFrom ? ` · from ${new Date(m.visibleFrom).toLocaleString()}` : ""}</span>
          <button className="btn btn-outline" onClick={() => api(`/admin/materials/${m._id}`, "PATCH", { isFree: !m.isFree }).then(load)}>{m.isFree ? "Free" : "Course only"}</button></div>))}</div>
    </>
  );
}

type Preview = { saved: boolean; pages: number; words: number; preview: { dayNo: number; pageNo: number; words: { word: string; banglaMeaning: string; englishExplanation: string }[] }[] };
export function VocabImport() {
  const { courses } = useAdminCourses();
  const [courseId, setCourseId] = useState("");
  const [csv, setCsv] = useState("");
  const [p, setP] = useState<Preview | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (!courseId && courses[0]) setCourseId(courses[0]._id); }, [courses, courseId]);
  const run = async (dryRun: boolean) => { setMsg(""); try { const r = await api<Preview>("/admin/vocab/import", "POST", { courseId, csv, dryRun }); setP(r); if (!dryRun) setMsg(`Saved ${r.pages} pages (${r.words} words)`); } catch (e) { setP(null); setMsg(e instanceof Error ? e.message : "Failed"); } };
  return (
    <>
      <CourseSelect value={courseId} onChange={setCourseId} courses={courses} />
      <p className="mt-2 text-xs text-muted">CSV columns: course, day, page, word, Bangla meaning, English explanation. Up to 5 words per page, 10 pages per day.</p>
      <input className="mt-2 block" type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setCsv(await f.text()); setP(null); } }} />
      <textarea className="input mt-2 h-32 font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"course,day,page,word,bangla,english\nBank Job Prelim,1,1,abandon,পরিত্যাগ করা,to leave completely"} />
      <div className="mt-2 flex gap-2"><button className="btn btn-soft" onClick={() => run(true)} disabled={!csv}>Preview</button><button className="btn btn-primary" onClick={() => run(false)} disabled={!csv || !p}>Save</button></div>
      <Msg text={msg} />
      {p && <div className="mt-3 grid gap-3 md:grid-cols-2">{p.preview.map((pg) => <div key={`${pg.dayNo}-${pg.pageNo}`} className="card p-3 text-sm"><b>Day {pg.dayNo} · Page {pg.pageNo}</b>{pg.words.map((w) => <p key={w.word}>{w.word} · {w.banglaMeaning}</p>)}</div>)}<p className="text-sm text-muted md:col-span-2">{p.pages} pages, {p.words} words in total (first 5 pages shown).</p></div>}
    </>
  );
}

const KEYS = [["site_name", "Site name"], ["bkash_number", "bKash number"], ["nagad_number", "Nagad number"], ["support_contact", "Support contact"]] as const;
export function Settings() {
  const [v, setV] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  useEffect(() => { api<{ settings: Record<string, string> }>("/admin/settings").then((d) => setV(d.settings)).catch((e) => setMsg(e.message)); }, []);
  return (
    <div className="card max-w-lg space-y-3 p-4">
      {KEYS.map(([k, l]) => <L key={k} label={l}><input className="input" value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></L>)}
      <Msg text={msg} />
      <button className="btn btn-primary" onClick={() => api("/admin/settings", "PUT", v).then(() => setMsg("Saved")).catch((e) => setMsg(e.message))}>Save settings</button>
    </div>
  );
}
