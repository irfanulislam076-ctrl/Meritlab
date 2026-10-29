"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Courses } from "@/components/admin/Courses";
import { Dashboard } from "@/components/admin/Dashboard";
import { Materials, Settings, VocabImport } from "@/components/admin/MaterialsVocabSettings";
import { NoticesCategories } from "@/components/admin/NoticesCategories";
import { QuestionBank } from "@/components/admin/QuestionBank";
import { Students } from "@/components/admin/Students";

type Payment = { _id: string; status: string; method: string; trxId: string; amount: number; senderNumber: string; rejectReason?: string; userId?: { name: string; mobile: string }; courseId?: { title: string } };
type Exam = { _id: string; questionExamId: string; title: string; dayNo: number; status: string; manualOverride?: boolean; questionCount: number };
type AdminCourse = { _id: string; title: string; students: number; status: string; subjectCounts?: Record<string, number> };


function Login() {
  const { startSession } = useAuth();
  const [f, setF] = useState({ email: "", password: "", code: "" });
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    try {
      const d = await api<{ needsCode?: boolean; user?: User; accessToken?: string }>("/admin/login", "POST", { email: f.email, password: f.password, ...(needsCode ? { code: f.code } : {}) });
      if (d.accessToken && d.user) startSession({ user: d.user, accessToken: d.accessToken });
      else setNeedsCode(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-center bg-navy p-16 text-white md:flex">
        <h1 className="text-4xl font-bold">Meritlab Admin</h1>
        <p className="mt-4 opacity-70">Create courses, schedule live exams, upload questions and approve payments from one place.</p>
      </div>
      <form onSubmit={submit} className="mx-auto flex w-full max-w-sm flex-col justify-center gap-4 p-8">
        <h2 className="text-2xl font-bold">Admin sign in</h2>
        <input className="input" type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <input className="input" type="password" placeholder="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        {needsCode && <input className="input" inputMode="numeric" maxLength={6} placeholder="6-digit code from your email" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, "") })} required />}
        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        <button className="btn btn-primary">{needsCode ? "Sign in" : "Send code"}</button>
      </form>
    </div>
  );
}

function Payments() {
  const [tab, setTab] = useState("PENDING");
  const [rows, setRows] = useState<Payment[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => api<{ payments: Payment[] }>(`/admin/payments?status=${tab}`).then((d) => setRows(d.payments)).catch((e) => setError(e.message)), [tab]);
  useEffect(() => { load(); }, [load]);

  async function act(p: Payment, action: "approve" | "reject") {
    setError("");
    const reason = action === "reject" ? prompt("Reason for rejecting?") : undefined;
    if (action === "reject" && !reason) return;
    try { await api(`/admin/payments/${p._id}/${action}`, "POST", reason ? { reason } : undefined); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <>
      <div className="flex gap-2">{["PENDING", "APPROVED", "REJECTED"].map((t) => <button key={t} onClick={() => setTab(t)} className={`pill ${tab === t ? "bg-navy text-white" : "bg-white"}`}>{t}</button>)}</div>
      {error && <p role="alert" className="mt-3 text-danger">{error}</p>}
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-peach text-gold"><tr>{["Student", "Course", "Payment", "From", "Amount", ""].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>
            {rows?.map((p) => (
              <tr key={p._id} className="border-t border-line">
                <td className="p-3 font-semibold">{p.userId?.name}<br /><span className="font-normal text-muted">{p.userId?.mobile}</span></td>
                <td className="p-3">{p.courseId?.title}</td>
                <td className="p-3">{p.method} · {p.trxId}</td>
                <td className="p-3">{p.senderNumber}</td>
                <td className="p-3">৳{p.amount}</td>
                <td className="p-3">{p.status === "PENDING" ? <span className="flex gap-2"><button className="btn btn-primary" onClick={() => act(p, "approve")}>Approve</button><button className="btn btn-outline" onClick={() => act(p, "reject")}>Reject</button></span> : p.rejectReason ?? ""}</td>
              </tr>
            ))}
            {rows?.length === 0 && <tr><td className="p-4 text-muted" colSpan={6}>Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Exams() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [courseId, setCourseId] = useState("");
  const [exams, setExams] = useState<Exam[]>([]);
  const [target, setTarget] = useState<Exam | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => { api<{ courses: AdminCourse[] }>("/admin/courses").then((d) => { setCourses(d.courses); setCourseId(d.courses[0]?._id ?? ""); }).catch((e) => setMsg(e.message)); }, []);
  const load = useCallback(() => { if (courseId) api<{ exams: Exam[] }>(`/admin/exams?courseId=${courseId}`).then((d) => setExams(d.exams)).catch((e) => setMsg(e.message)); }, [courseId]);
  useEffect(() => { load(); }, [load]);

  async function control(e: Exam, action: string) {
    setMsg("");
    try { await api(`/admin/exams/${e._id}/${action}`, "POST"); load(); } catch (err) { setMsg(err instanceof Error ? err.message : "Failed"); }
  }
  return (
    <>
      <select className="input max-w-sm" value={courseId} onChange={(e) => setCourseId(e.target.value)}>{courses.map((c) => <option key={c._id} value={c._id}>{c.title} ({c.students} students)</option>)}</select>
      {msg && <p role="alert" className="mt-3 text-sm font-medium text-danger">{msg}</p>}
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-peach text-gold"><tr>{["Exam", "Status", "Questions", "Control"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>
            {exams.map((e) => (
              <tr key={e._id} className="border-t border-line">
                <td className="p-3 font-semibold">{e.title}</td>
                <td className="p-3">{e.status}{e.manualOverride ? " (manual)" : ""}</td>
                <td className="p-3">{e.questionCount}</td>
                <td className="p-3"><span className="flex flex-wrap gap-2">
                  {[["open", "Open now"], ["close", "Close now"], ["publish", "Publish result"], ["unpublish", "Unpublish"], ["auto", "Back to auto"]].map(([a, l]) => <button key={a} className="btn btn-outline" onClick={() => control(e, a)}>{l}</button>)}
                  <button className="btn btn-soft" onClick={() => setTarget(e)}>Questions</button>
                </span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {target && <QuestionBank exam={{ _id: target.questionExamId, title: target.title }} target={Object.values(courses.find((c) => c._id === courseId)?.subjectCounts ?? { total: 100 }).reduce((x, y) => x + y, 0)} />}
    </>
  );
}

const TABS = [["dashboard", "Dashboard"], ["courses", "Courses and routine"], ["exams", "Exams and questions"], ["payments", "Payments"], ["students", "Students"], ["notices", "Notices and categories"], ["materials", "PDFs"], ["vocab", "Vocabulary import"], ["settings", "Settings"]] as const;

export default function AdminPage() {
  const { user, ready, logout } = useAuth();
  const [tab, setTab] = useState("dashboard");
  if (!ready) return <div className="skeleton m-8 h-40" />;
  if (!user || user.role === "STUDENT") return <Login />;
  return (
    <div className="min-h-screen md:flex">
      <aside className="flex flex-col gap-1 bg-navy p-4 text-white md:min-h-screen md:w-64">
        <h1 className="mb-4 px-3 text-xl font-bold">Meritlab Admin</h1>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-xl px-3 py-2 text-left text-sm ${tab === k ? "bg-peach font-bold text-navy" : "text-white/80 hover:bg-white/10"}`}>{l}</button>)}
        </nav>
        <div className="mt-auto hidden px-3 pt-6 text-xs text-white/60 md:block">Signed in as {user.email}<br />{user.role}<button className="mt-3 block font-semibold text-white underline" onClick={logout}>Log out</button></div>
      </aside>
      <main className="min-w-0 flex-1 bg-page p-6">
        <h2 className="mb-5 text-2xl font-bold">{TABS.find(([k]) => k === tab)?.[1]}</h2>
        {tab === "dashboard" && <Dashboard />}
        {tab === "courses" && <Courses />}
        {tab === "exams" && <Exams />}
        {tab === "payments" && <Payments />}
        {tab === "students" && <Students />}
        {tab === "notices" && <NoticesCategories />}
        {tab === "materials" && <Materials />}
        {tab === "vocab" && <VocabImport />}
        {tab === "settings" && <Settings />}
        <button className="btn btn-outline mt-8 md:hidden" onClick={logout}>Log out</button>
      </main>
    </div>
  );
}
