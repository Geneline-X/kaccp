import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
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
    if (
      user.role === "SPEAKER" &&
      recording.speakerId !== user.id
    ) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Extract file path from gs:// URL
    const audioUrl = recording.audioUrl;
    let filePath = audioUrl;
    
    if (audioUrl.startsWith("gs://")) {
      // Format: gs://bucket-name/path/to/file
      const parts = audioUrl.replace("gs://", "").split("/");
      parts.shift(); // Remove bucket name
      filePath = parts.join("/");
    }

    // Generate signed URL for reading (valid for 1 hour)
    const [signedUrl] = await bucket.file(filePath).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return NextResponse.json({
      signedUrl,
      url: signedUrl, // Keep for backwards compatibility
      expiresIn: 3600, // seconds
    });
  } catch (error) {
    console.error("Error generating audio URL:", error);
    return NextResponse.json(
      { error: "Failed to generate audio URL" },
      { status: 500 }
    );
  }
}
