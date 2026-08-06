import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { TranscriptionStatus } from "@prisma/client";

function isLanguageLead(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || user.role === "ADMIN";
}

// GET /api/v2/pipeline/language-lead — List items waiting for language lead review
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !isLanguageLead(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "corrected";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const skip = (page - 1) * limit;

    // Map language lead tabs to the underlying statuses of each source
    const rqStatus = status; // "corrected" | "approved" | "rejected"
    const txStatus: TranscriptionStatus =
      status === "corrected" ? "PENDING_REVIEW" : (status.toUpperCase() as TranscriptionStatus);

    const rqWhere: any = {
      correctedTranscript: { not: null },
      status: rqStatus,
    };

    const [rqItems, rqTotal, txItems, txTotal] = await Promise.all([
      prisma.reviewQueue.findMany({
        where: rqWhere,
        include: {
          audioSession: true,
          reviewer: { select: { id: true, displayName: true } },
          secondReviewer: { select: { id: true, displayName: true } },
          languageLead: { select: { id: true, displayName: true } },
        },
        orderBy: [
          { priorityTier: "asc" },
          { createdAt: "desc" },
        ],
      }),
      prisma.reviewQueue.count({ where: rqWhere }),
      prisma.transcription.findMany({
        where: { status: txStatus },
        include: {
          recording: {
            select: {
              id: true,
              audioUrl: true,
              durationSec: true,
              transcript: true,
              transcriptConfidence: true,
              autoTranscriptionStatus: true,
              prompt: { select: { englishText: true, category: true, emotion: true } },
              language: { select: { code: true, name: true } },
              speaker: { select: { id: true, displayName: true } },
            },
          },
          transcriber: { select: { id: true, displayName: true } },
          reviewer: { select: { id: true, displayName: true } },
        },
        orderBy: { submittedAt: "desc" },
      }),
      prisma.transcription.count({ where: { status: txStatus } }),
    ]);

    // Normalize both sources into a common shape for the UI
    const mappedRq = rqItems.map((r) => ({
      kind: "reviewQueue" as const,
      id: r.id,
      source: r.source,
      priorityTier: r.priorityTier,
      status: r.status,
      asrTranscript: r.asrTranscript,
      correctedTranscript: r.correctedTranscript,
      secondTranscript: r.secondTranscript,
      audioPath: r.audioPath,
      extractedFields: r.extractedFields,
      disagreementFlag: r.disagreementFlag,
      languageLeadNotes: r.languageLeadNotes,
      reviewerId: r.reviewerId,
      secondReviewerId: r.secondReviewerId,
      createdAt: r.createdAt.toISOString(),
      reviewer: r.reviewer,
      secondReviewer: r.secondReviewer,
      languageLead: r.languageLead,
      audioSession: r.audioSession,
      transcriber: null,
      recording: null,
    }));

    const mappedTx = txItems.map((t) => ({
      kind: "transcription" as const,
      id: t.id,
      transcriptionId: t.id,
      source: "kaccp_transcription",
      priorityTier: 3,
      status: t.status,
      asrTranscript: t.recording?.transcript ?? null,
      correctedTranscript: t.text,
      secondTranscript: null,
      audioPath: t.recording?.audioUrl ?? "",
      extractedFields: null,
      disagreementFlag: false,
      languageLeadNotes: t.reviewNotes,
      reviewerId: t.reviewerId,
      secondReviewerId: null,
      createdAt: t.submittedAt.toISOString(),
      reviewer: null,
      secondReviewer: null,
      languageLead: t.reviewer,
      audioSession: null,
      transcriber: t.transcriber,
      recording: t.recording,
    }));

    const merged = [...mappedRq, ...mappedTx].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    const total = rqTotal + txTotal;

    return NextResponse.json({ items: merged.slice(skip, skip + limit), total, page, limit });
  } catch (error) {
    console.error("Error listing language lead reviews:", error);
    return NextResponse.json({ error: "Failed to list reviews" }, { status: 500 });
  }
}
