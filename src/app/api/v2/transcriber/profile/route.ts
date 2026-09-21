import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import {
  POINTS,
  DEFAULT_DAILY_GOAL,
  avatarFor,
  levelProgress,
  computeBadges,
  streakFromDays,
  dayKey,
  nextMilestone,
  milestoneFor,
  projectedDailyTotal,
  AVATAR_CATALOG,
} from "@/lib/domain/gamification";

export const dynamic = "force-dynamic";

// GET /api/v2/transcriber/profile — the signed-in transcriber's game state:
// level, streak, today's progress and badges.
//
// Everything is derived from existing work records rather than stored counters,
// so it can never drift out of sync with the actual data.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Sequential, not Promise.all: with a serverless-sized pool, firing these
    // together makes one request hold several connections at once, which is what
    // exhausts a small managed database.
    const transcriptions = await prisma.transcription.findMany({
      where: { transcriberId: user.id },
      select: {
        status: true,
        submittedAt: true,
        recording: { select: { durationSec: true } },
      },
    });
    const english = await prisma.recording.findMany({
      where: { englishTranslatedById: user.id },
      select: { englishTranslatedAt: true, englishTranslationStatus: true },
    });
    const pipeline = await prisma.reviewQueue.findMany({
      where: {
        status: "approved",
        OR: [{ reviewerId: user.id }, { secondReviewerId: user.id }],
      },
      select: { updatedAt: true },
    });

    const today = dayKey(new Date());
    const perDay = new Map<string, number>();
    const activeDays = new Set<string>();

    let approved = 0;
    let rejected = 0;
    let pending = 0;
    let seconds = 0;
    let xp = 0;

    const credit = (at: Date | null) => {
      if (!at) return;
      const k = dayKey(at);
      perDay.set(k, (perDay.get(k) || 0) + 1);
      activeDays.add(k);
    };

    for (const t of transcriptions) {
      if (t.status === "APPROVED") {
        approved++;
        xp += POINTS.transcription;
        seconds += t.recording?.durationSec || 0;
        credit(t.submittedAt);
      } else if (t.status === "REJECTED") {
        rejected++;
        xp += POINTS.rejectionPenalty;
      } else {
        pending++;
      }
    }

    let englishCount = 0;
    for (const e of english) {
      if (e.englishTranslationStatus === "REJECTED") {
        rejected++;
        xp += POINTS.rejectionPenalty;
        continue;
      }
      englishCount++;
      xp += POINTS.english;
      credit(e.englishTranslatedAt);
    }

    for (const p of pipeline) {
      approved++;
      xp += POINTS.pipeline;
      credit(p.updatedAt);
    }

    xp = Math.max(0, xp);
    const reviewed = approved + rejected;
    const bestDay = perDay.size ? Math.max(...perDay.values()) : 0;
    const streak = streakFromDays(activeDays);
    const doneToday = perDay.get(today) || 0;

    // Last 14 days, oldest first — drives the activity sparkline.
    const history: { day: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const k = dayKey(d);
      history.push({ day: k, count: perDay.get(k) || 0 });
    }

    const badges = computeBadges({
      approvedTotal: approved + englishCount,
      streakDays: streak,
      bestDay,
      accuracy: reviewed > 0 ? approved / reviewed : 0,
      reviewedTotal: reviewed,
      englishTotal: englishCount,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.displayName || user.email?.split("@")[0] || "You",
        avatar: avatarFor(user.id, (user as any).avatarId),
        avatarId: (user as any).avatarId ?? null,
      },
      level: levelProgress(xp),
      streak,
      dailyGoal: DEFAULT_DAILY_GOAL,
      doneToday,
      bestDay,
      stats: {
        approved,
        rejected,
        pending,
        english: englishCount,
        minutes: Math.round((seconds / 60) * 10) / 10,
        accuracy: reviewed > 0 ? Math.round((approved / reviewed) * 100) : null,
        activeDays: activeDays.size,
      },
      history,
      badges,
      // Checkpoints turn a 500 target into a sequence of reachable wins rather
      // than one distant number you are "losing" against all day.
      milestone: {
        reached: milestoneFor(doneToday),
        next: nextMilestone(doneToday),
        toNext: nextMilestone(doneToday) ? nextMilestone(doneToday)!.at - doneToday : null,
      },
      pace: {
        projected: projectedDailyTotal(doneToday),
        onTrack: projectedDailyTotal(doneToday) >= DEFAULT_DAILY_GOAL,
      },
    });
  } catch (error) {
    console.error("Error building transcriber profile:", error);
    return NextResponse.json({ error: "Failed to build profile" }, { status: 500 });
  }
}

// PATCH /api/v2/transcriber/profile — choose an avatar
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const avatarId: string | undefined = body?.avatarId;
    const option = AVATAR_CATALOG.find((a) => a.id === avatarId);
    if (!option) {
      return NextResponse.json({ error: "Unknown avatar" }, { status: 400 });
    }

    // Recompute the level server-side: the unlock requirement has to be enforced
    // here, not just hidden in the picker.
    const transcriptions = await prisma.transcription.count({
      where: { transcriberId: user.id, status: "APPROVED" },
    });
    const english = await prisma.recording.count({
      where: { englishTranslatedById: user.id },
    });
    const pipeline = await prisma.reviewQueue.count({
      where: {
        status: "approved",
        OR: [{ reviewerId: user.id }, { secondReviewerId: user.id }],
      },
    });
    const xp =
      transcriptions * POINTS.transcription +
      english * POINTS.english +
      pipeline * POINTS.pipeline;
    const { level } = levelProgress(Math.max(0, xp));

    if (option.unlocksAt > level) {
      return NextResponse.json(
        { error: `${option.name} unlocks at level ${option.unlocksAt}. You are level ${level}.` },
        { status: 403 }
      );
    }

    await prisma.user.update({ where: { id: user.id }, data: { avatarId: option.id } });

    return NextResponse.json({ success: true, avatarId: option.id });
  } catch (error) {
    console.error("Error saving avatar:", error);
    return NextResponse.json({ error: "Failed to save avatar" }, { status: 500 });
  }
}
