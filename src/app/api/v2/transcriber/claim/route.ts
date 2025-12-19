import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const ASSIGNMENT_MINUTES = parseInt(process.env.ASSIGNMENT_MINUTES || "15");
const MAX_ACTIVE_ASSIGNMENTS = parseInt(process.env.MAX_ACTIVE_ASSIGNMENTS || "1");

// POST /api/v2/transcriber/claim - Claim a recording for transcription
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || (user.role !== "TRANSCRIBER" && user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { recordingId } = body;

    if (!recordingId) {
      return NextResponse.json(
        { error: "recordingId is required" },
        { status: 400 }
      );
    }

    const now = new Date();

    // Check if user has too many active assignments
    const activeAssignments = await prisma.transcriptionAssignment.count({
      where: {
        userId: user.id,
        expiresAt: { gt: now },
        releasedAt: null,
      },
    });

    if (activeAssignments >= MAX_ACTIVE_ASSIGNMENTS) {
      return NextResponse.json(
        { error: `You already have ${MAX_ACTIVE_ASSIGNMENTS} active assignment(s)` },
        { status: 400 }
      );
    }

    // Check if recording exists and is available
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      include: {
        prompt: true,
        language: true,
      },
    });

    if (!recording) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    if (recording.status !== "PENDING_TRANSCRIPTION") {
      return NextResponse.json(
        { error: "Recording is not available for transcription" },
        { status: 400 }
      );
    }

    // Check if recording is already assigned to someone else
    const existingAssignment = await prisma.transcriptionAssignment.findFirst({
      where: {
        recordingId,
        expiresAt: { gt: now },
        releasedAt: null,
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: "Recording is already assigned to another transcriber" },
        { status: 400 }
      );
    }

    // Create assignment
    const expiresAt = new Date(now.getTime() + ASSIGNMENT_MINUTES * 60 * 1000);

    const assignment = await prisma.transcriptionAssignment.create({
      data: {
        recordingId,
        userId: user.id,
        expiresAt,
      },
    });

    return NextResponse.json({
      assignment,
      recording,
      expiresAt,
      minutesRemaining: ASSIGNMENT_MINUTES,
    });
  } catch (error) {
    console.error("Error claiming recording:", error);
    return NextResponse.json(
      { error: "Failed to claim recording" },
      { status: 500 }
    );
  }
}
