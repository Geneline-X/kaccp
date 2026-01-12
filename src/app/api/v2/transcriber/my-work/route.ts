import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/v2/transcriber/my-work - Get transcriber's assignments and history
export async function GET(req: NextRequest) {
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

    const now = new Date();

    // Get active assignments
    const activeAssignments = await prisma.transcriptionAssignment.findMany({
      where: {
        userId: user.id,
        expiresAt: { gt: now },
        releasedAt: null,
      },
      include: {
        user: false,
      },
    });

    // Get recording details for active assignments
    const activeRecordings = await Promise.all(
      activeAssignments.map(async (assignment) => {
        const recording = await prisma.recording.findUnique({
          where: { id: assignment.recordingId },
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
          },
        });
        return {
          assignment,
          recording,
          minutesRemaining: Math.max(
            0,
            Math.floor((assignment.expiresAt.getTime() - now.getTime()) / 60000)
          ),
        };
      })
    );

    // Get recent transcriptions
    const recentTranscriptions = await prisma.transcription.findMany({
      where: {
        transcriberId: user.id,
      },
      include: {
        recording: {
          include: {
            prompt: {
              select: {
                englishText: true,
                category: true,
              },
            },
            language: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Get stats
    const stats = await prisma.transcription.groupBy({
      by: ["status"],
      where: { transcriberId: user.id },
      _count: true,
    });

    const totalTranscriptions = await prisma.transcription.count({
      where: { transcriberId: user.id },
    });

    return NextResponse.json({
      activeAssignments: activeRecordings.filter((r) => r.recording),
      recentTranscriptions,
      stats: {
        byStatus: stats,
        total: totalTranscriptions,
      },
    });
  } catch (error) {
    console.error("Error fetching transcriber work:", error);
    return NextResponse.json(
      { error: "Failed to fetch work" },
      { status: 500 }
    );
  }
}
