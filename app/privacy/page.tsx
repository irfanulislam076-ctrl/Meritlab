import Link from "next/link";
import { AppShell } from "@/components/student/AppShell";

export const metadata = { title: "Privacy policy · Meritlab" };

export default function PrivacyPage() {
  return (
    <AppShell>
      <div className="px-6 pb-10 pt-8 text-[15px] leading-relaxed">
        <Link href="/register" className="text-sm font-semibold text-muted">← Back</Link>
        <h1 className="mt-4 text-[26px] font-bold">Privacy policy</h1>
        {[
          ["What we collect", "Your name, mobile number, email, exam answers and scores, and payment details you send us (method, TrxID and the number you paid from)."],
          ["How we use it", "To run your account, grade exams, build merit lists, approve payments and send you notices and verification codes by email."],
          ["Who sees it", "Other students see your name and score on a merit list. Admins can see your account and payment details. We do not sell your data."],
          ["Services we use", "Email is sent through Brevo, images and files are stored on Cloudinary and data is stored in MongoDB Atlas."],
          ["Your choices", "Contact support to correct or delete your account."],
        ].map(([h, t]) => <div key={h} className="mt-5"><h2 className="font-bold">{h}</h2><p className="text-muted">{t}</p></div>)}
      </div>
    </AppShell>
  );
}
