import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { kayXClient } from "@/lib/infra/ai/kay-client";
import { getSignedUrl } from "@/lib/infra/gcs";

/**
 * POST /api/v2/admin/recordings/:recordingId/transcribe
 * Manually trigger Kay X transcription for a recording
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ recordingId: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user || (!((user as any).roles || []).includes("ADMIN") && user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recordingId } = await context.params;

    // Check if Kay X is enabled
    if (!kayXClient.isEnabled()) {
      return NextResponse.json(
        { error: "Kay X integration is not enabled" },
        { status: 400 }
      );
    }

    // Fetch recording
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      include: {
        language: true,
        prompt: true,
      },
    });

    if (!recording) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    // Check if Krio
    const isKrio = recording.language.code.toLowerCase() === "kri";
    if (!isKrio) {
      return NextResponse.json(
        {
          error: "Kay X transcription only available for Krio recordings",
          message: `This recording is in ${recording.language.name}, not Krio`,
        },
        { status: 400 }
      );
    }

    // Prepare audio URL for Kay X
    let audioUrlForKayX = recording.audioUrl;

    // If GCS URL, generate signed URL
    if (recording.audioUrl.startsWith("gs://")) {
      audioUrlForKayX = await getSignedUrl(recording.audioUrl, 2 * 3600);
    }

    // Trigger Kay X transcription
    const result = await kayXClient.transcribeUrl(audioUrlForKayX);

    if (result.success) {
      // Update recording with transcript
      await prisma.recording.update({
        where: { id: recordingId },
        data: {
          transcript: result.transcript,
          transcriptConfidence: result.confidence,
          autoTranscriptionStatus: "COMPLETED",
          autoTranscribedAt: new Date(),
          transcriptMetadata: result.metadata,
        },
      });

      return NextResponse.json({
        success: true,
        transcript: result.transcript,
        confidence: result.confidence,
        message: "Transcription completed successfully",
      });
    } else {
      // Mark as failed
      await prisma.recording.update({
        where: { id: recordingId },
        data: {
          autoTranscriptionStatus: "FAILED",
          autoTranscribedAt: new Date(),
          transcriptMetadata: {
            error: result.error,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return NextResponse.json(
        {
          error: "Transcription failed",
          message: result.error || "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error triggering Kay X transcription:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
