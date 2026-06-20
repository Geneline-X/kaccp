import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { mergeApprovedReviews } from "@/lib/domain/pipeline";

function isAdmin(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || user.role === "ADMIN";
}

// POST /api/v2/pipeline/datasets/[id]/merge — Trigger a merge into this dataset version
// This adds newly approved corrections to the specified version
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const version = await prisma.datasetVersion.findUnique({ where: { id } });
    if (!version) {
      return NextResponse.json({ error: "Dataset version not found" }, { status: 404 });
    }

    const approvedItems = await prisma.reviewQueue.findMany({
      where: {
        status: "corrected",
        datasetVersionId: null,
        correctedTranscript: { not: null },
      },
    });

    if (approvedItems.length === 0) {
      return NextResponse.json({ error: "No approved reviews to merge" }, { status: 400 });
    }

    let totalDurationS = 0;
    let pilotDurationS = 0;
    let kaccpDurationS = 0;

    for (const item of approvedItems) {
      const session = item.audioSessionId
        ? await prisma.audioSession.findUnique({ where: { id: item.audioSessionId } })
        : null;
      const durationS = session?.audioDurationS ?? 0;
      totalDurationS += durationS;
      if (item.source === "pilot") pilotDurationS += durationS;
      else kaccpDurationS += durationS;
    }

    const existingIds = (version.sourceReviewIds as string[]) ?? [];
    const newIds = approvedItems.map((i) => i.id);
    const allIds = [...new Set([...existingIds, ...newIds])];

    const totalSessions = allIds.length;
    const totalHours = Math.round(
      ((version.totalHours * 3600) + totalDurationS) / 3600 * 100,
    ) / 100;

    await prisma.datasetVersion.update({
      where: { id },
      data: {
        sourceReviewIds: allIds,
        totalSessions,
        totalHours,
        pilotHours: Math.round(
          ((version.pilotHours * 3600) + pilotDurationS) / 3600 * 100,
        ) / 100,
        kaccpHours: Math.round(
          ((version.kaccpHours * 3600) + kaccpDurationS) / 3600 * 100,
        ) / 100,
      },
    });

    await prisma.reviewQueue.updateMany({
      where: { id: { in: newIds } },
      data: {
        datasetVersionId: version.id,
        mergedAt: new Date(),
        status: "approved",
      },
    });

    return NextResponse.json({
      message: `Merged ${approvedItems.length} reviews into ${version.versionId}`,
      newItems: approvedItems.length,
      totalItems: totalSessions,
    });
  } catch (error) {
    console.error("Error merging into dataset:", error);
    return NextResponse.json({ error: "Failed to merge reviews" }, { status: 500 });
  }
}
