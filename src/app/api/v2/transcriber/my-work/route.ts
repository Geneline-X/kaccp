import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

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
          select: {
            id: true,
            audioUrl: true,
            durationSec: true,
            transcript: true,
            transcriptConfidence: true,
            autoTranscriptionStatus: true,
            status: true,
            prompt: {
              select: {
                englishText: true,
                category: true,
                emotion: true,
                isFreeForm: true,
                instruction: true,
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
          select: {
            id: true,
            audioUrl: true,
            durationSec: true,
            transcript: true,
            transcriptConfidence: true,
            autoTranscriptionStatus: true,
            status: true,
            prompt: {
              select: {
                englishText: true,
                category: true,
                emotion: true,
                isFreeForm: true,
                instruction: true,
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

    // Rejection feedback keyed to this transcriber, stored on the recording's
    // transcriptMetadata. This persists even if another transcriber later claims
    // and resubmits the same recording (which overwrites the Transcription row).
    const feedbackRecordings = await prisma.recording.findMany({
      where: {
        transcriptMetadata: {
          path: ["rejectionFeedback"],
          array_contains: [{ transcriberId: user.id }],
        },
      },
      select: {
        id: true,
        audioUrl: true,
        durationSec: true,
        transcriptMetadata: true,
        prompt: { select: { englishText: true } },
        language: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    const feedback: any[] = [];
    for (const r of feedbackRecordings) {
      const meta = r.transcriptMetadata as any;
      const entries = Array.isArray(meta?.rejectionFeedback)
        ? meta.rejectionFeedback
        : [];
      for (const e of entries) {
        if (e.transcriberId !== user.id) continue;
        feedback.push({
          id: `${r.id}:${e.reviewedAt}`,
          text: e.text,
          status: "REJECTED",
          reviewNotes: e.reviewNotes || null,
          reviewedAt: e.reviewedAt || null,
          submittedAt: e.reviewedAt || null,
          recording: {
            id: r.id,
            audioUrl: r.audioUrl,
            durationSec: r.durationSec,
            prompt: { englishText: r.prompt?.englishText || "" },
            language: { name: r.language?.name || "" },
          },
        });
      }
    }
    feedback.sort((a, b) => String(b.reviewedAt || "").localeCompare(String(a.reviewedAt || "")));

    // Pipeline review work (ReviewQueue) — counted alongside classic transcriptions.
    // A user "contributed" to an item if they did the first-pass correction or the
    // second-pass verification.
    const pipelineContributor = {
      OR: [{ reviewerId: user.id }, { secondReviewerId: user.id }],
    };
    const [pipelineTotal, pipelineApproved, pipelinePending] = await Promise.all([
      prisma.reviewQueue.count({ where: pipelineContributor }),
      prisma.reviewQueue.count({ where: { status: "approved", ...pipelineContributor } }),
      prisma.reviewQueue.count({
        where: { status: { in: ["pending", "corrected", "in_review"] }, ...pipelineContributor },
      }),
    ]);

    return NextResponse.json({
      activeAssignments: activeRecordings.filter((r) => r.recording),
      recentTranscriptions,
      feedback,
      stats: {
        byStatus: stats,
        total: totalTranscriptions,
        pipeline: {
          total: pipelineTotal,
          approved: pipelineApproved,
          pending: pipelinePending,
        },
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
