/**
 * Week boundary utilities for Saturday–Friday payout weeks (UTC).
 */

export const MILESTONE_MINUTES = 240; // 4 hours
export const MILESTONE_PAYOUT_LE = 1000;

/** Returns the Saturday–Friday UTC week range containing the given date (or now). */
export function getWeekRange(dateOrWeekStart?: string): { start: Date; end: Date } {
  let ref: Date;
  if (dateOrWeekStart) {
    ref = new Date(dateOrWeekStart + "T00:00:00Z");
  } else {
    ref = new Date();
  }
  const day = ref.getUTCDay(); // 0=Sun, 6=Sat
  const diffToSaturday = day >= 6 ? day - 6 : day + 1;
  const start = new Date(ref);
  start.setUTCDate(ref.getUTCDate() - diffToSaturday);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

/** Format a week range as "Sat Mar 14 – Fri Mar 20, 2026" */
export function formatWeekLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const year = end.getUTCFullYear();
  return `${fmt(start)} – ${fmt(end)}, ${year}`;
}

/** The three recording statuses that count as "audio approved" for speakers. */
export const APPROVED_STATUSES = [
  "PENDING_TRANSCRIPTION",
  "TRANSCRIBED",
  "APPROVED",
] as const;
