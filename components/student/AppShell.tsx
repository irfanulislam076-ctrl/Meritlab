import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  tone?: "page" | "peach";
};

/** Mobile-first student column. On desktop it stays a centered 430px column. */
export function AppShell({ children, tone = "page" }: AppShellProps) {
  const background = tone === "peach" ? "bg-peach" : "bg-page";
  return (
    <div className="min-h-dvh md:py-6">
      <main
        className={`mx-auto flex min-h-dvh w-full max-w-[430px] flex-col md:min-h-[calc(100dvh-3rem)] md:overflow-hidden md:rounded-[36px] md:shadow-[0_20px_60px_rgba(38,44,58,0.12)] ${background}`}
      >
        {children}
      </main>
    </div>
  );
}
