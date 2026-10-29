"use client";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

export type AdminCourse = { _id: string; title: string; slug: string; categoryId: string; description: string; durationDays: number; priceBdt: number; freeDays: number; startDate: string; examOpenTime: string; examCloseTime: string; negativeMarking: number; passMark: number; subjectCounts: Record<string, number>; status: string; thumbnailUrl?: string; students?: number };

export const L = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block text-xs font-semibold text-muted"><span className="mb-1 block">{label}</span>{children}</label>
);
export const Msg = ({ text }: { text: string }) => (text ? <p role="alert" className="my-2 text-sm font-medium text-danger">{text}</p> : null);
export const dhakaDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });

export function useAdminCourses() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const reload = () => api<{ courses: AdminCourse[] }>("/admin/courses").then((d) => setCourses(d.courses)).catch(() => {});
  useEffect(() => { reload(); }, []);
  return { courses, reload };
}
export function CourseSelect({ value, onChange, courses }: { value: string; onChange: (v: string) => void; courses: AdminCourse[] }) {
  return <select className="input max-w-sm" value={value} onChange={(e) => onChange(e.target.value)}>{courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}</select>;
}
