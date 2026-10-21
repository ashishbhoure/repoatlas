/** Display formatting. Pure functions; callers pass `now` so output is deterministic in tests. */

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-US");

/** 1234 → "1.2K", 999 → "999". */
export function formatCount(n: number): string {
  return n < 1000 ? String(n) : compact.format(n);
}

export function formatNumber(n: number): string {
  return full.format(n);
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${formatCount(n)} ${n === 1 ? word : pluralWord}`;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400_000],
  ["month", 30 * 86_400_000],
  ["week", 7 * 86_400_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

/** "3 days ago", "yesterday", "just now". */
export function formatRelative(iso: string | null | undefined, now: number): string {
  if (!iso) return "unknown";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "unknown";
  const diff = t - now;
  const abs = Math.abs(diff);
  if (abs < 60_000) return "just now";
  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

const dateFmt = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

/** "Oct 21, 2026" (UTC, so server and client agree). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const t = Date.parse(iso);
  return Number.isNaN(t) ? "unknown" : dateFmt.format(t);
}

export function formatBytesFromKb(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${(kb / 1024 / 1024).toFixed(1)} GB`;
}
