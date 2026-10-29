"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BackLink } from "@/components/student/BackLink";
import { BottomNav } from "@/components/student/BottomNav";
import { useAuth } from "@/lib/auth";
import { api, type Course } from "@/lib/api";

export default function CourseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const [st, setSt] = useState<{ enrolled: boolean; expiresAt: string | null; expired: boolean; pending: boolean } | null>(null);
  useEffect(() => { if (user) api<NonNullable<typeof st>>(`/courses/${slug}/status`).then(setSt).catch(() => {}); }, [slug, user]);

  useEffect(() => {
    api<{ course: Course }>(`/courses/${encodeURIComponent(slug)}`)
      .then((d) => setCourse(d.course))
      .catch((e) => setError(e.message));
  }, [slug]);

  return (
    <AppShell>
      <div className="px-6 pb-24 pt-8">
        <BackLink href="/home" />
        {error && <p role="alert" className="mt-6 text-danger">{error}</p>}
        {!course && !error && <div className="skeleton mt-6 h-48" />}
        {course && (
          <>
            <h1 className="mt-4 text-[26px] font-bold leading-tight">{course.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="pill bg-tint-yellow text-gold">{course.durationDays} days</span>
              <span className="pill bg-tint-mint text-success">Day {course.freeDays} free</span>
              <span className="pill bg-tint-blue text-navy">Starts {new Date(course.startDate).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}</span>
            </div>
            <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed text-muted">{course.description}</p>
            <div className="card mt-6 p-5">
              {st?.enrolled ? (
                <>
                  <p className="text-sm text-success">Active until {st.expiresAt ? new Date(st.expiresAt).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "long" }) : "further notice"}</p>
                  <Link href={`/learn/${course.slug}`} className="btn btn-primary mt-3 w-full">Start course</Link>
                </>
              ) : st?.pending ? (
                <>
                  <p className="font-semibold">Payment waiting for approval</p>
                  <p className="mt-1 text-sm text-muted">We will email you as soon as an admin confirms it.</p>
                  <Link href={`/learn/${course.slug}`} className="btn btn-outline mt-3 w-full">Open free Day 1</Link>
                </>
              ) : (
                <>
                  {st?.expired && <p className="mb-2 text-sm text-danger">Your access has ended. Renew to continue.</p>}
                  <div className="flex items-center justify-between"><span className="text-2xl font-bold">৳{course.priceBdt}</span><Link href={`/courses/${course.slug}/buy`} className="btn btn-primary">{st?.expired ? "Renew course" : "Buy course"}</Link></div>
                  <Link href={`/learn/${course.slug}`} className="btn btn-outline mt-3 w-full">Try Day 1 free</Link>
                </>
              )}
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </AppShell>
  );
}
