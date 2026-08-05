// Payments domain module

/**
 * SLE cents earned for transcribing/correcting a clip.
 *
 * Mirrors the V2 review flow: a per-minute rate applied to the clip length,
 * with a 0.1-minute floor so very short clips still pay, and a 1-cent floor
 * so a credited item is never silently rounded down to zero (the bug that
 * left short Krio clips uncredited while the rate was 0.03/min).
 */
export function transcriberCents(durationSec: number, ratePerMin: number): number {
  if (!ratePerMin || ratePerMin <= 0) return 0;
  const durationMin = Math.max(0.1, durationSec / 60);
  return Math.max(1, Math.round(durationMin * ratePerMin * 100));
}
