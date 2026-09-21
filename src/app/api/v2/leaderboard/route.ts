import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { POINTS, avatarFor, dayKey, periodStart } from "@/lib/domain/gamification";

export const dynamic = "force-dynamic";

// GET /api/v2/leaderboard?period=today|week|month|all&languageId=...
//
// Ranks transcribers on APPROVED work only. Ranking on raw submissions would pay
// out for speed regardless of correctness and quietly degrade the dataset, so a
// rejected item subtracts points instead of being ignored.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "week";
    const languageId = searchParams.get("languageId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    const since = periodStart(period);
    const timeFilter = since ? { gte: since } : undefined;

    const recordingFilter = languageId ? { recording: { languageId } } : {};

    // --- Work in the requested window -------------------------------------
    const [transcriptions, englishRecords, pipelineItems] = await Promise.all([
      prisma.transcription.findMany({
        where: {
          ...(timeFilter ? { submittedAt: timeFilter } : {}),
          ...recordingFilter,
        },
        select: {
          transcriberId: true,
          status: true,
          submittedAt: true,
          recording: { select: { durationSec: true } },
        },
      }),
      prisma.recording.findMany({
        where: {
          englishTranslatedById: { not: null },
          ...(timeFilter ? { englishTranslatedAt: timeFilter } : {}),
          ...(languageId ? { languageId } : {}),
        },
        select: {
          englishTranslatedById: true,
          englishTranslatedAt: true,
          englishTranslationStatus: true,
        },
      }),
      // Pipeline items carry no language, so a language filter excludes them.
      languageId
        ? Promise.resolve([])
        : prisma.reviewQueue.findMany({
            where: {
              status: "approved",
              ...(timeFilter ? { updatedAt: timeFilter } : {}),
            },
            select: { reviewerId: true, secondReviewerId: true, updatedAt: true },
          }),
    ]);

    interface Row {
      userId: string;
      approved: number;
      rejected: number;
      pending: number;
      english: number;
      pipeline: number;
      seconds: number;
      points: number;
      days: Set<string>;
    }
    const rows = new Map<string, Row>();
    const row = (id: string): Row => {
      let r = rows.get(id);
      if (!r) {
        r = {
          userId: id,
          approved: 0,
          rejected: 0,
          pending: 0,
          english: 0,
          pipeline: 0,
          seconds: 0,
          points: 0,
          days: new Set(),
        };
        rows.set(id, r);
      }
      return r;
    };

    for (const t of transcriptions) {
      const r = row(t.transcriberId);
      if (t.status === "APPROVED") {
        r.approved++;
        r.points += POINTS.transcription;
        r.seconds += t.recording?.durationSec || 0;
        r.days.add(dayKey(t.submittedAt));
      } else if (t.status === "REJECTED") {
        r.rejected++;
        r.points += POINTS.rejectionPenalty;
      } else {
        r.pending++;
      }
    }

    for (const e of englishRecords) {
      if (!e.englishTranslatedById) continue;
      const r = row(e.englishTranslatedById);
      // Translations are not rejected outright today; count anything not REJECTED.
      if (e.englishTranslationStatus === "REJECTED") {
        r.rejected++;
        r.points += POINTS.rejectionPenalty;
        continue;
      }
      r.english++;
      r.points += POINTS.english;
      if (e.englishTranslatedAt) r.days.add(dayKey(e.englishTranslatedAt));
    }

    for (const p of pipelineItems as any[]) {
      for (const id of [p.reviewerId, p.secondReviewerId]) {
        if (!id) continue;
        const r = row(id);
        r.pipeline++;
        r.points += POINTS.pipeline;
        if (p.updatedAt) r.days.add(dayKey(p.updatedAt));
      }
    }

    if (rows.size === 0) {
      return NextResponse.json({ period, entries: [], me: null, totals: null });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: [...rows.keys()] } },
      select: { id: true, displayName: true, email: true, avatarId: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    const entries = [...rows.values()]
      .map((r) => {
        const u = userById.get(r.userId);
        const reviewed = r.approved + r.rejected;
        // Anonymise the handle: first name only, so a public board never leaks
        // an email address.
        const name =
          u?.displayName?.trim() || (u?.email ? u.email.split("@")[0] : "Someone");
        return {
          userId: r.userId,
          name,
          avatar: avatarFor(r.userId, u?.avatarId),
          points: Math.max(0, r.points),
          approved: r.approved,
          rejected: r.rejected,
          pending: r.pending,
          english: r.english,
          pipeline: r.pipeline,
          minutes: Math.round((r.seconds / 60) * 10) / 10,
          accuracy: reviewed > 0 ? Math.round((r.approved / reviewed) * 100) : null,
          activeDays: r.days.size,
        };
      })
      .filter((e) => e.points > 0 || e.approved > 0)
      .sort((a, b) => b.points - a.points || b.approved - a.approved)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    const meIndex = entries.findIndex((e) => e.userId === user.id);
    const me = meIndex >= 0 ? entries[meIndex] : null;
    // The person immediately above is the strongest motivator on a leaderboard:
    // a concrete, closable gap beats an abstract total.
    const rival = meIndex > 0 ? entries[meIndex - 1] : null;

    return NextResponse.json({
      period,
      entries: entries.slice(0, limit),
      me: me
        ? {
            ...me,
            rival: rival
              ? { name: rival.name, points: rival.points, gap: rival.points - me.points }
              : null,
          }
        : null,
      totals: {
        participants: entries.length,
        approved: entries.reduce((s, e) => s + e.approved, 0),
        points: entries.reduce((s, e) => s + e.points, 0),
      },
    });
  } catch (error) {
    console.error("Error building leaderboard:", error);
    return NextResponse.json({ error: "Failed to build leaderboard" }, { status: 500 });
  }
}
