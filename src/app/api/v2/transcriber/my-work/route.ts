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
    const seenRecordingIds = new Set<string>();

    // Source 1: the transcriber's own REJECTED transcription rows (covers
    // existing rejections, which carry reviewNotes on the Transcription row).
    for (const tr of recentTranscriptions) {
      if (tr.status !== "REJECTED") continue;
      seenRecordingIds.add(tr.recordingId);
      feedback.push({
        id: tr.id,
        text: tr.text,
        status: "REJECTED",
        reviewNotes: tr.reviewNotes || null,
        reviewedAt: tr.reviewedAt ? tr.reviewedAt.toISOString() : null,
        submittedAt: tr.submittedAt ? tr.submittedAt.toISOString() : null,
        recording: {
          id: tr.recording?.id || tr.recordingId,
          audioUrl: tr.recording?.audioUrl || "",
          durationSec: tr.recording?.durationSec || 0,
          prompt: { englishText: tr.recording?.prompt?.englishText || "" },
          language: { name: tr.recording?.language?.name || "" },
        },
      });
    }

    // Source 2: persistent feedback on the recording metadata (survives a
    // different transcriber resubmitting the same recording).
    for (const r of feedbackRecordings) {
      const meta = r.transcriptMetadata as any;
      const entries = Array.isArray(meta?.rejectionFeedback)
        ? meta.rejectionFeedback
        : [];
      for (const e of entries) {
        if (e.transcriberId !== user.id) continue;
        seenRecordingIds.add(r.id);
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

    // Source 3: pipeline (ReviewQueue) corrections that the language lead
    // rejected. Feedback is stored on the item's rejectionFeedback array, keyed
    // to the correcting transcriber, so it survives re-correction by anyone.
    const rejectedPipeline = await prisma.reviewQueue.findMany({
      where: {
        rejectionFeedback: {
          array_contains: [{ transcriberId: user.id }],
        },
      },
      select: {
        id: true,
        status: true,
        audioPath: true,
        source: true,
        rejectionFeedback: true,
        audioSession: { select: { audioDurationS: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    for (const r of rejectedPipeline) {
      const entries = Array.isArray((r as any).rejectionFeedback)
        ? (r as any).rejectionFeedback
        : [];
      for (const e of entries) {
        if (e.transcriberId !== user.id) continue;
        seenRecordingIds.add(r.id);
        feedback.push({
          id: `rq:${r.id}:${e.reviewedAt}`,
          kind: "reviewQueue",
          text: e.text,
          status: "REJECTED",
          reviewNotes: e.reviewNotes || null,
          reviewedAt: e.reviewedAt || null,
          submittedAt: e.reviewedAt || null,
          audioPath: r.audioPath,
          recording: {
            id: r.id,
            audioUrl: r.audioPath,
            durationSec: r.audioSession?.audioDurationS || 0,
            prompt: { englishText: e.text || "Pipeline review" },
            language: { name: r.source === "pilot" ? "Flot" : "KACCP" },
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

    // Minutes of audio transcribed (based on the length of the audio), used to
    // show the transcriber how much work they have done at Le 3.00/minute.
    const [approvedClassic, approvedPipeline] = await Promise.all([
      prisma.transcription.findMany({
        where: { transcriberId: user.id, status: "APPROVED" },
        select: { recording: { select: { durationSec: true } } },
      }),
      prisma.reviewQueue.findMany({
        where: { status: "approved", ...pipelineContributor },
        select: { audioSessionId: true, recordingId: true },
      }),
    ]);
    const classicSeconds = approvedClassic.reduce(
      (sum, t) => sum + (t.recording?.durationSec || 0),
      0
    );
    // Resolve pipeline clip lengths from audio sessions (pilot) or recordings
    // (kaccp_recording source). ReviewQueue has no recording relation, only the id.
    const sessionIds = approvedPipeline
      .map((r) => r.audioSessionId)
      .filter((id): id is string => Boolean(id));
    const recordingIds = approvedPipeline
      .map((r) => r.recordingId)
      .filter((id): id is string => Boolean(id));
    const [sessions, recordings] = await Promise.all([
      prisma.audioSession.findMany({
        where: { id: { in: sessionIds } },
        select: { id: true, audioDurationS: true },
      }),
      prisma.recording.findMany({
        where: { id: { in: recordingIds } },
        select: { id: true, durationSec: true },
      }),
    ]);
    const sessionSeconds = new Map(sessions.map((s) => [s.id, s.audioDurationS || 0]));
    const recordingSeconds = new Map(recordings.map((r) => [r.id, r.durationSec || 0]));
    const pipelineSeconds = approvedPipeline.reduce(
      (sum, r) =>
        sum +
        (r.audioSessionId
          ? sessionSeconds.get(r.audioSessionId) || 0
          : recordingSeconds.get(r.recordingId || "") || 0),
      0
    );
    const totalSecondsTranscribed = classicSeconds + pipelineSeconds;

    return NextResponse.json({
      activeAssignments: activeRecordings.filter((r) => r.recording),
      recentTranscriptions,
      feedback,
      stats: {
        byStatus: stats,
        total: totalTranscriptions,
        totalSecondsTranscribed,
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
