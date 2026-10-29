"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Msg } from "./ui";

type Stats = { students: number; paid: number; pending: number; revenueThisMonth: number; live: { dayNo: number; takingNow: number } | null; participation: { dayNo: number; count: number }[]; recentPayments: { _id: string; status: string; method: string; trxId: string; amount: number; userId?: { name: string } }[] };

export function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Stats>("/admin/stats").then(setS).catch((e) => setError(e.message)); }, []);
  if (!s) return <><Msg text={error} /><div className="skeleton h-40" /></>;
  const max = Math.max(1, ...s.participation.map((p) => p.count));
  const cards = [["Total students", s.students, "bg-tint-yellow"], ["Paid students", s.paid, "bg-tint-mint"], ["Revenue this month", `৳${s.revenueThisMonth.toLocaleString("en-IN")}`, "bg-tint-lime"], ["Live now", s.live ? `Day ${s.live.dayNo}` : "None", "bg-tint-blue", s.live ? `${s.live.takingNow} taking the exam` : `${s.pending} payments pending`]] as const;
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">{cards.map(([l, v, c, sub]) => <div key={l} className={`rounded-2xl p-5 ${c}`}><p className="text-sm text-muted">{l}</p><p className="text-3xl font-bold">{v}</p>{sub && <p className="text-sm text-muted">{sub}</p>}</div>)}</div>
      <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="card p-5"><h3 className="font-bold">Participation per day</h3>
          <div className="mt-4 flex h-48 items-end gap-3">{s.participation.length === 0 && <p className="text-sm text-muted">Published results will show here.</p>}{s.participation.map((p) => <div key={p.dayNo} className="flex flex-1 flex-col items-center gap-1"><span className="text-xs">{p.count}</span><div className="w-full rounded-t-lg bg-gold" style={{ height: `${(p.count / max) * 100}%` }} /><span className="text-xs text-muted">D{p.dayNo}</span></div>)}</div></div>
        <div className="card p-5"><h3 className="font-bold">Recent payments</h3>
          <div className="mt-3 divide-y divide-line">{s.recentPayments.map((p) => <div key={p._id} className="flex justify-between py-3 text-sm"><span><b>{p.userId?.name}</b><br /><span className="text-muted">{p.method} · {p.trxId}</span></span><span className="text-right">৳{p.amount}<br /><span className="text-xs text-muted">{p.status}</span></span></div>)}</div></div>
      </div>
    </>
  );
}
