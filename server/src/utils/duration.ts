/** "7d" | "12h" | "30m" | "60s" | "3600" -> milliseconds */
export function toMs(value: string): number {
  const m = /^(\d+)\s*([smhd])?$/i.exec(value.trim());
  if (!m) throw new Error(`Invalid duration: ${value}`);
  const n = Number(m[1]);
  const unit = (m[2] ?? "s").toLowerCase();
  return n * { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit as "s" | "m" | "h" | "d"];
}
