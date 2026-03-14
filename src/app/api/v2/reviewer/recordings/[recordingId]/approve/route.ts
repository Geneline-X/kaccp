import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { kayXClient } from "@/lib/infra/ai/kay-client";
import { getSignedUrl } from "@/lib/infra/gcs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> }
) {
  try {
    const user = await getAuthUser(req);
    const userRoles = (user as any)?.roles?.length > 0 ? (user as any).roles : [user?.role];
    if (!user || (!userRoles.includes("ADMIN") && !userRoles.includes("REVIEWER"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recordingId } = await params;

    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      select: { status: true, audioUrl: true, language: { select: { code: true } } },
    });

    if (!recording) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    if (recording.status !== "PENDING_REVIEW") {
      return NextResponse.json(
        { error: "Recording is not in PENDING_REVIEW status" },
        { status: 400 }
      );
    }

    await prisma.recording.update({
      where: { id: recordingId },
      data: { status: "PENDING_TRANSCRIPTION" },
    });

    // Earnings are computed on the fly in the speaker dashboard (duration × rate)
    // No wallet transactions needed until actual payments are made

    // Fire Kay X auto-transcription asynchronously for approved Krio recordings
    if (kayXClient.isEnabled()) {
      const isKrio = recording.language?.code?.toLowerCase() === "kri";

      if (isKrio) {
        (async () => {
          try {
            let audioUrl = recording.audioUrl;
            if (audioUrl.startsWith("gs://")) {
              audioUrl = await getSignedUrl(audioUrl, 2 * 3600);
            }

            const result = await kayXClient.transcribeUrl(audioUrl);

            if (result.success && result.transcript) {
              const systemUser = await prisma.user.findFirst({
                where: { role: "ADMIN" },
                select: { id: true },
                orderBy: { createdAt: "asc" },
              });

              if (systemUser) {
                try {
                  await prisma.transcription.create({
                    data: {
                      recordingId,
                      transcriberId: systemUser.id,
                      text: result.transcript,
                    },
                  });

                  await prisma.recording.update({
                    where: { id: recordingId },
                    data: {
                      status: "TRANSCRIBED",
                      transcript: result.transcript,
                      transcriptConfidence: result.confidence,
                      autoTranscriptionStatus: "COMPLETED",
                      autoTranscribedAt: new Date(),
                      transcriptMetadata: result.metadata as any,
                    },
                  });
                } catch (createErr: any) {
                  if (createErr?.code === "P2002") {
                    // Human already transcribed this recording — mark as SKIPPED, not FAILED
                    await prisma.recording.update({
                      where: { id: recordingId },
                      data: {
                        transcript: result.transcript,
                        transcriptConfidence: result.confidence,
                        autoTranscriptionStatus: "SKIPPED",
                        autoTranscribedAt: new Date(),
                        transcriptMetadata: { reason: "Human transcription already exists" },
                      },
                    }).catch(() => {});
                  } else {
                    throw createErr; // re-throw non-P2002 errors to the outer catch
                  }
                }
              }
            } else {
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
            }
          } catch (err) {
            console.error("[Kay X] Auto-transcription failed after audio approval:", err);
            await prisma.recording.update({
              where: { id: recordingId },
              data: {
                autoTranscriptionStatus: "FAILED",
                transcriptMetadata: {
                  error: String(err),
                  timestamp: new Date().toISOString(),
                },
              },
            }).catch(() => {});
          }
        })();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error approving recording audio:", error);
    return NextResponse.json({ error: "Failed to approve recording" }, { status: 500 });
  }
}
