import { prisma } from "@/lib/infra/db/prisma";
import { POINTS, avatarFor, periodStart } from "@/lib/domain/gamification";
import { cached } from "@/lib/infra/cache";

/* Leaderboard aggregation, shared by the full board and the dashboard summary so
 * a transcriber's rank can never differ between the two views.
 *
 * Aggregated in the database rather than by loading rows: the naive version
 * pulled every transcription in the period. Queries run in sequence because each
 * API route is a serverless process with a pool of one — firing them together
 * would make a single request hold several connections.
 */

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatar: { emoji: string; gradient: string; id?: string };
  rank: number;
  points: number;
  approved: number;
  rejected: number;
  english: number;
  pipeline: number;
  minutes: number;
  accuracy: number | null;
}

interface Row {
  userId: string;
  approved: number;
  rejected: number;
  english: number;
  pipeline: number;
  seconds: number;
  points: number;
}

/* Cached because it is the same for everyone: one aggregate serves every
 * transcriber looking at the board, instead of one per page load. A minute stale
 * is invisible on a ranking, and the viewer's own counters come from their
 * profile, which is not cached. */
export function buildLeaderboard(
  period: string,
  languageId?: string | null
): Promise<LeaderboardEntry[]> {
  return cached(`leaderboard:${period}:${languageId ?? "all"}`, 60_000, () =>
    computeLeaderboard(period, languageId)
  );
}

async function computeLeaderboard(
  period: string,
  languageId?: string | null
): Promise<LeaderboardEntry[]> {
  const since = periodStart(period);

  const rows = new Map<string, Row>();
  const row = (id: string): Row => {
    let r = rows.get(id);
    if (!r) {
      r = { userId: id, approved: 0, rejected: 0, english: 0, pipeline: 0, seconds: 0, points: 0 };
      rows.set(id, r);
    }
    return r;
  };

  // --- Transcriptions: counts and audio seconds ---
  const txRows = await prisma.$queryRaw<
    { user_id: string; status: string; n: bigint; seconds: number | null }[]
  >`
    SELECT t."transcriberId"     AS user_id,
           t.status::text        AS status,
           COUNT(*)              AS n,
           SUM(r."durationSec")  AS seconds
    FROM "Transcription" t
    JOIN "Recording" r ON r.id = t."recordingId"
    WHERE (${since}::timestamptz IS NULL OR t."submittedAt" >= ${since}::timestamptz)
      AND (${languageId ?? null}::text IS NULL OR r."languageId" = ${languageId ?? null}::text)
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

  // --- English translations ---
  const enRows = await prisma.$queryRaw<{ user_id: string; status: string | null; n: bigint }[]>`
    SELECT r."englishTranslatedById"            AS user_id,
           r."englishTranslationStatus"::text   AS status,
           COUNT(*)                             AS n
    FROM "Recording" r
    WHERE r."englishTranslatedById" IS NOT NULL
      AND (${since}::timestamptz IS NULL OR r."englishTranslatedAt" >= ${since}::timestamptz)
      AND (${languageId ?? null}::text IS NULL OR r."languageId" = ${languageId ?? null}::text)
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

  // --- Pipeline corrections (carry no language, so skipped when filtering) ---
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

  if (rows.size === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: [...rows.keys()] } },
    select: { id: true, displayName: true, email: true, avatarId: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  return [...rows.values()]
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
}

/** The viewer's own standing, plus the person directly above them. */
export function standingFor(entries: LeaderboardEntry[], userId: string) {
  const index = entries.findIndex((e) => e.userId === userId);
  if (index < 0) return null;
  // The person immediately above is the strongest motivator on a leaderboard:
  // a concrete, closable gap beats an abstract total.
  const rival = index > 0 ? entries[index - 1] : null;
  return {
    ...entries[index],
    rival: rival
      ? { name: rival.name, points: rival.points, gap: rival.points - entries[index].points }
      : null,
  };
}
