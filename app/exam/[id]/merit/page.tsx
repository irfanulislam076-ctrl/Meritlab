"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BackLink } from "@/components/student/BackLink";
import { BottomNav } from "@/components/student/BottomNav";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type Data = { rows: { rank: number; name: string; score: number; me: boolean }[]; me: { rank: number; score: number } | null };

export default function MeritPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useRequireAuth();
  const [d, setD] = useState<Data | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => api<Data>(`/exams/${id}/merit${q ? `?search=${encodeURIComponent(q)}` : ""}`).then(setD).catch((e) => setError(e.message)), 250);
    return () => clearTimeout(t);
  }, [id, user, q]);

  return (
    <AppShell>
      <div className="px-6 pb-24 pt-8">
        <BackLink />
        <h1 className="text-[26px] font-bold">Merit list</h1>
        <input className="input mt-4" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
        {error && <p role="alert" className="mt-4 text-danger">{error}</p>}
        <div className="card mt-4 divide-y divide-line">
          {d?.rows.map((r) => (
            <div key={r.rank} className={`flex items-center gap-4 px-4 py-3 ${r.me ? "bg-peach font-bold" : ""}`}>
              <span className="w-10">{r.rank}</span><span className="flex-1">{r.me ? `You · ${r.name}` : r.name}</span><span className="font-bold">{r.score?.toFixed(2)}</span>
            </div>
          ))}
          {d && d.rows.length === 0 && <p className="p-4 text-muted">No results.</p>}
        </div>
        {d?.me && !d.rows.some((r) => r.me) && <p className="mt-3 text-sm text-muted">Your rank: {d.me.rank} · {d.me.score?.toFixed(2)}</p>}
      </div>
      <BottomNav />
    </AppShell>
  );
}
