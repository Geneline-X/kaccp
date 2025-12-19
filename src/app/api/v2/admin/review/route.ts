import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/v2/admin/review - Get transcriptions pending review
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const languageId = searchParams.get("languageId");
    const status = searchParams.get("status") || "PENDING_REVIEW";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: any = {
      status,
    };

    if (languageId) {
      where.recording = { languageId };
    }

    const [transcriptions, total] = await Promise.all([
      prisma.transcription.findMany({
        where,
        include: {
          recording: {
            include: {
              prompt: {
                select: {
                  englishText: true,
                  category: true,
                  emotion: true,
                },
              },
              language: {
                select: {
                  code: true,
                  name: true,
                },
              },
              speaker: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
          transcriber: {
            select: {
              id: true,
              displayName: true,
              qualityScore: true,
            },
          },
        },
        orderBy: { submittedAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.transcription.count({ where }),
    ]);

    return NextResponse.json({
      transcriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching transcriptions for review:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcriptions" },
      { status: 500 }
    );
  }
}

// POST /api/v2/admin/review - Approve or reject a transcription
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { transcriptionId, decision, reviewNotes, editedText } = body;

    if (!transcriptionId || !decision) {
      return NextResponse.json(
        { error: "transcriptionId and decision are required" },
        { status: 400 }
      );
    }

    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return NextResponse.json(
        { error: "Decision must be APPROVED or REJECTED" },
        { status: 400 }
      );
    }

    // Get transcription with recording
    const transcription = await prisma.transcription.findUnique({
      where: { id: transcriptionId },
      include: {
        recording: {
          include: {
            language: true,
          },
        },
      },
    });

    if (!transcription) {
      return NextResponse.json(
        { error: "Transcription not found" },
        { status: 404 }
      );
    }

    const now = new Date();

    // Update transcription
    const updatedTranscription = await prisma.transcription.update({
      where: { id: transcriptionId },
      data: {
        status: decision,
        reviewerId: user.id,
        reviewedAt: now,
        reviewNotes,
        ...(editedText && { text: editedText }),
      },
    });

    // Update recording status based on decision
    const recordingStatus = decision === "APPROVED" ? "APPROVED" : "REJECTED";
    await prisma.recording.update({
      where: { id: transcription.recordingId },
      data: {
        status: recordingStatus,
      },
    });

    // If approved, update language approvedMinutes
    if (decision === "APPROVED") {
      await prisma.language.update({
        where: { id: transcription.recording.languageId },
        data: {
          approvedMinutes: {
            increment: transcription.recording.durationSec / 60,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      transcription: updatedTranscription,
    });
  } catch (error) {
    console.error("Error reviewing transcription:", error);
    return NextResponse.json(
      { error: "Failed to review transcription" },
      { status: 500 }
    );
  }
}
