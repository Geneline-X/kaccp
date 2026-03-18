import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import {
  getWeekRange,
  APPROVED_STATUSES,
  MILESTONE_MINUTES,
  MILESTONE_PAYOUT_LE,
} from "@/lib/utils/week";

// GET /api/v2/admin/payouts/weekly - Get payout summary for a week
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const userRoles =
      (user as any)?.roles?.length > 0 ? (user as any).roles : [user?.role];
    if (
      !user ||
      (!userRoles.includes("ADMIN") && !userRoles.includes("REVIEWER"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const weekStartParam = searchParams.get("weekStart") || undefined;
    const { start, end } = getWeekRange(weekStartParam);
    const weekRef = `weekly:${start.toISOString().slice(0, 10)}`;

    // Find all audio-approved recordings in this week, grouped by speaker + language
    const [recordings, pendingRecordings] = await Promise.all([
      prisma.recording.findMany({
        where: {
          status: { in: [...APPROVED_STATUSES] },
          createdAt: { gte: start, lte: end },
        },
        select: {
          speakerId: true,
          durationSec: true,
          language: { select: { speakerRatePerMinute: true } },
        },
      }),
      prisma.recording.findMany({
        where: {
          status: "PENDING_REVIEW",
          createdAt: { gte: start, lte: end },
        },
        select: {
          speakerId: true,
          durationSec: true,
        },
      }),
    ]);

    // Group by speaker
    const speakerMap = new Map<
      string,
      { totalSec: number; perMinuteTotal: number }
    >();
    for (const rec of recordings) {
      const entry = speakerMap.get(rec.speakerId) || {
        totalSec: 0,
        perMinuteTotal: 0,
      };
      entry.totalSec += rec.durationSec;
      entry.perMinuteTotal +=
        (rec.durationSec / 60) * (rec.language.speakerRatePerMinute ?? 2.5);
      speakerMap.set(rec.speakerId, entry);
    }

    // Group pending recordings by speaker
    const pendingMap = new Map<string, number>();
    for (const rec of pendingRecordings) {
      pendingMap.set(rec.speakerId, (pendingMap.get(rec.speakerId) || 0) + rec.durationSec);
    }

    if (speakerMap.size === 0 && pendingMap.size === 0) {
      return NextResponse.json({
        week: {
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
        },
        speakers: [],
        summary: {
          totalSpeakers: 0,
          milestoneSpeakers: 0,
          totalPayoutLe: 0,
          paidCount: 0,
        },
      });
    }

    // Fetch speaker details (include speakers with only pending recordings too)
    const speakerIds = Array.from(new Set([...speakerMap.keys(), ...pendingMap.keys()]));
    const [speakers, existingPayments] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: speakerIds } },
        select: { id: true, displayName: true, email: true },
      }),
      prisma.payment.findMany({
        where: { userId: { in: speakerIds }, reference: weekRef },
        select: { id: true, userId: true },
      }),
    ]);

    const paidMap = new Map(existingPayments.map((p) => [p.userId, p.id]));

    const speakerRows = speakers.map((s) => {
      const data = speakerMap.get(s.id) || { totalSec: 0, perMinuteTotal: 0 };
      const approvedMinutes = data.totalSec / 60;
      const milestoneHit = approvedMinutes >= MILESTONE_MINUTES;
      const payoutLe = milestoneHit
        ? Math.max(data.perMinuteTotal, MILESTONE_PAYOUT_LE)
        : data.perMinuteTotal;

      return {
        id: s.id,
        displayName: s.displayName,
        email: s.email,
        approvedDurationSec: data.totalSec,
        approvedMinutes: Math.round(approvedMinutes * 100) / 100,
        pendingDurationSec: pendingMap.get(s.id) || 0,
        milestoneHit,
        payoutLe: Math.round(payoutLe * 100) / 100,
        paid: paidMap.has(s.id),
        paymentId: paidMap.get(s.id) || undefined,
      };
    });

    // Sort: unpaid first, then by hours descending
    speakerRows.sort((a, b) => {
      if (a.paid !== b.paid) return a.paid ? 1 : -1;
      return b.approvedDurationSec - a.approvedDurationSec;
    });

    const summary = {
      totalSpeakers: speakerRows.length,
      milestoneSpeakers: speakerRows.filter((s) => s.milestoneHit).length,
      totalPayoutLe: Math.round(
        speakerRows.reduce((sum, s) => sum + s.payoutLe, 0) * 100
      ) / 100,
      paidCount: speakerRows.filter((s) => s.paid).length,
    };

    return NextResponse.json({
      week: {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      },
      speakers: speakerRows,
      summary,
    });
  } catch (error) {
    console.error("Error fetching weekly payouts:", error);
    return NextResponse.json(
      { error: "Failed to fetch weekly payouts" },
      { status: 500 }
    );
  }
}

// POST /api/v2/admin/payouts/weekly - Process payouts
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const userRoles =
      (user as any)?.roles?.length > 0 ? (user as any).roles : [user?.role];
    if (!user || !userRoles.includes("ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { weekStart, speakerIds, payAll } = body;

    if (!weekStart) {
      return NextResponse.json(
        { error: "weekStart is required" },
        { status: 400 }
      );
    }

    const { start, end } = getWeekRange(weekStart);
    const weekRef = `weekly:${start.toISOString().slice(0, 10)}`;

    // Recalculate from DB (don't trust client amounts)
    const recordings = await prisma.recording.findMany({
      where: {
        status: { in: [...APPROVED_STATUSES] },
        createdAt: { gte: start, lte: end },
      },
      select: {
        speakerId: true,
        durationSec: true,
        language: { select: { speakerRatePerMinute: true } },
      },
    });

    const speakerMap = new Map<
      string,
      { totalSec: number; perMinuteTotal: number }
    >();
    for (const rec of recordings) {
      const entry = speakerMap.get(rec.speakerId) || {
        totalSec: 0,
        perMinuteTotal: 0,
      };
      entry.totalSec += rec.durationSec;
      entry.perMinuteTotal +=
        (rec.durationSec / 60) * (rec.language.speakerRatePerMinute ?? 2.5);
      speakerMap.set(rec.speakerId, entry);
    }

    // Determine which speakers to pay
    let targetIds: string[];
    if (payAll) {
      targetIds = Array.from(speakerMap.keys());
    } else if (speakerIds && speakerIds.length > 0) {
      targetIds = speakerIds;
    } else {
      return NextResponse.json(
        { error: "speakerIds or payAll is required" },
        { status: 400 }
      );
    }

    const created: string[] = [];
    const skipped: string[] = [];

    for (const speakerId of targetIds) {
      const data = speakerMap.get(speakerId);
      if (!data) {
        skipped.push(speakerId);
        continue;
      }

      const approvedMinutes = data.totalSec / 60;
      const milestoneHit = approvedMinutes >= MILESTONE_MINUTES;
      const payoutLe = milestoneHit
        ? Math.max(data.perMinuteTotal, MILESTONE_PAYOUT_LE)
        : data.perMinuteTotal;
      const amountCents = Math.round(payoutLe * 100);

      if (amountCents <= 0) {
        skipped.push(speakerId);
        continue;
      }

      try {
        const payment = await prisma.payment.create({
          data: {
            userId: speakerId,
            amountCents,
            currency: "SLE",
            status: "PAID",
            reference: weekRef,
            notes: milestoneHit ? "Milestone" : "Per-minute",
          },
        });
        created.push(payment.id);
      } catch (err: any) {
        // Unique constraint violation = already paid
        if (err?.code === "P2002") {
          skipped.push(speakerId);
        } else {
          throw err;
        }
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
    });
  } catch (error) {
    console.error("Error processing weekly payouts:", error);
    return NextResponse.json(
      { error: "Failed to process payouts" },
      { status: 500 }
    );
  }
}
