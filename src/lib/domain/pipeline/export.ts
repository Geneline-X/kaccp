import { prisma } from "@/lib/infra/db/prisma";
import { uploadBuffer } from "@/lib/infra/gcs";

export type ExportFormat = "ljspeech" | "json";

export async function exportDatasetToGcs(
  versionId: string,
  format: ExportFormat = "ljspeech",
): Promise<{ exportPath: string; totalSessions: number }> {
  const version = await prisma.datasetVersion.findUnique({
    where: { versionId },
  });

  if (!version) {
    throw new Error(`Dataset version ${versionId} not found`);
  }

  const reviewIds = (version.sourceReviewIds as string[]) ?? [];
  if (reviewIds.length === 0) {
    throw new Error("No source reviews in this dataset version");
  }

  const items = await prisma.reviewQueue.findMany({
    where: { id: { in: reviewIds } },
    include: { audioSession: { select: { audioPath: true, audioDurationS: true } } },
    orderBy: { createdAt: "asc" },
  });

  const bucket = process.env.GCS_BUCKET;
  if (!bucket) throw new Error("GCS_BUCKET not configured");

  let content: string;
  let contentType: string;
  let filename: string;

  if (format === "ljspeech") {
    const header = "id|audio_path|transcription";
    const rows = items.map((item, i) => {
      const audioPath = item.audioSession?.audioPath ?? item.audioPath;
      return `${version.versionId}_${String(i + 1).padStart(5, "0")}|${audioPath}|${item.correctedTranscript ?? ""}`;
    });
    content = [header, ...rows].join("\n");
    contentType = "text/csv";
    filename = `${version.versionId}_metadata.csv`;
  } else {
    const data = items.map((item, i) => ({
      id: `${version.versionId}_${String(i + 1).padStart(5, "0")}`,
      audio_path: item.audioSession?.audioPath ?? item.audioPath,
      transcription: item.correctedTranscript ?? "",
      source: item.source,
      priority_tier: item.priorityTier,
      asr_transcript: item.asrTranscript ?? "",
      duration_s: item.audioSession?.audioDurationS ?? null,
    }));
    content = JSON.stringify({ version: version.versionId, exportedAt: new Date().toISOString(), data }, null, 2);
    contentType = "application/json";
    filename = `${version.versionId}_export.json`;
  }

  const gcsPath = `gs://${bucket}/datasets/${version.versionId}/${filename}`;
  await uploadBuffer(gcsPath, Buffer.from(content, "utf-8"), contentType);

  await prisma.datasetVersion.update({
    where: { id: version.id },
    data: { exportPath: gcsPath },
  });

  return { exportPath: gcsPath, totalSessions: items.length };
}
