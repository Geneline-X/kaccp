import { prisma } from "@/lib/infra/db/prisma";

export type DatasetSource = "kaccp" | "pilot" | "all";

// Ensure every audio path is a full, queryable `gs://bucket/...` URI so dataset
// preparation (gsutil cp, manifest matching) points at the real audio object.
export function resolveGcsPath(path?: string | null): string {
  if (!path) return "";
  if (path.startsWith("gs://")) return path;
  if (path.startsWith("/uploads/") || /^https?:\/\//.test(path)) return path;
  const bucket = process.env.GCS_BUCKET;
  if (bucket) return `gs://${bucket}/${path.replace(/^\/+/, "")}`;
  return path;
}

// Build the merged approved-corrected dataset rows.
//   source=kaccp (default) — approved KACCP seed transcriptions (clean studio audio, English
//                            prompts present) → TTS
//   source=pilot          — approved Flot pipeline corrections (real-world calls w/ background
//                            noise, no English prompts) → ASR
//   source=all            — merged
export async function getApprovedDatasetRows(
  source: DatasetSource = "kaccp",
  languageId?: string,
  limit?: number,
): Promise<Array<Record<string, unknown>>> {
  // --- Source 1: approved KACCP transcriptions (Recording + prompt english text) ---
  const txWhere: any = { status: "APPROVED" };
  if (languageId) txWhere.recording = { languageId };

  const transcriptions =
    source === "pilot"
      ? []
      : await prisma.transcription.findMany({
          where: txWhere,
          include: {
            recording: {
              select: {
                id: true,
                audioUrl: true,
                durationSec: true,
                languageId: true,
                prompt: { select: { englishText: true, category: true } },
                language: { select: { code: true, name: true } },
                speaker: { select: { id: true, displayName: true } },
              },
            },
          },
          orderBy: { submittedAt: "asc" },
          ...(limit ? { take: limit } : {}),
        });

  // --- Source 2: approved pipeline corrections (ReviewQueue) ---
  const rqWhere: any = {
    status: "approved",
    correctedTranscript: { not: null },
  };

  const reviewQueueItems =
    source === "kaccp"
      ? []
      : await prisma.reviewQueue.findMany({
          where: rqWhere,
          include: {
            audioSession: { select: { audioDurationS: true } },
            languageLead: { select: { id: true, displayName: true } },
          },
          orderBy: { createdAt: "asc" },
          ...(limit ? { take: limit } : {}),
        });

  // Resolve kaccp_recording review items to their Recording for the English prompt text
  const rqRecordingIds = reviewQueueItems
    .filter((r) => r.source === "kaccp_recording" && r.recordingId)
    .map((r) => r.recordingId as string);

  const rqRecordings = rqRecordingIds.length
    ? await prisma.recording.findMany({
        where: { id: { in: rqRecordingIds } },
        select: {
          id: true,
          audioUrl: true,
          durationSec: true,
          languageId: true,
          prompt: { select: { englishText: true, category: true } },
          language: { select: { code: true, name: true } },
          speaker: { select: { id: true, displayName: true } },
        },
      })
    : [];
  const rqRecordingMap = new Map(rqRecordings.map((r) => [r.id, r]));

  const exportData: Array<Record<string, unknown>> = [];

  // Track per-source counters for stable LJSpeech-style ids
  const kaccpCounter = new Map<string, number>();
  const pilotCounter = new Map<string, number>();

  for (const tx of transcriptions) {
    const rec = tx.recording;
    if (!rec) continue;
    const count = (kaccpCounter.get(rec.languageId) || 0) + 1;
    kaccpCounter.set(rec.languageId, count);

    exportData.push({
      id: `${rec.language.code.toUpperCase()}_KACCP_${String(count).padStart(5, "0")}`,
      audio_path: resolveGcsPath(rec.audioUrl),
      transcription: tx.text,
      english_text: rec.prompt?.englishText ?? "",
      source: "kaccp_transcription",
      category: rec.prompt?.category ?? "",
      duration_sec: rec.durationSec,
      speaker_id: rec.speaker?.id ?? "",
      speaker_name: rec.speaker?.displayName ?? "",
      language: rec.language.code,
      recording_id: rec.id,
    });
  }

  for (const rq of reviewQueueItems) {
    const rec = rqRecordingMap.get(rq.recordingId ?? "");
    let languageCode = "PILOT";
    if (rq.source === "kaccp_recording") {
      if (rec) languageCode = rec.language.code;
    } else {
      languageCode = "PILOT";
    }
    const count = (pilotCounter.get(languageCode) || 0) + 1;
    pilotCounter.set(languageCode, count);

    exportData.push({
      id: `${languageCode}_PILOT_${String(count).padStart(5, "0")}`,
      audio_path: resolveGcsPath(rec?.audioUrl ?? rq.audioPath),
      transcription: rq.correctedTranscript ?? "",
      english_text: rec?.prompt?.englishText ?? "",
      source: rq.source === "kaccp_recording" ? "kaccp_recording" : "pilot",
      category: rec?.prompt?.category ?? "",
      duration_sec: rec?.durationSec ?? rq.audioSession?.audioDurationS ?? null,
      speaker_id: rec?.speaker?.id ?? "",
      speaker_name: rec?.speaker?.displayName ?? "",
      language: languageCode,
      recording_id: rec?.id ?? rq.recordingId ?? "",
    });
  }

  // Language filtering is applied per-source inside the query above (KACCP
  // transcriptions carry a language; PILOT pipeline rows do not).

  return exportData;
}