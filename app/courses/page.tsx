"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/student/AppShell";
import { CourseCard } from "@/components/student/CourseCard";
import { Logo } from "@/components/ui/Logo";
import { BackLink } from "@/components/student/BackLink";
import { BottomNav } from "@/components/student/BottomNav";
import { api, type Course } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function CoursesPage() {
  const { user, ready } = useAuth();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ courses: Course[] }>("/courses")
      .then((d) => setCourses(d.courses))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <AppShell>
      <header className="flex items-center justify-between px-6 pt-8">
        <Logo size="sm" />
        {ready && (user
          ? <Link href="/profile" className="pill bg-peach text-gold">{user.name.split(" ")[0]}</Link>
          : <Link href="/login" className="pill bg-peach text-gold">Log in</Link>)}
      </header>
      <div className="px-6 pb-24 pt-6">
        <BackLink href="/home" />
        <h1 className="text-[26px] font-bold">Courses</h1>
        <div className="mt-5 flex flex-col gap-4">
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
          {!courses && !error && [0, 1].map((i) => <div key={i} className="skeleton h-32" />)}
          {courses?.length === 0 && <p className="text-muted">No live courses yet. Check back soon.</p>}
          {courses?.map((c) => <CourseCard key={c._id} course={c} />)}
        </div>
      </div>
      <BottomNav />
    </AppShell>
  );
}
