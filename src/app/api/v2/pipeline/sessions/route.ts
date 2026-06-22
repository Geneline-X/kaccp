import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { verifyApiKey } from "@/lib/infra/auth/api-keys";
import { triageSession } from "@/lib/domain/pipeline";

function isReviewer(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || roles.includes("REVIEWER") || roles.includes("TRANSCRIBER")
    || user.role === "ADMIN" || user.role === "REVIEWER" || user.role === "TRANSCRIBER";
}

// GET /api/v2/pipeline/sessions — List audio sessions (admin/reviewer/transcriber)
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !isReviewer(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const outcome = searchParams.get("outcome");
    const detectedIntent = searchParams.get("intent");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where: any = {};
    if (outcome) where.outcome = outcome;
    if (detectedIntent) where.detectedIntent = detectedIntent;

    const [sessions, total] = await Promise.all([
      prisma.audioSession.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take: limit,
      }),
      prisma.audioSession.count({ where }),
    ]);

    return NextResponse.json({
      sessions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error listing audio sessions:", error);
    return NextResponse.json({ error: "Failed to list sessions" }, { status: 500 });
  }
}

// POST /api/v2/pipeline/sessions — Capture a new audio session from Flot
export async function POST(req: NextRequest) {
  try {
    const apiKey = await verifyApiKey(req.headers.get("authorization"));
    if (!apiKey.valid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const {
      sessionId,
      userIdHash,
      audioPath,
      audioDurationS,
      asrTranscript,
      asrConfidence,
      detectedIntent,
      extractedFields,
      outcome,
      ttsAudioPath,
      deviceInfo,
      metadata,
    } = body;

    if (!sessionId || !userIdHash || !audioPath || !asrTranscript) {
      return NextResponse.json(
        { error: "sessionId, userIdHash, audioPath, and asrTranscript are required" },
        { status: 400 },
      );
    }

    const session = await prisma.audioSession.create({
      data: {
        sessionId,
        userIdHash,
        audioPath,
        audioDurationS: audioDurationS ?? 0,
        asrTranscript,
        asrConfidence: asrConfidence ?? null,
        detectedIntent: detectedIntent ?? null,
        extractedFields: extractedFields ?? null,
        outcome: outcome ?? null,
        ttsAudioPath: ttsAudioPath ?? null,
        deviceInfo: deviceInfo ?? null,
        metadata: metadata ?? null,
      },
    });

    const triageResult = triageSession({
      asrConfidence: asrConfidence ?? null,
      outcome: outcome ?? null,
      amount: extractedFields?.amount ? parseFloat(extractedFields.amount) : undefined,
    });

    if (triageResult.shouldReview) {
      await prisma.reviewQueue.create({
        data: {
          audioSessionId: session.id,
          source: "pilot",
          priorityTier: triageResult.tier,
          status: "pending",
          asrTranscript,
          audioPath,
          extractedFields: extractedFields ?? null,
        },
      });
    }

    return NextResponse.json({
      session: { id: session.id, sessionId: session.sessionId },
      triage: triageResult,
    }, { status: 201 });
  } catch (error) {
    console.error("Error capturing audio session:", error);
    return NextResponse.json({ error: "Failed to capture session" }, { status: 500 });
  }
}
