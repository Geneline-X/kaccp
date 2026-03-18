# Weekly Milestone Payment System

## Overview

Replace the current manual payment page with a weekly payout system. Speakers earn based on approved audio recordings within a Saturday–Friday week. A single milestone tier incentivizes higher output: speakers who hit 4 hours of approved audio earn a flat 1,000 Le instead of the per-minute rate (2.5 Le/min).

## Payout Rules

- **Week boundary**: Saturday 00:00 UTC to Friday 23:59:59 UTC
- **Eligible recordings**: status in `PENDING_TRANSCRIPTION`, `TRANSCRIBED`, `APPROVED` — i.e., audio has passed reviewer approval. This means a recording counts toward a speaker's weekly total as soon as the reviewer approves the audio quality, regardless of transcription status. This is intentional: the speaker's work is the audio, and they shouldn't wait for the transcription pipeline to complete. If a recording is later rejected (e.g., re-flagged), it was already counted — accepted risk for simplicity.
- **Base rate**: per-minute earnings summed per language: `durationMin × language.speakerRatePerMinute`
- **Milestone**: if total `approvedMinutes >= 240` (4 hours across all languages), payout is the **greater of** the per-minute total or the flat 1,000 Le. This prevents edge cases where high per-language rates would make the milestone a penalty.
- **Every speaker gets paid weekly** — milestone or not
- **Rounding**: per-minute payouts are rounded to 2 decimal places (Le) using standard rounding (`Math.round(value * 100) / 100`)

### Constants (in code)

```typescript
const MILESTONE_MINUTES = 240; // 4 hours
const MILESTONE_PAYOUT_LE = 1000;
```

## Speaker Dashboard — Weekly Progress

Add a weekly progress card to the existing speaker dashboard (`SpeakerDashboardClient.tsx`), positioned above or alongside the existing earnings card.

### Content

- **Progress bar**: approved hours this week out of 4-hour target
- **Approved hours**: e.g., "2.5 / 4.0 hours"
- **Current estimated payout**: calculated from approved recordings this week
  - Under milestone: per-minute total (e.g., "Le375.00")
  - At/above milestone: "Le1,000.00" (or per-minute if higher)
- **Motivational nudge** (when between 50%–99% of milestone): "Record X more hours to earn Le1,000 instead of LeY"
- **Week label**: "This week: Sat Mar 14 – Fri Mar 20"
- **Week ends indicator**: "Ends in 3 days" countdown

### Data Source

New field in the speaker recordings API response (`GET /api/v2/speaker/recordings`):

```typescript
weeklyProgress: {
  weekStart: string;        // ISO date, e.g., "2026-03-14"
  weekEnd: string;          // ISO date, e.g., "2026-03-20"
  approvedDurationSec: number;
  milestoneTargetSec: number; // 14400 (4 hours)
  milestoneHit: boolean;
  estimatedPayoutLe: number;
}
```

Computed on the fly — query recordings by `speakerId`, approved statuses, and `createdAt` within the current Sat–Fri window.

## Admin Weekly Payout Page

Replace the existing admin payment page (`/admin/payments/`) with a new weekly payout interface. The old page is kept as a read-only archive at its current URL for viewing historical manual payments.

### URL

`/[locale]/admin/v2/payouts` (new primary payment interface)

### Layout

1. **Week selector** at the top: defaults to current week, left/right arrows to navigate past weeks. Displays "Sat Mar 14 – Fri Mar 20, 2026".

2. **Summary stats row**:
   - Total speakers with recordings this week
   - Speakers who hit milestone
   - Total payout amount for the week

3. **Speaker payout table** with columns:
   - Speaker name / email
   - Approved hours (formatted as hours:minutes)
   - Milestone hit (green badge if yes)
   - Calculated payout (Le amount)
   - Payment status (unpaid / paid)
   - Action (pay button, disabled if already paid)

4. **Bulk actions**:
   - "Pay all unpaid" button — creates Payment records for all unpaid speakers that week

### Payout Calculation Per Speaker

```
perMinuteTotal = sum of (durationMin × language.speakerRatePerMinute) per language
if approvedMinutes >= 240:
  payout = max(perMinuteTotal, 1000)
else:
  payout = perMinuteTotal
```

### When "Pay" Is Clicked

For each speaker being paid:

1. Create a `Payment` record:
   - `userId`: speaker ID
   - `amountCents`: payout in cents (Le × 100)
   - `currency`: SLE
   - `status`: PAID
   - `reference`: `weekly:YYYY-MM-DD` (the Saturday date, used as a stable dedup key)
   - `notes`: "Milestone" or "Per-minute" to indicate which rate applied

2. No wallet transactions or `totalEarningsCents` updates — earnings are computed on the fly.

### Preventing Double Payment

Use a `@@unique([userId, reference])` constraint on the `Payment` model (schema migration required). This provides database-level protection against duplicate payments for the same speaker and week. The `reference` format `weekly:YYYY-MM-DD` is a stable, machine-readable key.

Additionally, add an index on `Payment(userId, reference)` for efficient lookups.

## API Endpoints

### `GET /api/v2/admin/payouts/weekly`

Returns the payout summary for a given week.

**Query params:**
- `weekStart` (optional): ISO date string for the Saturday. Defaults to current week's Saturday.

**Response:**
```typescript
{
  week: { start: string; end: string };
  speakers: Array<{
    id: string;
    displayName: string;
    email: string;
    approvedDurationSec: number;
    approvedMinutes: number;
    milestoneHit: boolean;
    payoutLe: number;
    paid: boolean;
    paymentId?: string;
  }>;
  summary: {
    totalSpeakers: number;
    milestoneSpeakers: number;
    totalPayoutLe: number;
    paidCount: number;
  };
}
```

**Implementation:**
1. Calculate the Sat–Fri range from `weekStart`
2. Find all recordings with approved statuses and `createdAt` in range, grouped by `speakerId`
3. For each speaker, sum duration per language, calculate per-minute total, check milestone
4. Check `Payment` table for existing payments with matching `reference` (`weekly:YYYY-MM-DD`)
5. Return the summary

### `POST /api/v2/admin/payouts/weekly`

Process payouts for one or more speakers.

**Body:**
```typescript
{
  weekStart: string;           // ISO date for the Saturday
  speakerIds: string[];        // speakers to pay
  payAll?: boolean;            // if true, pay all unpaid speakers (ignores speakerIds)
}
```

**Implementation:**
1. Recalculate each speaker's payout for the week (don't trust client-sent amounts)
2. Create `Payment` records — the unique constraint on `(userId, reference)` prevents doubles at the DB level
3. Return created payment IDs

### Updated: `GET /api/v2/speaker/recordings`

Add `weeklyProgress` to the existing response (see Speaker Dashboard section above).

## Files to Create / Modify

### New Files
- `src/app/api/v2/admin/payouts/weekly/route.ts` — weekly payout API (GET + POST)
- `src/app/[locale]/admin/v2/payouts/page.tsx` — admin weekly payout page
- `src/lib/utils/week.ts` — week boundary helper (shared between speaker and admin APIs)

### Modified Files
- `src/app/api/v2/speaker/recordings/route.ts` — add `weeklyProgress` to response
- `src/app/[locale]/speaker/SpeakerDashboardClient.tsx` — add weekly progress card
- `src/app/[locale]/admin/v2/AdminV2DashboardClient.tsx` — update nav link to new payouts page
- `prisma/schema.prisma` — add `@@unique([userId, reference])` and `@@index([userId, reference])` to Payment model

### Kept (read-only archive)
- `src/app/[locale]/admin/payments/page.tsx` — kept for viewing historical manual payments

### Unchanged
- `WalletTransaction` — not used in the new flow. Existing records stay for history but no new ones are created.

## Week Boundary Helper

Utility function in `src/lib/utils/week.ts`, used by both speaker and admin APIs:

```typescript
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

export const MILESTONE_MINUTES = 240;
export const MILESTONE_PAYOUT_LE = 1000;
```

## Edge Cases

- **Speaker records in multiple languages**: sum all approved durations across languages for milestone check. Per-minute payout is calculated per language using each language's rate, then summed. If milestone is hit, payout is `max(perMinuteTotal, 1000 Le)`.
- **Recording's `createdAt` determines the week**: not the approval date. This way speakers know exactly how much they recorded that week.
- **Partial weeks**: first and last weeks work the same — no proration.
- **No recordings**: speaker doesn't appear in the payout table.
- **Recording volume**: each recording is max ~20 seconds. Reaching 4 hours requires ~720 recordings in a week (~100/day). This is achievable for active speakers doing focused recording sessions.
- **Concurrent payout requests**: the `@@unique([userId, reference])` constraint prevents double payments at the database level even with concurrent admin requests.
