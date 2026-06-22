import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

function isReviewer(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || roles.includes("REVIEWER") || roles.includes("TRANSCRIBER")
    || user.role === "ADMIN" || user.role === "REVIEWER" || user.role === "TRANSCRIBER";
}

// GET /api/v2/pipeline/review-queue — List review queue items

// GET /api/v2/pipeline/review-queue — List review queue items
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!isReviewer(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const priorityTier = searchParams.get("tier");
    const source = searchParams.get("source");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (priorityTier) where.priorityTier = parseInt(priorityTier);
    if (source) where.source = source;

    const [items, total] = await Promise.all([
      prisma.reviewQueue.findMany({
        where,
        orderBy: [{ priorityTier: "asc" }, { createdAt: "asc" }],
        skip,
        take: limit,
        include: {
          audioSession: {
            select: { audioDurationS: true, timestamp: true, detectedIntent: true, outcome: true },
          },
          reviewer: { select: { id: true, displayName: true, email: true } },
          secondReviewer: { select: { id: true, displayName: true, email: true } },
        },
      }),
      prisma.reviewQueue.count({ where }),
    ]);

    return NextResponse.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error listing review queue:", error);
    return NextResponse.json({ error: "Failed to list review queue" }, { status: 500 });
  }
}

// POST /api/v2/pipeline/review-queue — Push an item for review
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!isReviewer(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      audioSessionId,
      recordingId,
      source = "pilot",
      priorityTier = 3,
      asrTranscript,
      audioPath,
      extractedFields,
    } = body;

    if (!audioPath) {
      return NextResponse.json({ error: "audioPath is required" }, { status: 400 });
    }

    const item = await prisma.reviewQueue.create({
      data: {
        audioSessionId: audioSessionId ?? null,
        recordingId: recordingId ?? null,
        source,
        priorityTier,
        status: "pending",
        asrTranscript: asrTranscript ?? null,
        audioPath,
        extractedFields: extractedFields ?? null,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Error creating review queue item:", error);
    return NextResponse.json({ error: "Failed to create review item" }, { status: 500 });
  }
}
