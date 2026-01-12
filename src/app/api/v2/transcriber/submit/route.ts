import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// POST /api/v2/transcriber/submit - Submit transcription for a recording
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
    const hasAccess = userRoles.includes("TRANSCRIBER") || userRoles.includes("ADMIN");

    if (!hasAccess) {
      return NextResponse.json({ error: "Unauthorized - TRANSCRIBER role required" }, { status: 403 });
    }

    const body = await req.json();
    const { recordingId, text, isFlagged, flagReason } = body;

    if (!recordingId) {
      return NextResponse.json(
        { error: "recordingId is required" },
        { status: 400 }
      );
    }

    // If not flagged, text is required
    if (!isFlagged && !text) {
      return NextResponse.json(
        { error: "Transcription text is required" },
        { status: 400 }
      );
    }

    // Check if user has an active assignment for this recording
    const now = new Date();
    const assignment = await prisma.transcriptionAssignment.findFirst({
      where: {
        recordingId,
        userId: user.id,
        expiresAt: { gt: now },
        releasedAt: null,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "You don't have an active assignment for this recording" },
        { status: 400 }
      );
    }

    // Get recording
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      include: {
        language: true,
      },
    });

    if (!recording) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    // Handle flagged recordings
    if (isFlagged) {
      // Update recording as flagged
      await prisma.recording.update({
        where: { id: recordingId },
        data: {
          status: "FLAGGED",
          isFlagged: true,
          flagReason: flagReason || "UNCLEAR",
        },
      });

      // Release assignment
      await prisma.transcriptionAssignment.update({
        where: { id: assignment.id },
        data: { releasedAt: now },
      });

      return NextResponse.json({
        success: true,
        flagged: true,
        message: "Recording flagged for review",
      });
    }

    // Create transcription
    const transcription = await prisma.transcription.create({
      data: {
        recordingId,
        transcriberId: user.id,
        text: text.trim(),
      },
    });

    // Update recording status
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: "TRANSCRIBED",
      },
    });

    // Release assignment
    await prisma.transcriptionAssignment.update({
      where: { id: assignment.id },
      data: { releasedAt: now },
    });

    // Update user stats
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totalTranscriptions: { increment: 1 },
      },
    });

    return NextResponse.json({
      success: true,
      transcription,
    });
  } catch (error) {
    console.error("Error submitting transcription:", error);
    return NextResponse.json(
      { error: "Failed to submit transcription" },
      { status: 500 }
    );
  }
}
