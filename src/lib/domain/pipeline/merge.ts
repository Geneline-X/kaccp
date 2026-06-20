import { prisma } from "@/lib/infra/db/prisma";

export type MergeResult = {
  versionId: string;
  totalSessions: number;
  totalHours: number;
  pilotHours: number;
  kaccpHours: number;
};

export async function mergeApprovedReviews(description?: string): Promise<MergeResult> {
  const approvedItems = await prisma.reviewQueue.findMany({
    where: {
      status: "corrected",
      datasetVersionId: null,
      correctedTranscript: { not: null },
    },
  });

  if (approvedItems.length === 0) {
    throw new Error("No approved reviews to merge");
  }

  const nextVersion = await getNextVersionNumber();

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

  const version = await prisma.datasetVersion.create({
    data: {
      versionId: `krio_asr_v${nextVersion}`,
      description: description ?? `Merge ${new Date().toISOString().split("T")[0]}`,
      sourceReviewIds: approvedItems.map((i) => i.id),
      totalHours: Math.round((totalDurationS / 3600) * 100) / 100,
      totalSessions: approvedItems.length,
      pilotHours: Math.round((pilotDurationS / 3600) * 100) / 100,
      kaccpHours: Math.round((kaccpDurationS / 3600) * 100) / 100,
      status: "draft",
    },
  });

  await prisma.reviewQueue.updateMany({
    where: { id: { in: approvedItems.map((i) => i.id) } },
    data: {
      datasetVersionId: version.id,
      mergedAt: new Date(),
      status: "approved",
    },
  });

  return {
    versionId: version.versionId,
    totalSessions: approvedItems.length,
    totalHours: version.totalHours,
    pilotHours: version.pilotHours,
    kaccpHours: version.kaccpHours,
  };
}

async function getNextVersionNumber(): Promise<number> {
  const latest = await prisma.datasetVersion.findFirst({
    orderBy: { createdAt: "desc" },
    select: { versionId: true },
  });

  if (!latest) return 1;

  const match = latest.versionId.match(/v(\d+)$/);
  return match ? parseInt(match[1]) + 1 : 1;
}
