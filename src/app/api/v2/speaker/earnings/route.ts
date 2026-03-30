import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import {
  getWeekRange,
  APPROVED_STATUSES,
  MILESTONE_MINUTES,
  MILESTONE_PAYOUT_LE,
} from "@/lib/utils/week";

// GET /api/v2/speaker/earnings - Get speaker's weekly earnings history
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all recordings for this speaker grouped by week
    const allRecordings = await prisma.recording.findMany({
      where: {
        speakerId: user.id,
        status: { not: "REJECTED" },
      },
      select: {
        durationSec: true,
        status: true,
        createdAt: true,
        language: { select: { speakerRatePerMinute: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all payments for this speaker
    const payments = await prisma.payment.findMany({
      where: {
        userId: user.id,
        reference: { startsWith: "weekly:" },
      },
      select: { reference: true, amountCents: true },
    });
    const paymentMap = new Map(
      payments.map((p) => [p.reference, p.amountCents])
    );

    // Group recordings by week (Monday start)
    const weekMap = new Map<
      string,
      {
        approvedSec: number;
        approvedPerMinute: number;
        pendingSec: number;
        pendingPerMinute: number;
        totalRecordings: number;
      }
    >();

    for (const rec of allRecordings) {
      const { start } = getWeekRange(
        rec.createdAt.toISOString().slice(0, 10)
      );
      const weekKey = start.toISOString().slice(0, 10);
      const entry = weekMap.get(weekKey) || {
        approvedSec: 0,
        approvedPerMinute: 0,
        pendingSec: 0,
        pendingPerMinute: 0,
        totalRecordings: 0,
      };

      entry.totalRecordings++;
      const rate = rec.language.speakerRatePerMinute ?? 2.5;

      if ((APPROVED_STATUSES as readonly string[]).includes(rec.status)) {
        entry.approvedSec += rec.durationSec;
        entry.approvedPerMinute += (rec.durationSec / 60) * rate;
      } else if (rec.status === "PENDING_REVIEW") {
        entry.pendingSec += rec.durationSec;
        entry.pendingPerMinute += (rec.durationSec / 60) * rate;
      }

      weekMap.set(weekKey, entry);
    }

    // Build weekly summaries
    const weeks = Array.from(weekMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0])) // newest first
      .map(([weekKey, data]) => {
        const { start, end } = getWeekRange(weekKey);
        const weekRef = `weekly:${weekKey}`;
        const approvedMinutes = data.approvedSec / 60;
        const milestoneHit = approvedMinutes >= MILESTONE_MINUTES;

        let payoutLe: number;
        if (milestoneHit) {
          const extraMinutes = approvedMinutes - MILESTONE_MINUTES;
          const avgRate =
            approvedMinutes > 0
              ? data.approvedPerMinute / approvedMinutes
              : 2.5;
          payoutLe = MILESTONE_PAYOUT_LE + extraMinutes * avgRate;
        } else {
          payoutLe = data.approvedPerMinute;
        }

        // Estimated including pending
        const totalMinutes = approvedMinutes + data.pendingSec / 60;
        const totalPerMinute =
          data.approvedPerMinute + data.pendingPerMinute;
        const estMilestoneHit = totalMinutes >= MILESTONE_MINUTES;
        let estimatedPayoutLe: number;
        if (estMilestoneHit) {
          const extraMinutes = totalMinutes - MILESTONE_MINUTES;
          const avgRate =
            totalMinutes > 0 ? totalPerMinute / totalMinutes : 2.5;
          estimatedPayoutLe = MILESTONE_PAYOUT_LE + extraMinutes * avgRate;
        } else {
          estimatedPayoutLe = totalPerMinute;
        }

        const paidAmountCents = paymentMap.get(weekRef);

        return {
          weekStart: start.toISOString().slice(0, 10),
          weekEnd: end.toISOString().slice(0, 10),
          approvedDurationSec: data.approvedSec,
          pendingDurationSec: data.pendingSec,
          totalRecordings: data.totalRecordings,
          milestoneHit,
          payoutLe: Math.round(payoutLe * 100) / 100,
          estimatedPayoutLe: Math.round(estimatedPayoutLe * 100) / 100,
          isPaid: paidAmountCents !== undefined,
          paidAmountLe: paidAmountCents !== undefined ? paidAmountCents / 100 : null,
        };
      });

    return NextResponse.json({ weeks });
  } catch (error) {
    console.error("Error fetching speaker earnings:", error);
    return NextResponse.json(
      { error: "Failed to fetch earnings history" },
      { status: 500 }
    );
  }
}
