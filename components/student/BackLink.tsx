"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** The back button every page carries. Without href it goes to the previous page. */
export function BackLink({ href, label = "Back" }: { href?: string; label?: string }) {
  const router = useRouter();
  const cls = "mb-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-navy shadow-sm";
  return href ? <Link href={href} className={cls}>← {label}</Link> : <button onClick={() => router.back()} className={cls}>← {label}</button>;
}
