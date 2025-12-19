import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/v2/transcriber/available - Get recordings available for transcription
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || (user.role !== "TRANSCRIBER" && user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const languageId = searchParams.get("languageId");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Get recordings that need transcription and aren't currently assigned
    const now = new Date();

    // Get currently assigned recording IDs (not expired)
    const activeAssignments = await prisma.transcriptionAssignment.findMany({
      where: {
        expiresAt: { gt: now },
        releasedAt: null,
      },
      select: { recordingId: true },
    });

    const assignedRecordingIds = activeAssignments.map((a) => a.recordingId);

    // Build language filter based on user's writesLanguages
    let languageFilter: any = {};
    if (languageId) {
      languageFilter = { languageId };
    } else if (user.writesLanguages.length > 0) {
      // Get language IDs from codes
      const languages = await prisma.language.findMany({
        where: {
          OR: [
            { code: { in: user.writesLanguages } },
            { id: { in: user.writesLanguages } },
          ],
        },
        select: { id: true },
      });
      languageFilter = { languageId: { in: languages.map((l) => l.id) } };
    }

    const recordings = await prisma.recording.findMany({
      where: {
        status: "PENDING_TRANSCRIPTION",
        id: { notIn: assignedRecordingIds },
        ...languageFilter,
      },
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
            transcriberRatePerMin: true,
          },
        },
        speaker: {
          select: {
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: "asc" }, // Oldest first
      take: limit,
    });

    // Get count of available recordings
    const totalAvailable = await prisma.recording.count({
      where: {
        status: "PENDING_TRANSCRIPTION",
        id: { notIn: assignedRecordingIds },
        ...languageFilter,
      },
    });

    return NextResponse.json({
      recordings,
      totalAvailable,
    });
  } catch (error) {
    console.error("Error fetching available recordings:", error);
    return NextResponse.json(
      { error: "Failed to fetch recordings" },
      { status: 500 }
    );
  }
}
