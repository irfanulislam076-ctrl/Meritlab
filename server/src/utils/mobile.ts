/** Accepts 01XXXXXXXXX, 8801XXXXXXXXX, +8801XXXXXXXXX and returns +8801XXXXXXXXX, or null. */
export function normalizeMobile(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "").replace(/^\+/, "");
  let local: string;
  if (/^8801\d{9}$/.test(digits)) local = digits.slice(2);
  else if (/^01\d{9}$/.test(digits)) local = digits;
  else return null;
  if (!/^01[3-9]\d{8}$/.test(local)) return null;
  return `+88${local}`;
}
