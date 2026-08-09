import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

function isAdmin(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || user.role === "ADMIN";
}

// GET /api/v2/admin/export/corrected — Export approved corrected texts as a dataset.
// Splits the two datasets so they stay clean:
//   source=kaccp (default) — approved KACCP seed transcriptions (clean studio audio, English
//                            prompts present) → TTS
//   source=pilot          — approved Flot pipeline corrections (real-world calls w/ background
//                            noise, no English prompts) → ASR
//   source=all            — merged
// Each row carries the audio path pair plus the English prompt text where available.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json"; // json or csv
    const previewOnly = searchParams.get("preview") === "true";
    const languageId = searchParams.get("languageId") || undefined;
    const source = searchParams.get("source") || "kaccp"; // kaccp | pilot | all

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
            ...(previewOnly ? { take: 10 } : {}),
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
            ...(previewOnly ? { take: 10 } : {}),
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
        audio_path: rec.audioUrl,
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
        audio_path: rec?.audioUrl ?? rq.audioPath,
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

    if (format === "csv") {
      const csvHeader = "id|audio_path|transcription|english_text|source|duration_sec|speaker_id|speaker_name|language";
      const csvRows = exportData.map((row) =>
        [
          row.id,
          row.audio_path,
          row.transcription,
          row.english_text,
          row.source,
          row.duration_sec ?? "",
          row.speaker_id,
          row.speaker_name,
          row.language,
        ].join("|")
      );
      const csvContent = [csvHeader, ...csvRows].join("\n");

      const filename = source === "pilot" ? `asr_pilot_dataset.csv` : source === "all" ? `corrected_texts_dataset.csv` : `tts_kaccp_dataset.csv`;

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=${filename}`,
        },
      });
    }

    return NextResponse.json({
      stats: {
        totalItems: exportData.length,
        kaccpItems: transcriptions.length,
        pilotItems: reviewQueueItems.length,
      },
      data: exportData,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error exporting corrected texts:", error);
    return NextResponse.json(
      { error: "Failed to export corrected texts" },
      { status: 500 }
    );
  }
}
