import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { getSignedUrl } from "@/lib/infra/gcs";

function isReviewer(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || roles.includes("REVIEWER") || roles.includes("TRANSCRIBER")
    || user.role === "ADMIN" || user.role === "REVIEWER" || user.role === "TRANSCRIBER";
}

// GET /api/v2/pipeline/audio?path=gs://... — Get signed URL for pipeline audio playback
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !isReviewer(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const audioPath = searchParams.get("path");

    if (!audioPath) {
      return NextResponse.json({ error: "path query parameter is required" }, { status: 400 });
    }

    if (audioPath.startsWith("/uploads/")) {
      return NextResponse.json({ signedUrl: audioPath, mode: "local" });
    }

    if (!audioPath.startsWith("gs://")) {
      return NextResponse.json({ error: "Unsupported audio path format" }, { status: 400 });
    }

    const signedUrl = await getSignedUrl(audioPath, 3600);
    return NextResponse.json({ signedUrl, mode: "gcs", expiresIn: 3600 });
  } catch (error: any) {
    console.error("Error generating pipeline audio URL:", error);
    return NextResponse.json(
      { error: `Failed to generate audio URL: ${error.message}` },
      { status: 500 },
    );
  }
}
