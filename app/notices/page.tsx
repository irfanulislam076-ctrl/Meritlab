"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BottomNav } from "@/components/student/BottomNav";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type N = { _id: string; title: string; body: string; createdAt: string };

export default function NoticesPage() {
  const { user } = useRequireAuth();
  const [items, setItems] = useState<N[] | null>(null);
  useEffect(() => { if (user) api<{ notices: N[] }>("/notices").then((d) => setItems(d.notices)).catch(() => setItems([])); }, [user]);
  return (
    <AppShell>
      <div className="px-6 pb-24 pt-8">
        <Link href="/profile" className="mb-3 inline-flex rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-navy shadow-sm">← Back</Link>
        <h1 className="mt-4 text-[26px] font-bold">Notices</h1>
        <div className="mt-4 flex flex-col gap-3">
          {!items && <div className="skeleton h-24" />}
          {items?.length === 0 && <p className="text-muted">No notices yet.</p>}
          {items?.map((n) => (
            <div key={n._id} className="card p-4">
              <p className="text-xs text-muted">{new Date(n.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" })}</p>
              <h2 className="mt-1 font-bold">{n.title}</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{n.body}</p>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </AppShell>
  );
}
