import Link from "next/link";
import type { InputHTMLAttributes, ReactNode } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BackLink } from "@/components/student/BackLink";
import { Logo } from "@/components/ui/Logo";

export function AuthLayout({ title, subtitle, children, footer, back }: {
  back?: string; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <AppShell>
      <header className="px-6 pt-8">{back && <BackLink href={back} />}<Link href="/" className="block"><Logo size="sm" /></Link></header>
      <div className="flex flex-1 flex-col px-6 pb-8 pt-8">
        <h1 className="text-[26px] font-bold leading-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <p className="mt-auto pt-8 text-center text-sm text-muted">{footer}</p>}
      </div>
    </AppShell>
  );
}

export function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input className="input" {...props} />
    </label>
  );
}

export const FormError = ({ message }: { message: string }) =>
  message ? <p role="alert" className="text-sm font-medium text-danger">{message}</p> : null;
