"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CourseSelect, Msg, useAdminCourses } from "./ui";

type S = { _id: string; name: string; mobile: string; email: string; blocked: boolean };
type Detail = { student: S; enrollments: { _id: string; courseId?: { title: string } }[]; payments: { _id: string; status: string; method: string; trxId: string; amount: number; courseId?: { title: string } }[]; results: { _id: string; score: number; rank?: number; examId?: { title: string } }[] };

export function Students() {
  const { courses } = useAdminCourses();
  const [q, setQ] = useState("");
  const [list, setList] = useState<S[]>([]);
  const [d, setD] = useState<Detail | null>(null);
  const [courseId, setCourseId] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { const t = setTimeout(() => api<{ students: S[] }>(`/admin/students?search=${encodeURIComponent(q)}`).then((r) => setList(r.students)).catch((e) => setMsg(e.message)), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (!courseId && courses[0]) setCourseId(courses[0]._id); }, [courses, courseId]);

  const open = (id: string) => api<Detail>(`/admin/students/${id}`).then(setD).catch((e) => setMsg(e.message));
  async function act(path: string, body?: unknown) {
    setMsg("");
    try { await api(`/admin/students/${d!.student._id}/${path}`, "POST", body); await open(d!.student._id); setMsg("Done"); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
  }
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
      <div><input className="input" placeholder="Search by name, mobile or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="card mt-3 divide-y divide-line">{list.map((s) => <button key={s._id} onClick={() => open(s._id)} className="block w-full p-3 text-left text-sm"><b>{s.name}</b>{s.blocked && " · blocked"}<br /><span className="text-muted">{s.mobile} · {s.email}</span></button>)}{list.length === 0 && <p className="p-3 text-sm text-muted">No students.</p>}</div></div>
      <div>{msg && <Msg text={msg} />}
        {d && (
          <div className="card space-y-4 p-4 text-sm">
            <div><h3 className="text-lg font-bold">{d.student.name}</h3><p className="text-muted">{d.student.mobile} · {d.student.email}</p></div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-outline" onClick={() => act("block", { blocked: !d.student.blocked })}>{d.student.blocked ? "Unblock" : "Block"}</button>
              <button className="btn btn-outline" onClick={() => { const p = prompt("New password (min 8 characters)"); if (p) act("reset-password", { newPassword: p }); }}>Reset password</button>
              <CourseSelect value={courseId} onChange={setCourseId} courses={courses} /><button className="btn btn-soft" onClick={() => act("grant", { courseId })}>Grant free access</button>
            </div>
            <div><b>Courses</b>{d.enrollments.map((e) => <p key={e._id}>{e.courseId?.title}</p>)}{d.enrollments.length === 0 && <p className="text-muted">None</p>}</div>
            <div><b>Payments</b>{d.payments.map((p) => <p key={p._id}>{p.courseId?.title} · {p.method} {p.trxId} · ৳{p.amount} · {p.status}</p>)}</div>
            <div><b>Results</b>{d.results.map((r) => <p key={r._id}>{r.examId?.title} · {r.score} · rank {r.rank ?? "-"}</p>)}</div>
          </div>)}</div>
    </div>
  );
}
