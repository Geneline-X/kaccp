import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { downloadBuffer } from "@/lib/infra/gcs";
import { trimTrailingSilence } from "@/lib/infra/audio/trim-silence";

// GET /api/v2/admin/recordings/[recordingId]/preview-trim
// Returns the trimmed WAV as audio/wav — used for before/after preview in the UI.
// Nothing is saved to GCS or DB.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user || (!((user as any).roles || []).includes("ADMIN") && user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recordingId } = await params;

    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      select: { audioUrl: true },
    });

    if (!recording) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    const isWav =
      !recording.audioUrl.includes(".webm") &&
      !recording.audioUrl.includes(".mp4") &&
      !recording.audioUrl.includes(".ogg");

    if (!isWav) {
      return NextResponse.json({ error: "Preview only available for WAV files" }, { status: 400 });
    }

    const wavBuf = await downloadBuffer(recording.audioUrl);
    const { buffer } = trimTrailingSilence(wavBuf);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Error generating trim preview:", error);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
