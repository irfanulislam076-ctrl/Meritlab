"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthLayout, Field, FormError } from "@/components/auth/AuthLayout";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", mobile: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api("/auth/register", "POST", f);
      router.push(`/verify?email=${encodeURIComponent(f.email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <AuthLayout back="/" title="Create your account" subtitle="We will email you a 6 digit code."
      footer={<>Already have an account? <Link href="/login" className="font-semibold text-navy">Log in</Link></>}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Full name" value={f.name} onChange={set("name")} required autoComplete="name" />
        <Field label="Mobile" type="tel" placeholder="01XXXXXXXXX" value={f.mobile} onChange={set("mobile")} required autoComplete="tel" />
        <Field label="Email" type="email" value={f.email} onChange={set("email")} required autoComplete="email" />
        <Field label="Password" type="password" placeholder="At least 8 characters" value={f.password} onChange={set("password")} required minLength={8} autoComplete="new-password" />
        <FormError message={error} />
        <button className="btn btn-primary mt-2 w-full" disabled={busy}>{busy ? "Please wait..." : "Continue"}</button>
        <p className="text-center text-xs text-muted">By continuing you agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link></p>
      </form>
    </AuthLayout>
  );
}
