import Link from "next/link";
import type { Course } from "@/lib/api";

export function CourseCard({ course, enrolled }: { course: Course; enrolled?: boolean }) {
  return (
    <Link href={enrolled ? `/learn/${course.slug}` : `/courses/${course.slug}`} className="card block p-5">
      <span className="pill bg-tint-yellow text-gold">{course.durationDays} days · Day {course.freeDays} free</span>
      <h2 className="mt-3 text-lg font-bold leading-snug">{course.title}</h2>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{course.description}</p>
      <p className="mt-3 font-bold">{enrolled ? <span className="text-success">Enrolled · Start course →</span> : `৳${course.priceBdt}`}</p>
    </Link>
  );
}
