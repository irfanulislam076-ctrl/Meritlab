import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/hind-siliguri/400.css";
import "@fontsource/hind-siliguri/600.css";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Meritlab", template: "%s · Meritlab" },
  description:
    "Bank prelim prep in 30 days: a daily routine, a live exam at 12 AM, and explained answers.",
  applicationName: "Meritlab",
  appleWebApp: { capable: true, title: "Meritlab", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#fff8f1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
