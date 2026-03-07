import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { getSignedUrl } from "@/lib/infra/gcs";

// GET /api/v2/audio/[recordingId] - Get signed URL for audio playback
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recordingId } = await params;

    // Get recording
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    // Check access - speaker can access their own, transcriber/admin/reviewer can access any
    const roles = ((user as any).roles || []) as string[];
    const hasBroadAccess =
      roles.includes("ADMIN") || roles.includes("TRANSCRIBER") || roles.includes("REVIEWER") ||
      user.role === "ADMIN" || user.role === "TRANSCRIBER" || user.role === "REVIEWER";

    if (!hasBroadAccess && recording.speakerId !== user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const { audioUrl } = recording;

    // Handle local files (localhost)
    if (audioUrl.startsWith("/uploads/")) {
      return NextResponse.json({
        signedUrl: audioUrl,
        url: audioUrl,
        expiresIn: 3600,
        mode: "local"
      });
    }

    // Handle GCS files
    if (audioUrl.startsWith("gs://")) {
      const signedUrl = await getSignedUrl(audioUrl, 3600);
      return NextResponse.json({
        signedUrl,
        url: signedUrl,
        expiresIn: 3600,
        mode: "gcs"
      });
    }

    // Unknown audio URL format
    return NextResponse.json(
      { error: `Unsupported audio URL format: ${audioUrl}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error generating audio URL:", error);
    return NextResponse.json(
      { error: `Failed to generate audio URL: ${error.message}` },
      { status: 500 }
    );
  }
}
