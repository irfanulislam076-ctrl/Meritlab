"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthLayout, Field, FormError } from "@/components/auth/AuthLayout";
import { ApiError, api, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { startSession } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      startSession(await api<{ user: User; accessToken: string }>("/auth/login", "POST", { identifier, password }));
      router.replace("/courses");
    } catch (err) {
      if (err instanceof ApiError && err.details?.code === "EMAIL_NOT_VERIFIED") {
        await api("/auth/resend-otp", "POST", { email: err.details.email, purpose: "REGISTER" }).catch(() => {});
        return router.push(`/verify?email=${encodeURIComponent(err.details.email ?? "")}`);
      }
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <AuthLayout back="/" title="Welcome back" subtitle="Log in with your email or mobile number."
      footer={<>New here? <Link href="/register" className="font-semibold text-navy">Create an account</Link></>}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Email or mobile" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" />
        <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        <Link href="/forgot-password" className="self-end text-sm font-semibold text-gold">Forgot password?</Link>
        <FormError message={error} />
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Please wait..." : "Log in"}</button>
      </form>
    </AuthLayout>
  );
}
