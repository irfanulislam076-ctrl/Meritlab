import Link from "next/link";
import { AppShell } from "@/components/student/AppShell";
import { Logo } from "@/components/ui/Logo";
import { RedirectIfAuthed } from "@/components/student/RedirectIfAuthed";

function Illustration() {
  return (
    <svg
      viewBox="0 0 390 390"
      aria-hidden="true"
      className="mx-auto -mt-2 h-auto w-full max-w-[390px] flex-none"
    >
      <circle cx="338" cy="44" r="14" className="fill-dot-rose" />
      <circle cx="52" cy="64" r="11" className="fill-dot-rose" />
      <circle cx="372" cy="196" r="7" className="fill-dot-blue" />
      <circle cx="40" cy="256" r="7" className="fill-dot-blue" />
      <circle cx="304" cy="372" r="9" fill="#fff" />

      <circle cx="195" cy="200" r="140" className="fill-orb-1" />
      <circle cx="195" cy="200" r="94" className="fill-orb-2" />

      <rect x="120" y="118" width="150" height="196" rx="28" fill="#fff" />
      <rect x="138" y="140" width="62" height="11" rx="5.5" className="fill-navy" />
      <rect x="138" y="164" width="112" height="8" rx="4" className="fill-line" />
      <rect x="138" y="181" width="92" height="8" rx="4" className="fill-line" />
      <circle cx="156" cy="222" r="14" className="fill-tint-yellow" />
      <rect x="180" y="216" width="72" height="12" rx="6" className="fill-track" />
      <circle cx="156" cy="254" r="14" className="fill-navy" />
      <path d="M149 254l5 5 9-10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="180" y="248" width="72" height="12" rx="6" className="fill-track" />
      <circle cx="156" cy="286" r="14" className="fill-tint-mint" />
      <rect x="180" y="280" width="72" height="12" rx="6" className="fill-track" />

      <rect x="20" y="88" width="148" height="46" rx="23" fill="#fff" />
      <circle cx="44" cy="111" r="15" className="fill-tint-yellow" />
      <text x="68" y="116" className="fill-navy text-[14px] font-semibold">100 marks</text>

      <rect x="240" y="60" width="132" height="46" rx="23" fill="#fff" />
      <circle cx="264" cy="83" r="15" className="fill-tint-mint" />
      <text x="288" y="88" className="fill-navy text-[14px] font-semibold">50 words</text>

      <rect x="222" y="292" width="150" height="46" rx="23" fill="#fff" />
      <circle cx="246" cy="315" r="15" className="fill-tint-lime" />
      <text x="270" y="320" className="fill-navy text-[14px] font-semibold">12 AM live</text>
    </svg>
  );
}

export default function WelcomePage() {
  return (
    <AppShell tone="peach">
      <RedirectIfAuthed />
      <header className="px-6 pt-8">
        <Logo />
      </header>

      <Illustration />

      <section className="mx-4 mb-4 mt-auto rounded-[32px] bg-white px-6 pb-6 pt-8 text-center">
        <h1 className="text-[28px] font-bold leading-[1.2] text-navy">
          Bank prelim prep
          <br />
          in 30 days
        </h1>
        <p className="mx-auto mt-3 max-w-[300px] text-[15px] leading-relaxed text-muted">
          A daily routine, a live exam at 12 AM, and explained answers. No more deciding what to study.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link href="/register" className="btn btn-primary w-full">
            Get started
          </Link>
          <Link href="/login" className="btn btn-outline w-full">
            Log in
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted">Day 1 is free for everyone</p>
      </section>
    </AppShell>
  );
}
