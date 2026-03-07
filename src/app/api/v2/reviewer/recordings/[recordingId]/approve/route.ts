import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

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
      select: { status: true },
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error approving recording audio:", error);
    return NextResponse.json({ error: "Failed to approve recording" }, { status: 500 });
  }
}
