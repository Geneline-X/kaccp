import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { Storage } from "@google-cloud/storage";

const storage = new Storage({
  credentials: JSON.parse(process.env.GCS_SERVICE_ACCOUNT_JSON || "{}"),
});

const bucket = storage.bucket(process.env.GCS_BUCKET || "");

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

    // Check access - speaker can access their own, transcriber/admin can access any
    const roles = ((user as any).roles || []) as string[];
    const hasBroadAccess = roles.includes("ADMIN") || roles.includes("TRANSCRIBER") || user.role === "ADMIN" || user.role === "TRANSCRIBER";

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
      // Check if GCS is configured
      if (!process.env.GCS_BUCKET || !process.env.GCS_SERVICE_ACCOUNT_JSON) {
        return NextResponse.json(
          { error: "GCS not configured on server" },
          { status: 500 }
        );
      }

      // Extract file path from gs:// URL
      const filePath = audioUrl.replace(`gs://${process.env.GCS_BUCKET}/`, "");

      // Generate signed URL for reading (valid for 1 hour)
      const [signedUrl] = await bucket.file(filePath).getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
      });

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
