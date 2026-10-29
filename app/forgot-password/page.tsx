"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthLayout, Field, FormError } from "@/components/auth/AuthLayout";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      if (step === "email") {
        await api("/auth/forgot-password", "POST", { email });
        setStep("reset");
      } else {
        await api("/auth/reset-password", "POST", { email, code, newPassword });
        router.replace("/login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
    setBusy(false);
  }

  return (
    <AuthLayout back="/login" title="Reset password"
      subtitle={step === "email" ? "We will email you a code." : `Enter the code sent to ${email} and a new password.`}
      footer={<Link href="/login" className="font-semibold text-navy">Back to log in</Link>}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {step === "email" ? (
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        ) : (
          <>
            <Field label="Code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
            <Field label="New password" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoComplete="new-password" />
          </>
        )}
        <FormError message={error} />
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Please wait..." : step === "email" ? "Send code" : "Update password"}</button>
      </form>
    </AuthLayout>
  );
}
