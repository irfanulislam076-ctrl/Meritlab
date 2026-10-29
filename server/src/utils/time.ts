const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // Asia/Dhaka is UTC+6 all year (no DST)
const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the Dhaka calendar day containing `d`, as a UTC instant. */
export function dhakaStartOfDay(d: Date = new Date()): Date {
  const local = d.getTime() + DHAKA_OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - DHAKA_OFFSET_MS);
}

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

/** "2026-11-01" (a Dhaka date) -> start of that Dhaka day. */
export const parseDhakaDate = (s: string) => new Date(`${s}T00:00:00+06:00`);
