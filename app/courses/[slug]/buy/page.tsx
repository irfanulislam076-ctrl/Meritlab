"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthLayout, Field, FormError } from "@/components/auth/AuthLayout";
import { api, type Course } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

export default function BuyPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useRequireAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [nums, setNums] = useState<Record<string, string>>({});
  const [f, setF] = useState({ method: "BKASH", trxId: "", senderNumber: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const router = useRouter();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api<{ course: Course }>(`/courses/${slug}`).then((d) => setCourse(d.course)).catch((e) => setError(e.message));
    api<{ settings: Record<string, string> }>("/settings/public").then((d) => setNums(d.settings)).catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (!user) return;
    api<{ enrolled: boolean; pending: boolean }>(`/courses/${slug}/status`).then((st) => { if (st.enrolled) router.replace(`/learn/${slug}`); else setPending(st.pending); }).catch(() => {});
  }, [slug, user, router]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    try {
      await api("/payments", "POST", { courseId: course!._id, ...f });
      setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  if (!user || !course) return <AuthLayout back={`/courses/${slug}`} title="Buy course">{error ? <FormError message={error} /> : <div className="skeleton h-40" />}</AuthLayout>;
  if (pending && !done) return (
    <AuthLayout back={`/courses/${slug}`} title="Payment waiting for approval" subtitle="We already have your payment. An admin will verify it and email you once it is confirmed.">
      <Link href={`/learn/${slug}`} className="btn btn-primary w-full">Open free Day 1</Link>
    </AuthLayout>
  );
  if (done) return (
    <AuthLayout back={`/courses/${slug}`} title="Payment submitted" subtitle="Thank you! We emailed you a confirmation. An admin will verify the transaction and email you again once it is approved.">
      <Link href={`/learn/${slug}`} className="btn btn-primary w-full">Go to course</Link>
    </AuthLayout>
  );
  const to = f.method === "BKASH" ? nums.bkash_number : nums.nagad_number;
  return (
    <AuthLayout back={`/courses/${slug}`} title={`Buy · ৳${course.priceBdt}`} subtitle={course.title}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex gap-2">
          {(["BKASH", "NAGAD"] as const).map((m) => (
            <button type="button" key={m} onClick={() => setF({ ...f, method: m })} className={`pill ${f.method === m ? "bg-navy text-white" : "bg-peach text-gold"}`}>{m === "BKASH" ? "bKash" : "Nagad"}</button>
          ))}
        </div>
        <p className="card p-4 text-sm">Send <b>৳{course.priceBdt}</b> (Send Money) to <b>{to || "..."}</b>, then enter the details below.</p>
        <Field label="Transaction ID (TrxID)" value={f.trxId} onChange={(e) => setF({ ...f, trxId: e.target.value })} required minLength={6} />
        <Field label="Number you paid from" type="tel" placeholder="01XXXXXXXXX" value={f.senderNumber} onChange={(e) => setF({ ...f, senderNumber: e.target.value })} required />
        <FormError message={error} />
        <button className="btn btn-primary w-full">Submit payment</button>
      </form>
    </AuthLayout>
  );
}
