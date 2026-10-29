"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

/** Logged-in students skip the welcome screen. */
export function RedirectIfAuthed() {
  const { user, ready } = useAuth();
  const router = useRouter();
  useEffect(() => { if (ready && user) router.replace("/home"); }, [ready, user, router]);
  return null;
}
