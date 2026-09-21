import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { POINTS, avatarFor, periodStart } from "@/lib/domain/gamification";

export const dynamic = "force-dynamic";

// GET /api/v2/leaderboard?period=today|week|month|all&languageId=...
//
// Ranks transcribers on APPROVED work only. Ranking on raw submissions would pay
// out for speed regardless of correctness and quietly degrade the dataset, so a
// rejected item subtracts points instead of being ignored.
//
// Aggregated in the database rather than by loading rows into the app: the naive
// version pulled every transcription in the period (thousands of rows) and ran
// its queries with Promise.all, holding several pool connections per request.
// These run in sequence and return one row per user.
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

    interface Row {
      userId: string;
      approved: number;
      rejected: number;
      english: number;
      pipeline: number;
      seconds: number;
      points: number;
    }
    const rows = new Map<string, Row>();
    const row = (id: string): Row => {
      let r = rows.get(id);
      if (!r) {
        r = { userId: id, approved: 0, rejected: 0, english: 0, pipeline: 0, seconds: 0, points: 0 };
        rows.set(id, r);
      }
      return r;
    };

    // --- 1. Transcriptions: counts and audio seconds, grouped in the database ---
    const txRows = await prisma.$queryRaw<
      { user_id: string; status: string; n: bigint; seconds: number | null }[]
    >`
      SELECT t."transcriberId" AS user_id,
             t.status::text     AS status,
             COUNT(*)           AS n,
             SUM(r."durationSec") AS seconds
      FROM "Transcription" t
      JOIN "Recording" r ON r.id = t."recordingId"
      WHERE (${since}::timestamptz IS NULL OR t."submittedAt" >= ${since}::timestamptz)
        AND (${languageId}::text IS NULL OR r."languageId" = ${languageId}::text)
      GROUP BY 1, 2
    `;

    for (const t of txRows) {
      const r = row(t.user_id);
      const n = Number(t.n);
      if (t.status === "APPROVED") {
        r.approved += n;
        r.points += n * POINTS.transcription;
        r.seconds += Number(t.seconds || 0);
      } else if (t.status === "REJECTED") {
        r.rejected += n;
        r.points += n * POINTS.rejectionPenalty;
      }
    }

    // --- 2. English translations ---
    const enRows = await prisma.$queryRaw<{ user_id: string; status: string | null; n: bigint }[]>`
      SELECT r."englishTranslatedById" AS user_id,
             r."englishTranslationStatus"::text AS status,
             COUNT(*) AS n
      FROM "Recording" r
      WHERE r."englishTranslatedById" IS NOT NULL
        AND (${since}::timestamptz IS NULL OR r."englishTranslatedAt" >= ${since}::timestamptz)
        AND (${languageId}::text IS NULL OR r."languageId" = ${languageId}::text)
      GROUP BY 1, 2
    `;

    for (const e of enRows) {
      const r = row(e.user_id);
      const n = Number(e.n);
      if (e.status === "REJECTED") {
        r.rejected += n;
        r.points += n * POINTS.rejectionPenalty;
      } else {
        r.english += n;
        r.points += n * POINTS.english;
      }
    }

    // --- 3. Pipeline corrections (no language, so skipped when filtering) ---
    if (!languageId) {
      const pipeRows = await prisma.$queryRaw<{ user_id: string; n: bigint }[]>`
        SELECT user_id, COUNT(*) AS n FROM (
          SELECT "reviewerId" AS user_id FROM "ReviewQueue"
          WHERE status = 'approved' AND "reviewerId" IS NOT NULL
            AND (${since}::timestamptz IS NULL OR "updatedAt" >= ${since}::timestamptz)
          UNION ALL
          SELECT "secondReviewerId" AS user_id FROM "ReviewQueue"
          WHERE status = 'approved' AND "secondReviewerId" IS NOT NULL
            AND (${since}::timestamptz IS NULL OR "updatedAt" >= ${since}::timestamptz)
        ) q
        GROUP BY 1
      `;
      for (const p of pipeRows) {
        const r = row(p.user_id);
        const n = Number(p.n);
        r.pipeline += n;
        r.points += n * POINTS.pipeline;
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
        // First name only, so a shared board never exposes an email address.
        const name = u?.displayName?.trim() || (u?.email ? u.email.split("@")[0] : "Someone");
        return {
          userId: r.userId,
          name,
          avatar: avatarFor(r.userId, u?.avatarId),
          points: Math.max(0, r.points),
          approved: r.approved,
          rejected: r.rejected,
          english: r.english,
          pipeline: r.pipeline,
          minutes: Math.round((r.seconds / 60) * 10) / 10,
          accuracy: reviewed > 0 ? Math.round((r.approved / reviewed) * 100) : null,
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
