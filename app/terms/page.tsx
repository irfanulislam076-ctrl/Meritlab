import Link from "next/link";
import { AppShell } from "@/components/student/AppShell";

export const metadata = { title: "Terms of use · Meritlab" };

export default function TermsPage() {
  return (
    <AppShell>
      <div className="px-6 pb-10 pt-8 text-[15px] leading-relaxed">
        <Link href="/register" className="text-sm font-semibold text-muted">← Back</Link>
        <h1 className="mt-4 text-[26px] font-bold">Terms of use</h1>
        <p className="mt-3 text-muted">Please read these terms before using Meritlab.</p>
        {[
          ["Your account", "Give true information and keep your password private. One account is for one student. We may block an account that is shared or misused."],
          ["Courses and payment", "Day 1 of a course is free. The rest of the course unlocks after your bKash or Nagad payment is checked and approved. Payments are checked by hand, so approval can take some time."],
          ["Exams", "Each live exam opens and closes at the announced time (Asia/Dhaka). Answers lock when you tap them. Practice attempts after closing are not ranked."],
          ["Content", "Questions, explanations, PDFs and vocabulary belong to Meritlab. Do not copy, resell or share them."],
          ["Changes", "We may update these terms. Using the app after a change means you accept it."],
        ].map(([h, t]) => <div key={h} className="mt-5"><h2 className="font-bold">{h}</h2><p className="text-muted">{t}</p></div>)}
      </div>
    </AppShell>
  );
}
