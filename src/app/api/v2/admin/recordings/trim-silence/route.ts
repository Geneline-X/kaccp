import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { downloadBuffer, uploadBuffer } from "@/lib/infra/gcs";
import { trimTrailingSilence } from "@/lib/infra/audio/trim-silence";
import { RecordingStatus } from "@prisma/client";

export const maxDuration = 300;

function isAdmin(user: any) {
  return user && (((user as any).roles || []).includes("ADMIN") || user.role === "ADMIN");
}

// GET /api/v2/admin/recordings/trim-silence?status=X&languageId=X
// Returns distinct speakers + total count for the given filter (populates dropdowns)
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!isAdmin(user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") || "PENDING_REVIEW") as RecordingStatus;
  const languageId = searchParams.get("languageId");

  const where: any = { status };
  if (languageId) where.languageId = languageId;

  const [speakers, total] = await Promise.all([
    prisma.recording.findMany({
      where,
      select: { speaker: { select: { id: true, displayName: true, email: true } } },
      distinct: ["speakerId"],
      orderBy: { createdAt: "desc" },
    }),
    prisma.recording.count({ where }),
  ]);

  return NextResponse.json({
    speakers: speakers.map((r) => r.speaker),
    total,
  });
}

type ResultEntry = {
  id: string;
  audioUrl: string;
  speakerId: string;
  speakerName: string;
  promptText: string;
  result: "trimmed" | "unchanged" | "skipped" | "error";
  originalDurationSec?: number;
  newDurationSec?: number;
  removedSec?: number;
  reason?: string;
};

// Process a single recording for trim analysis/application
async function processRecording(
  rec: { id: string; audioUrl: string; durationSec: number; speakerId: string; languageId: string; speaker: { displayName: string | null; email: string }; prompt: { englishText: string } },
  dryRun: boolean
): Promise<{ result: ResultEntry; outcome: "trimmed" | "unchanged" | "skipped" | "error" }> {
  const base: Pick<ResultEntry, "id" | "audioUrl" | "speakerId" | "speakerName" | "promptText"> = {
    id: rec.id,
    audioUrl: rec.audioUrl,
    speakerId: rec.speakerId,
    speakerName: rec.speaker.displayName || rec.speaker.email,
    promptText: rec.prompt.englishText,
  };

  const isWav =
    !rec.audioUrl.includes(".webm") &&
    !rec.audioUrl.includes(".mp4") &&
    !rec.audioUrl.includes(".ogg");

  if (!isWav) {
    return { result: { ...base, result: "skipped", reason: "not a WAV file" }, outcome: "skipped" };
  }

  try {
    const wavBuf = await downloadBuffer(rec.audioUrl);
    const trimResult = trimTrailingSilence(wavBuf);

    if (!trimResult.wasModified) {
      return {
        result: { ...base, result: "unchanged", originalDurationSec: trimResult.originalDurationSec },
        outcome: "unchanged",
      };
    }

    if (!dryRun) {
      const removedMinutes = trimResult.removedSec / 60;
      await Promise.all([
        uploadBuffer(rec.audioUrl, trimResult.buffer, "audio/wav"),
        prisma.recording.update({
          where: { id: rec.id },
          data: { durationSec: trimResult.trimmedDurationSec },
        }),
        prisma.language.update({
          where: { id: rec.languageId },
          data: { collectedMinutes: { decrement: removedMinutes } },
        }),
        prisma.user.update({
          where: { id: rec.speakerId },
          data: { totalRecordingsSec: { decrement: trimResult.removedSec } },
        }),
      ]);
    }

    return {
      result: {
        ...base,
        result: "trimmed",
        originalDurationSec: trimResult.originalDurationSec,
        newDurationSec: trimResult.trimmedDurationSec,
        removedSec: Math.round(trimResult.removedSec * 100) / 100,
      },
      outcome: "trimmed",
    };
  } catch (err: any) {
    return { result: { ...base, result: "error", reason: err?.message ?? "unknown error" }, outcome: "error" };
  }
}

const CONCURRENCY = 5;
const DEFAULT_BATCH_SIZE = 50;

// POST /api/v2/admin/recordings/trim-silence
// Body: { recordingIds?, status?, languageId?, speakerId?, dryRun?, batchSize?, offset? }
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!isAdmin(user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      recordingIds,
      status = "PENDING_REVIEW" as RecordingStatus,
      languageId,
      speakerId,
      dryRun = false,
      batchSize = DEFAULT_BATCH_SIZE,
      offset = 0,
    } = body;

    const where: any = recordingIds?.length
      ? { id: { in: recordingIds as string[] } }
      : { status: status as RecordingStatus };

    if (!recordingIds?.length) {
      if (languageId) where.languageId = languageId;
      if (speakerId) where.speakerId = speakerId;
    }

    const [recordings, totalMatching] = await Promise.all([
      prisma.recording.findMany({
        where,
        select: {
          id: true,
          audioUrl: true,
          durationSec: true,
          speakerId: true,
          languageId: true,
          speaker: { select: { displayName: true, email: true } },
          prompt: { select: { englishText: true } },
        },
        orderBy: { createdAt: "asc" },
        skip: offset,
        take: Math.min(batchSize, 200),
      }),
      prisma.recording.count({ where }),
    ]);

    const results: ResultEntry[] = [];
    let trimmedCount = 0;
    let unchangedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process in parallel batches of CONCURRENCY
    for (let i = 0; i < recordings.length; i += CONCURRENCY) {
      const batch = recordings.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((rec) => processRecording(rec, dryRun))
      );

      for (const { result, outcome } of batchResults) {
        results.push(result);
        if (outcome === "trimmed") trimmedCount++;
        else if (outcome === "unchanged") unchangedCount++;
        else if (outcome === "skipped") skippedCount++;
        else errorCount++;
      }
    }

    return NextResponse.json({
      dryRun,
      processed: recordings.length,
      trimmed: trimmedCount,
      unchanged: unchangedCount,
      skipped: skippedCount,
      errors: errorCount,
      totalMatching,
      offset,
      hasMore: offset + recordings.length < totalMatching,
      results,
    });
  } catch (error: any) {
    console.error("Error trimming silence:", error);
    return NextResponse.json({ error: "Failed to process recordings" }, { status: 500 });
  }
}
