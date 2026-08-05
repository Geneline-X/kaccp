import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { transcriberCents } from "@/lib/domain/payments";

function isReviewer(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || roles.includes("REVIEWER") || roles.includes("TRANSCRIBER")
    || user.role === "ADMIN" || user.role === "REVIEWER" || user.role === "TRANSCRIBER";
}

// Pipeline items are pilot (Flot) audio sessions or linked KACCP recordings.
// Resolve the clip length from whichever source the item points at.
async function resolvePipelineDurationSec(item: {
  audioSessionId: string | null;
  recordingId: string | null;
}): Promise<number> {
  if (item.audioSessionId) {
    const s = await prisma.audioSession.findUnique({
      where: { id: item.audioSessionId },
      select: { audioDurationS: true },
    });
    if (s?.audioDurationS) return s.audioDurationS;
  }
  if (item.recordingId) {
    const r = await prisma.recording.findUnique({
      where: { id: item.recordingId },
      select: { durationSec: true },
    });
    if (r?.durationSec) return r.durationSec;
  }
  return 0;
}

// PATCH /api/v2/pipeline/review-queue/[id] — Update review (submit correction, double-verify)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user || !isReviewer(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.reviewQueue.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Review item not found" }, { status: 404 });
    }

    const body = await req.json();
    const { correctedTranscript, status } = body;

    const updateData: any = {};
    let creditPass: "first" | "second" | null = null;

    // First correction
    if (correctedTranscript && !existing.correctedTranscript) {
      updateData.correctedTranscript = correctedTranscript;
      updateData.reviewerId = user.id;
      updateData.status = status ?? "corrected";
      creditPass = "first";
    }
    // Second correction (double verification)
    else if (correctedTranscript && existing.correctedTranscript && !existing.secondTranscript) {
      updateData.secondTranscript = correctedTranscript;
      updateData.secondReviewerId = user.id;
      updateData.disagreementFlag = correctedTranscript !== existing.correctedTranscript;
      updateData.status = updateData.disagreementFlag ? "pending" : (status ?? "approved");
      creditPass = "second";
    }
    // Status-only update (admin override, language lead escalation)
    else if (status) {
      updateData.status = status;
    } else {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const updated = await prisma.reviewQueue.update({
      where: { id },
      data: updateData,
    });

    // Pay the contributor for the pass they just completed (per corrected/verified item).
    // The branch conditions above guarantee each pass credits at most once.
    let earnedCents = 0;
    if (creditPass) {
      const durationSec = await resolvePipelineDurationSec(existing);
      const krio = await prisma.language.findFirst({
        where: { code: "kri" },
        select: { transcriberRatePerMin: true },
      });
      const ratePerMin = krio?.transcriberRatePerMin || 3;
      earnedCents = transcriberCents(durationSec, ratePerMin);
      if (earnedCents > 0) {
        await prisma.walletTransaction.create({
          data: {
            userId: user.id,
            deltaCents: earnedCents,
            description: `Pipeline ${creditPass}-pass correction for review item ${id}`,
          },
        });
        await prisma.user.update({
          where: { id: user.id },
          data: { totalEarningsCents: { increment: earnedCents } },
        });
      }
    }

    return NextResponse.json({ item: updated, earnedCents });
  } catch (error) {
    console.error("Error updating review item:", error);
    return NextResponse.json({ error: "Failed to update review item" }, { status: 500 });
  }
}
