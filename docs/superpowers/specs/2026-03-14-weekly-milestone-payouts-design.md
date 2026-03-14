# Weekly Milestone Payment System

## Overview

Replace the current manual payment page with a weekly payout system. Speakers earn based on approved audio recordings within a Saturday–Friday week. A single milestone tier incentivizes higher output: speakers who hit 4 hours of approved audio earn a flat 1,000 Le instead of the per-minute rate (2.5 Le/min).

## Payout Rules

- **Week boundary**: Saturday 00:00 to Friday 23:59 (local time)
- **Eligible recordings**: status in `PENDING_TRANSCRIPTION`, `TRANSCRIBED`, `APPROVED` — i.e., audio has been reviewed and approved by a reviewer
- **Base rate**: `approvedMinutes × language.speakerRatePerMinute` (default 2.5 Le/min)
- **Milestone**: if `approvedMinutes >= 240` (4 hours), payout is a flat 1,000 Le regardless of per-minute calculation
- **Every speaker gets paid weekly** — milestone or not

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
  - Under milestone: `approvedMin × rate` (e.g., "Le375.00")
  - At/above milestone: "Le1,000.00"
- **Motivational nudge** (when between 50%–99% of milestone): "Record X more hours to earn Le1,000 instead of LeY"
- **Week label**: "This week: Sat Mar 14 – Fri Mar 20"

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

Replace the existing admin payment page (`/admin/payments/`) with a new weekly payout interface.

### URL

`/[locale]/admin/v2/payouts` (replaces `/[locale]/admin/payments`)

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
if approvedMinutes >= 240:
  payout = 1000 Le
else:
  payout = approvedMinutes × speakerRatePerMinute
```

### When "Pay" Is Clicked

For each speaker being paid:

1. Create a `Payment` record:
   - `userId`: speaker ID
   - `amountCents`: payout in cents (Le × 100)
   - `currency`: SLE
   - `status`: PAID
   - `reference`: "Weekly payout: YYYY-MM-DD to YYYY-MM-DD"
   - `notes`: "Milestone" or "Per-minute" to indicate which rate applied

2. No wallet transactions or `totalEarningsCents` updates — those are being phased out in favor of on-the-fly computation.

### Preventing Double Payment

Query existing `Payment` records for the same speaker with a matching weekly reference string. If a payment exists for that speaker and week, show as "paid" and disable the action.

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
3. For each speaker, sum duration and determine payout (milestone or per-minute)
4. Check `Payment` table for existing payments with matching week reference
5. Return the summary

### `POST /api/v2/admin/payouts/weekly`

Process payouts for one or more speakers.

**Body:**
```typescript
{
  weekStart: string;           // ISO date for the Saturday
  speakerIds: string[];        // speakers to pay (or "all" for bulk)
}
```

**Implementation:**
1. Recalculate each speaker's payout for the week (don't trust client-sent amounts)
2. Check for existing payments to prevent doubles
3. Create `Payment` records with status PAID
4. Return created payment IDs

### Updated: `GET /api/v2/speaker/recordings`

Add `weeklyProgress` to the existing response (see Speaker Dashboard section above).

## Files to Create / Modify

### New Files
- `src/app/api/v2/admin/payouts/weekly/route.ts` — weekly payout API (GET + POST)
- `src/app/[locale]/admin/v2/payouts/page.tsx` — admin weekly payout page

### Modified Files
- `src/app/api/v2/speaker/recordings/route.ts` — add `weeklyProgress` to response
- `src/app/[locale]/speaker/SpeakerDashboardClient.tsx` — add weekly progress card
- `src/app/[locale]/admin/v2/AdminV2DashboardClient.tsx` — update nav link from old payments page to new payouts page (if linked)

### Removed Files
- `src/app/[locale]/admin/payments/page.tsx` — replaced by new payouts page

### Unchanged
- Prisma schema — no new tables needed. Using existing `Payment`, `Recording`, `Language` models.
- `WalletTransaction` — not used in the new flow. Existing records stay for history but no new ones are created.

## Week Boundary Helper

Utility function used by both speaker and admin APIs:

```typescript
function getCurrentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const diffToSaturday = day >= 6 ? day - 6 : day + 1; // days since last Saturday
  const start = new Date(now);
  start.setDate(now.getDate() - diffToSaturday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
```

## Edge Cases

- **Speaker records in multiple languages**: sum all approved durations across languages for milestone check. Payout uses per-language rates for the per-minute calculation, or flat 1,000 Le if milestone is hit.
- **Recording approved after week ends**: the recording's `createdAt` determines which week it belongs to, not the approval date. This way speakers know exactly how much they recorded that week.
- **Partial weeks**: first and last weeks work the same — no proration.
- **No recordings**: speaker doesn't appear in the payout table.
