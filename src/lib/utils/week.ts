/**
 * Week boundary utilities for Monday–Sunday payout weeks (UTC).
 */

export const MILESTONE_MINUTES = 240; // 4 hours
export const MILESTONE_PAYOUT_LE = 1000;
// Milestone bonus retired; weeks starting on or after this date pay per minute only.
// Earlier unpaid weeks keep the milestone amount speakers were promised.
export const MILESTONE_LAST_WEEK_BEFORE = "2026-11-23";

/**
 * Speaker payout for one Monday-start week. `perMinuteTotal` is the sum of
 * minutes × language rate, so mixed-language weeks stay exact without milestones.
 */
export function speakerWeeklyPayout(
  weekStart: string,
  minutes: number,
  perMinuteTotal: number
): { payoutLe: number; milestoneHit: boolean } {
  const milestonesReached =
    weekStart < MILESTONE_LAST_WEEK_BEFORE ? Math.floor(minutes / MILESTONE_MINUTES) : 0;
  if (milestonesReached < 1) return { payoutLe: perMinuteTotal, milestoneHit: false };
  const remainderMinutes = minutes - milestonesReached * MILESTONE_MINUTES;
  const avgRate = minutes > 0 ? perMinuteTotal / minutes : 2.5;
  return {
    payoutLe: milestonesReached * MILESTONE_PAYOUT_LE + remainderMinutes * avgRate,
    milestoneHit: true,
  };
}

/** Returns the Monday–Sunday UTC week range containing the given date (or now). */
export function getWeekRange(dateOrWeekStart?: string): { start: Date; end: Date } {
  let ref: Date;
  if (dateOrWeekStart) {
    ref = new Date(dateOrWeekStart + "T00:00:00Z");
  } else {
    ref = new Date();
  }
  const day = ref.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Days since Monday: Sunday(0) → 6, Monday(1) → 0, Tuesday(2) → 1, etc.
  const diffToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(ref);
  start.setUTCDate(ref.getUTCDate() - diffToMonday);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

/** Format a week range as "Mon Mar 9 – Sun Mar 15, 2026" */
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
