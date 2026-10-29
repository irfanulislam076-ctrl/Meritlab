"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { L, Msg, useAdminCourses } from "./ui";

type Cat = { _id: string; name: string; hidden: boolean; sortOrder: number };
type Notice = { _id: string; title: string; body: string; createdAt: string; courseId?: { title: string } };

export function NoticesCategories() {
  const { courses } = useAdminCourses();
  const [cats, setCats] = useState<Cat[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [f, setF] = useState({ courseId: "", title: "", body: "", email: false });
  const [msg, setMsg] = useState("");
  const load = useCallback(() => {
    api<{ categories: Cat[] }>("/admin/categories").then((d) => setCats(d.categories)).catch((e) => setMsg(e.message));
    api<{ notices: Notice[] }>("/admin/notices").then((d) => setNotices(d.notices)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<unknown>) => { setMsg(""); try { await fn(); load(); } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); } };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card p-4"><h3 className="font-bold">Categories</h3><Msg text={msg} />
        {cats.map((c, i) => (
          <div key={c._id} className="mt-2 flex items-center justify-between rounded-xl bg-peach/50 p-3 text-sm">
            <b className={c.hidden ? "text-muted line-through" : ""}>{c.name}</b>
            <span className="flex gap-1">
              <button className="btn btn-outline !px-2" disabled={i === 0} onClick={() => run(async () => { await api(`/admin/categories/${c._id}`, "PATCH", { sortOrder: cats[i - 1].sortOrder }); await api(`/admin/categories/${cats[i - 1]._id}`, "PATCH", { sortOrder: c.sortOrder }); })}>↑</button>
              <button className="btn btn-outline !px-2" onClick={() => { const n = prompt("Rename category", c.name); if (n) run(() => api(`/admin/categories/${c._id}`, "PATCH", { name: n })); }}>Rename</button>
              <button className="btn btn-outline !px-2" onClick={() => run(() => api(`/admin/categories/${c._id}`, "PATCH", { hidden: !c.hidden }))}>{c.hidden ? "Show" : "Hide"}</button>
            </span>
          </div>))}
        <button className="btn btn-soft mt-3 w-full" onClick={() => { const n = prompt("Category name"); if (n) run(() => api("/admin/categories", "POST", { name: n, sortOrder: (cats.at(-1)?.sortOrder ?? 0) + 1 })); }}>+ Add category</button>
      </div>
      <div className="card p-4"><h3 className="font-bold">New notice</h3>
        <div className="mt-3 flex flex-col gap-3">
          <L label="Send to"><select className="input" value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}><option value="">All students</option>{courses.map((c) => <option key={c._id} value={c._id}>All students of {c.title}</option>)}</select></L>
          <L label="Title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></L>
          <textarea className="input h-28" placeholder="Message" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.email} onChange={(e) => setF({ ...f, email: e.target.checked })} /> Also send by email (Brevo)</label>
          <button className="btn btn-primary" onClick={() => run(async () => { await api("/admin/notices", "POST", { title: f.title, body: f.body, email: f.email, ...(f.courseId ? { courseId: f.courseId } : {}) }); setF({ ...f, title: "", body: "" }); })}>Publish notice</button>
        </div>
        <div className="mt-4 divide-y divide-line text-sm">{notices.map((n) => <div key={n._id} className="py-2"><b>{n.title}</b> <span className="text-muted">· {n.courseId?.title ?? "All"}</span></div>)}</div>
      </div>
    </div>
  );
}
