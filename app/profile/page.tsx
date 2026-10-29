"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BottomNav } from "@/components/student/BottomNav";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type Enr = { _id: string; expiresAt?: string; courseId: { title: string; slug: string } };
type Pay = { _id: string; status: string; method: string; amount: number; trxId: string; rejectReason?: string; courseId?: { title: string } };

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useRequireAuth();
  const [enr, setEnr] = useState<Enr[]>([]);
  const [pays, setPays] = useState<Pay[]>([]);

  useEffect(() => {
    if (!user) return;
    api<{ enrollments: Enr[] }>("/me/enrollments").then((d) => setEnr(d.enrollments)).catch(() => {});
    api<{ payments: Pay[] }>("/me/payments").then((d) => setPays(d.payments)).catch(() => {});
  }, [user]);

  if (!user) return <AppShell><div className="skeleton m-6 h-40" /></AppShell>;
  return (
    <AppShell>
      <div className="px-6 pb-24 pt-8">
        <h1 className="text-[26px] font-bold">Profile</h1>
        <dl className="card mt-5 divide-y divide-line px-5">
          {([["Name", user.name], ["Email", user.email], ["Mobile", user.mobile]] as const).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-4 text-sm"><dt className="text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>
          ))}
        </dl>
        <h2 className="mt-6 font-bold">My courses</h2>
        <div className="mt-2 flex flex-col gap-2">
          {enr.length === 0 && <p className="text-sm text-muted">No paid course yet. Day 1 of every course is free.</p>}
          {enr.map((e) => {
            const ended = !!e.expiresAt && new Date(e.expiresAt) < new Date();
            return (
              <Link key={e._id} href={ended ? `/courses/${e.courseId.slug}` : `/learn/${e.courseId.slug}`} className="card block p-4">
                <b>{e.courseId.title}</b>
                <p className={`text-sm ${ended ? "text-danger" : "text-success"}`}>{e.expiresAt ? `${ended ? "Expired on" : "Active until"} ${new Date(e.expiresAt).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "long" })}${ended ? " · Renew" : ""}` : "Active"}</p>
              </Link>
            );
          })}
        </div>
        {pays.length > 0 && <>
          <h2 className="mt-6 font-bold">Payments</h2>
          <div className="mt-2 flex flex-col gap-2">
            {pays.map((p) => (
              <div key={p._id} className="card p-4 text-sm">
                <div className="flex justify-between"><b>{p.courseId?.title}</b><span className={`pill ${p.status === "APPROVED" ? "bg-tint-mint text-success" : p.status === "REJECTED" ? "bg-tint-rose text-danger" : "bg-tint-yellow text-gold"}`}>{p.status}</span></div>
                <p className="text-muted">{p.method} · {p.trxId} · ৳{p.amount}</p>
                {p.rejectReason && <p className="text-danger">Reason: {p.rejectReason}</p>}
              </div>
            ))}
          </div>
        </>}
        <Link href="/notices" className="btn btn-soft mt-6 w-full">Notices</Link>
        <button className="btn btn-outline mt-3 w-full" onClick={async () => { await logout(); router.replace("/"); }}>Log out</button>
      </div>
      <BottomNav />
    </AppShell>
  );
}
