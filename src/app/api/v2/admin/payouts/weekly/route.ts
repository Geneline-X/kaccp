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
          language: { select: { speakerRatePerMinute: true } },
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
    const pendingMap = new Map<string, { totalSec: number; perMinuteTotal: number }>();
    for (const rec of pendingRecordings) {
      const entry = pendingMap.get(rec.speakerId) || { totalSec: 0, perMinuteTotal: 0 };
      entry.totalSec += rec.durationSec;
      entry.perMinuteTotal += (rec.durationSec / 60) * (rec.language.speakerRatePerMinute ?? 2.5);
      pendingMap.set(rec.speakerId, entry);
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
      const pending = pendingMap.get(s.id) || { totalSec: 0, perMinuteTotal: 0 };
      const approvedMinutes = data.totalSec / 60;
      const milestonesReached = Math.floor(approvedMinutes / MILESTONE_MINUTES);
      const milestoneHit = milestonesReached >= 1;
      let payoutLe: number;
      if (milestoneHit) {
        const remainderMinutes = approvedMinutes - milestonesReached * MILESTONE_MINUTES;
        const avgRate = approvedMinutes > 0 ? data.perMinuteTotal / approvedMinutes : 2.5;
        payoutLe = milestonesReached * MILESTONE_PAYOUT_LE + remainderMinutes * avgRate;
      } else {
        payoutLe = data.perMinuteTotal;
      }

      // Estimated payout if all pending recordings were also approved
      const totalMinutes = approvedMinutes + pending.totalSec / 60;
      const totalPerMinute = data.perMinuteTotal + pending.perMinuteTotal;
      const estMilestonesReached = Math.floor(totalMinutes / MILESTONE_MINUTES);
      const estMilestoneHit = estMilestonesReached >= 1;
      let estimatedPayoutLe: number;
      if (estMilestoneHit) {
        const remainderMinutes = totalMinutes - estMilestonesReached * MILESTONE_MINUTES;
        const avgRate = totalMinutes > 0 ? totalPerMinute / totalMinutes : 2.5;
        estimatedPayoutLe = estMilestonesReached * MILESTONE_PAYOUT_LE + remainderMinutes * avgRate;
      } else {
        estimatedPayoutLe = totalPerMinute;
      }

      return {
        id: s.id,
        displayName: s.displayName,
        email: s.email,
        approvedDurationSec: data.totalSec,
        approvedMinutes: Math.round(approvedMinutes * 100) / 100,
        pendingDurationSec: pending.totalSec,
        milestoneHit,
        payoutLe: Math.round(payoutLe * 100) / 100,
        estimatedPayoutLe: Math.round(estimatedPayoutLe * 100) / 100,
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

    // ---- Transcribers: approved transcriptions in this week, grouped by transcriber ----
    // Approved work is bucketed by reviewedAt (when it became payable); pending
    // (submitted, awaiting review) is bucketed by submittedAt for the estimate.
    const txWeekRef = `weekly-transcriber:${start.toISOString().slice(0, 10)}`;
    const txSelect = {
      transcriberId: true,
      recording: {
        select: {
          durationSec: true,
          language: { select: { transcriberRatePerMin: true } },
        },
      },
    } as const;
    const [approvedTx, pendingTx] = await Promise.all([
      prisma.transcription.findMany({
        where: { status: "APPROVED", reviewedAt: { gte: start, lte: end } },
        select: txSelect,
      }),
      prisma.transcription.findMany({
        where: { status: "PENDING_REVIEW", submittedAt: { gte: start, lte: end } },
        select: txSelect,
      }),
    ]);

    const accumulate = (
      list: typeof approvedTx,
    ): Map<string, { totalSec: number; perMinuteTotal: number }> => {
      const map = new Map<string, { totalSec: number; perMinuteTotal: number }>();
      for (const t of list) {
        const entry = map.get(t.transcriberId) || { totalSec: 0, perMinuteTotal: 0 };
        entry.totalSec += t.recording.durationSec;
        entry.perMinuteTotal +=
          (t.recording.durationSec / 60) *
          (t.recording.language.transcriberRatePerMin ?? 1.5);
        map.set(t.transcriberId, entry);
      }
      return map;
    };

    const txMap = accumulate(approvedTx);
    const txPendingMap = accumulate(pendingTx);

    const transcriberIds = Array.from(
      new Set([...txMap.keys(), ...txPendingMap.keys()])
    );
    const [transcriberUsers, existingTxPayments] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: transcriberIds } },
        select: { id: true, displayName: true, email: true },
      }),
      prisma.payment.findMany({
        where: { userId: { in: transcriberIds }, reference: txWeekRef },
        select: { id: true, userId: true },
      }),
    ]);
    const txPaidMap = new Map(existingTxPayments.map((p) => [p.userId, p.id]));

    const transcriberRows = transcriberUsers.map((u) => {
      const data = txMap.get(u.id) || { totalSec: 0, perMinuteTotal: 0 };
      const pending = txPendingMap.get(u.id) || { totalSec: 0, perMinuteTotal: 0 };
      const approvedMinutes = data.totalSec / 60;
      // Straight per-minute payout at each recording's transcriber rate (no milestone).
      return {
        id: u.id,
        displayName: u.displayName,
        email: u.email,
        approvedDurationSec: data.totalSec,
        approvedMinutes: Math.round(approvedMinutes * 100) / 100,
        pendingDurationSec: pending.totalSec,
        payoutLe: Math.round(data.perMinuteTotal * 100) / 100,
        estimatedPayoutLe:
          Math.round((data.perMinuteTotal + pending.perMinuteTotal) * 100) / 100,
        paid: txPaidMap.has(u.id),
        paymentId: txPaidMap.get(u.id) || undefined,
      };
    });

    transcriberRows.sort((a, b) => {
      if (a.paid !== b.paid) return a.paid ? 1 : -1;
      return b.approvedDurationSec - a.approvedDurationSec;
    });

    const transcriberSummary = {
      totalTranscribers: transcriberRows.length,
      totalPayoutLe:
        Math.round(
          transcriberRows.reduce((sum, r) => sum + r.payoutLe, 0) * 100
        ) / 100,
      paidCount: transcriberRows.filter((r) => r.paid).length,
    };

    return NextResponse.json({
      week: {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      },
      speakers: speakerRows,
      summary,
      transcribers: transcriberRows,
      transcriberSummary,
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
    const { weekStart, speakerIds, transcriberIds, payAll, role } = body;

    if (!weekStart) {
      return NextResponse.json(
        { error: "weekStart is required" },
        { status: 400 }
      );
    }

    const { start, end } = getWeekRange(weekStart);

    // ---- Transcriber payouts (separate ledger reference from speakers) ----
    if (role === "transcriber") {
      const txWeekRef = `weekly-transcriber:${start.toISOString().slice(0, 10)}`;

      // Recalculate from DB (don't trust client amounts)
      const approvedTx = await prisma.transcription.findMany({
        where: { status: "APPROVED", reviewedAt: { gte: start, lte: end } },
        select: {
          transcriberId: true,
          recording: {
            select: {
              durationSec: true,
              language: { select: { transcriberRatePerMin: true } },
            },
          },
        },
      });

      const txMap = new Map<string, { perMinuteTotal: number }>();
      for (const t of approvedTx) {
        const entry = txMap.get(t.transcriberId) || { perMinuteTotal: 0 };
        entry.perMinuteTotal +=
          (t.recording.durationSec / 60) *
          (t.recording.language.transcriberRatePerMin ?? 1.5);
        txMap.set(t.transcriberId, entry);
      }

      let targetIds: string[];
      if (payAll) {
        targetIds = Array.from(txMap.keys());
      } else if (transcriberIds && transcriberIds.length > 0) {
        targetIds = transcriberIds;
      } else {
        return NextResponse.json(
          { error: "transcriberIds or payAll is required" },
          { status: 400 }
        );
      }

      const created: string[] = [];
      const skipped: string[] = [];

      for (const id of targetIds) {
        const data = txMap.get(id);
        if (!data) {
          skipped.push(id);
          continue;
        }
        const amountCents = Math.round(data.perMinuteTotal * 100);
        if (amountCents <= 0) {
          skipped.push(id);
          continue;
        }
        try {
          const payment = await prisma.payment.create({
            data: {
              userId: id,
              amountCents,
              currency: "SLE",
              status: "PAID",
              reference: txWeekRef,
              notes: "Transcriber per-minute",
            },
          });
          created.push(payment.id);
        } catch (err: any) {
          if (err?.code === "P2002") {
            skipped.push(id);
          } else {
            throw err;
          }
        }
      }

      return NextResponse.json({ success: true, created, skipped });
    }

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
      const milestonesReached = Math.floor(approvedMinutes / MILESTONE_MINUTES);
      const milestoneHit = milestonesReached >= 1;
      let payoutLe: number;
      if (milestoneHit) {
        const remainderMinutes = approvedMinutes - milestonesReached * MILESTONE_MINUTES;
        const avgRate = approvedMinutes > 0 ? data.perMinuteTotal / approvedMinutes : 2.5;
        payoutLe = milestonesReached * MILESTONE_PAYOUT_LE + remainderMinutes * avgRate;
      } else {
        payoutLe = data.perMinuteTotal;
      }
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
