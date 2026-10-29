"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthLayout, Field, FormError } from "@/components/auth/AuthLayout";
import { api, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function VerifyForm() {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";
  const { startSession } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      startSession(await api<{ user: User; accessToken: string }>("/auth/verify-email", "POST", { email, code }));
      router.replace("/courses");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  async function resend() {
    setError(""); setInfo("");
    try {
      await api("/auth/resend-otp", "POST", { email, purpose: "REGISTER" });
      setInfo("A new code was sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <AuthLayout back="/register" title="Check your email" subtitle={email ? `Enter the 6 digit code sent to ${email}` : "Enter the 6 digit code"}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Code" inputMode="numeric" maxLength={6} pattern="\d{6}" value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required autoComplete="one-time-code" />
        <FormError message={error} />
        {info && <p className="text-sm font-medium text-success">{info}</p>}
        <button className="btn btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? "Verifying..." : "Verify"}</button>
        <button type="button" onClick={resend} className="btn btn-outline w-full">Send a new code</button>
      </form>
    </AuthLayout>
  );
}

export default function VerifyPage() {
  return <Suspense><VerifyForm /></Suspense>;
}
