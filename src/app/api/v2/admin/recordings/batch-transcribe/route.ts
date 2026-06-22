import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { kayXClient } from "@/lib/infra/ai/kay-client";
import { getSignedUrl } from "@/lib/infra/gcs";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || (!((user as any).roles || []).includes("ADMIN") && user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!kayXClient.isEnabled()) {
      return NextResponse.json({ error: "Kay X ASR integration is not enabled" }, { status: 400 });
    }

    // Find all Krio recordings without completed auto-transcription
    const pendingRecordings = await prisma.recording.findMany({
      where: {
        language: { code: "kri" },
        autoTranscriptionStatus: "PENDING",
        transcript: null,
      },
      include: { language: true },
    });

    if (pendingRecordings.length === 0) {
      return NextResponse.json({ message: "No pending Krio recordings to transcribe" });
    }

    const results: { id: string; status: string; transcript?: string; error?: string }[] = [];

    for (const recording of pendingRecordings) {
      try {
        let audioUrl = recording.audioUrl;
        if (audioUrl.startsWith("gs://")) {
          audioUrl = await getSignedUrl(audioUrl, 2 * 3600);
        }

        const result = await kayXClient.transcribeUrl(audioUrl);

        if (result.success) {
          await prisma.recording.update({
            where: { id: recording.id },
            data: {
              transcript: result.transcript,
              transcriptConfidence: result.confidence,
              autoTranscriptionStatus: "COMPLETED",
              autoTranscribedAt: new Date(),
              transcriptMetadata: result.metadata,
            },
          });
          results.push({ id: recording.id, status: "completed", transcript: result.transcript });
        } else {
          await prisma.recording.update({
            where: { id: recording.id },
            data: {
              autoTranscriptionStatus: "FAILED",
              autoTranscribedAt: new Date(),
              transcriptMetadata: { error: result.error, timestamp: new Date().toISOString() },
            },
          });
          results.push({ id: recording.id, status: "failed", error: result.error });
        }
      } catch (err: any) {
        results.push({ id: recording.id, status: "error", error: err.message });
      }
    }

    const succeeded = results.filter((r) => r.status === "completed").length;
    const failed = results.filter((r) => r.status !== "completed").length;

    return NextResponse.json({
      message: `Batch transcribe complete: ${succeeded} succeeded, ${failed} failed`,
      total: pendingRecordings.length,
      succeeded,
      failed,
      results,
    });
  } catch (error) {
    console.error("Batch transcribe error:", error);
    return NextResponse.json({ error: "Failed to batch transcribe" }, { status: 500 });
  }
}
