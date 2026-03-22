import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { downloadBuffer, uploadBuffer } from "@/lib/infra/gcs";
import { trimTrailingSilence } from "@/lib/infra/audio/trim-silence";
import { RecordingStatus } from "@prisma/client";

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

// POST /api/v2/admin/recordings/trim-silence
// Body: { recordingIds?, status?, languageId?, speakerId?, dryRun? }
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
    } = body;

    const where: any = recordingIds?.length
      ? { id: { in: recordingIds as string[] } }
      : { status: status as RecordingStatus };

    if (!recordingIds?.length) {
      if (languageId) where.languageId = languageId;
      if (speakerId) where.speakerId = speakerId;
    }

    const recordings = await prisma.recording.findMany({
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
    });

    const results: ResultEntry[] = [];
    let trimmedCount = 0;
    let unchangedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const rec of recordings) {
      const isWav =
        !rec.audioUrl.includes(".webm") &&
        !rec.audioUrl.includes(".mp4") &&
        !rec.audioUrl.includes(".ogg");

      const base: Pick<ResultEntry, "id" | "audioUrl" | "speakerId" | "speakerName" | "promptText"> = {
        id: rec.id,
        audioUrl: rec.audioUrl,
        speakerId: rec.speakerId,
        speakerName: rec.speaker.displayName || rec.speaker.email,
        promptText: rec.prompt.englishText,
      };

      if (!isWav) {
        results.push({ ...base, result: "skipped", reason: "not a WAV file" });
        skippedCount++;
        continue;
      }

      try {
        const wavBuf = await downloadBuffer(rec.audioUrl);
        const trimResult = trimTrailingSilence(wavBuf);

        if (!trimResult.wasModified) {
          results.push({
            ...base,
            result: "unchanged",
            originalDurationSec: trimResult.originalDurationSec,
          });
          unchangedCount++;
          continue;
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

        results.push({
          ...base,
          result: "trimmed",
          originalDurationSec: trimResult.originalDurationSec,
          newDurationSec: trimResult.trimmedDurationSec,
          removedSec: Math.round(trimResult.removedSec * 100) / 100,
        });
        trimmedCount++;
      } catch (err: any) {
        results.push({ ...base, result: "error", reason: err?.message ?? "unknown error" });
        errorCount++;
      }
    }

    return NextResponse.json({
      dryRun,
      processed: recordings.length,
      trimmed: trimmedCount,
      unchanged: unchangedCount,
      skipped: skippedCount,
      errors: errorCount,
      results,
    });
  } catch (error: any) {
    console.error("Error trimming silence:", error);
    return NextResponse.json({ error: "Failed to process recordings" }, { status: 500 });
  }
}
