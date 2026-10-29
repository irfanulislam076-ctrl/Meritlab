"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { BottomNav } from "@/components/student/BottomNav";
import { CourseCard } from "@/components/student/CourseCard";
import { Logo } from "@/components/ui/Logo";
import { api, type Course } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

type Cat = { _id: string; name: string; slug: string };
const TINTS = ["bg-tint-yellow", "bg-tint-mint", "bg-tint-lime"];

export default function HomePage() {
  const { user } = useRequireAuth();
  const [cats, setCats] = useState<Cat[]>([]);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  useEffect(() => { if (user) api<{ enrollments: { courseId: { slug: string } }[] }>("/me/enrollments").then((d) => setMine(new Set(d.enrollments.map((e) => e.courseId?.slug)))).catch(() => {}); }, [user]);

  useEffect(() => { api<{ categories: Cat[] }>("/categories").then((d) => setCats(d.categories)).catch(() => {}); }, []);
  useEffect(() => { api<{ courses: Course[] }>(`/courses${cat ? `?category=${cat}` : ""}`).then((d) => setCourses(d.courses)).catch(() => setCourses([])); }, [cat]);

  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }).format(new Date()));
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const featured = courses?.[0];

  return (
    <AppShell>
      <header className="flex items-center justify-between px-6 pt-8"><Logo size="sm" /><Link href="/profile" className="pill bg-peach text-gold">{user?.name[0]}</Link></header>
      <div className="px-6 pb-24 pt-6">
        <p className="text-sm text-muted">{hello}</p>
        <h1 className="text-[26px] font-bold">Hi, {user?.name.split(" ")[0] ?? "there"}</h1>
        {featured && (
          <div className="mt-5 rounded-3xl bg-peach p-5">
            <p className="text-sm font-semibold text-gold">Day {featured.freeDays} is free for everyone</p>
            <h2 className="mt-1 text-xl font-bold">{featured.title}</h2>
            <Link href={mine.has(featured.slug) ? `/learn/${featured.slug}` : `/courses/${featured.slug}`} className="btn btn-primary mt-4">{mine.has(featured.slug) ? "Start course" : "View details"}</Link>
          </div>
        )}
        <h2 className="mt-7 text-lg font-bold">Category</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {cats.map((c, i) => (
            <button key={c._id} onClick={() => setCat(cat === c.slug ? null : c.slug)} className={`rounded-2xl p-4 text-sm font-bold ${TINTS[i % 3]} ${cat === c.slug ? "ring-2 ring-navy" : ""}`}>{c.name}</button>
          ))}
        </div>
        <h2 className="mt-7 text-lg font-bold">Popular courses</h2>
        <div className="mt-3 flex flex-col gap-4">
          {!courses && <div className="skeleton h-32" />}
          {courses?.length === 0 && <p className="text-muted">No courses here yet.</p>}
          {courses?.map((c) => <CourseCard key={c._id} course={c} enrolled={mine.has(c.slug)} />)}
        </div>
      </div>
      <BottomNav />
    </AppShell>
  );
}
