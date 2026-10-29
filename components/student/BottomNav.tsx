"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type Course } from "@/lib/api";

let cachedSlug: string | null = null;
function useDefaultSlug() {
  const [slug, setSlug] = useState(cachedSlug);
  useEffect(() => {
    if (cachedSlug) return;
    api<{ courses: Course[] }>("/courses").then((d) => { cachedSlug = d.courses[0]?.slug ?? null; setSlug(cachedSlug); }).catch(() => {});
  }, []);
  return slug;
}

export function BottomNav() {
  const path = usePathname();
  const slug = useDefaultSlug();
  const items = [
    ["Home", "/home", "⌂"], ["Exams", "/exams", "▤"], ["Vocab", slug ? `/learn/${slug}/vocab` : "/home", "▥"], ["Me", "/profile", "☺"],
  ] as const;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 mx-auto flex max-w-[480px] justify-around border-t border-line bg-white py-2">
      {items.map(([label, href, icon]) => (
        <Link key={label} href={href} className={`flex flex-col items-center px-4 text-xs ${path === href || (href !== "/home" && path.startsWith(href)) ? "font-bold text-navy" : "text-muted"}`}>
          <span className="text-xl leading-none">{icon}</span>{label}
        </Link>
      ))}
    </nav>
  );
}
