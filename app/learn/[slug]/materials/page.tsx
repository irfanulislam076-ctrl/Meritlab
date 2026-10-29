"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BottomNav } from "@/components/student/BottomNav";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type M = { id: string; title: string; type: string; dayNo?: number; pages?: number; isFree: boolean; locked: boolean };
const TYPES = [["", "All"], ["EXAM_PDF", "Exam PDF"], ["SOLVE_SHEET", "Solve sheet"], ["SHORTCUT", "Shortcuts"]];

export default function MaterialsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useRequireAuth();
  const [items, setItems] = useState<M[] | null>(null);
  const [type, setType] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { if (user) api<{ materials: M[] }>(`/courses/${slug}/materials`).then((d) => setItems(d.materials)).catch((e) => setError(e.message)); }, [slug, user]);

  async function open(m: M) {
    setError("");
    try { const d = await api<{ url: string }>(`/materials/${m.id}/url`); window.open(d.url, "_blank", "noopener"); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not open"); }
  }

  return (
    <AppShell>
      <div className="px-6 pb-24 pt-8">
        <Link href={`/learn/${slug}`} className="mb-3 inline-flex rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-navy shadow-sm">← Back</Link>
        <h1 className="mt-4 text-[26px] font-bold">PDFs and Solve sheets</h1>
        <div className="mt-3 flex gap-2 overflow-x-auto">{TYPES.map(([v, l]) => <button key={v} onClick={() => setType(v)} className={`pill shrink-0 ${type === v ? "bg-navy text-white" : "bg-peach text-gold"}`}>{l}</button>)}</div>
        {error && <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p>}
        <div className="mt-4 flex flex-col gap-3">
          {!items && <div className="skeleton h-20" />}
          {items?.length === 0 && <p className="text-muted">No files yet.</p>}
          {items?.filter((m) => !type || m.type === type).map((m) => (
            <button key={m.id} onClick={() => (m.locked ? setError("Buy the course to open this file") : open(m))} className="card flex items-center gap-4 p-4 text-left">
              <span className="rounded-lg bg-danger px-2 py-1 text-xs font-bold text-white">PDF</span>
              <span className="flex-1"><b>{m.title}</b><br /><span className="text-sm text-muted">{m.dayNo ? `Day ${m.dayNo}` : ""}{m.pages ? ` · ${m.pages} pages` : ""}</span></span>
              <span className={`pill ${m.isFree ? "bg-tint-mint text-success" : "bg-tint-yellow text-gold"}`}>{m.isFree ? "Free" : "Course"}</span>
            </button>
          ))}
        </div>
      </div>
      <BottomNav />
    </AppShell>
  );
}
