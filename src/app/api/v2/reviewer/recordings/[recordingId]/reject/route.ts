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
    const body = await req.json().catch(() => ({}));

    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      select: {
        status: true,
        durationSec: true,
        languageId: true,
        promptId: true,
        language: { select: { collectedMinutes: true } },
        prompt: { select: { timesRecorded: true } },
      },
    });

    if (!recording) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    if (recording.status !== "PENDING_REVIEW") {
      return NextResponse.json(
        { error: "Only PENDING_REVIEW recordings can be rejected here" },
        { status: 400 }
      );
    }

    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: "REJECTED",
        isFlagged: false,
      },
    });

    const durationMin = recording.durationSec / 60;
    await Promise.all([
      recording.language.collectedMinutes > 0
        ? prisma.language.update({
            where: { id: recording.languageId },
            data: {
              collectedMinutes: {
                decrement: Math.min(durationMin, recording.language.collectedMinutes),
              },
            },
          })
        : Promise.resolve(),
      recording.prompt.timesRecorded > 0
        ? prisma.prompt.update({
            where: { id: recording.promptId },
            data: { timesRecorded: { decrement: 1 } },
          })
        : Promise.resolve(),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error rejecting recording audio:", error);
    return NextResponse.json({ error: "Failed to reject recording" }, { status: 500 });
  }
}
