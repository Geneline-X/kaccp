import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { getSignedUrl } from "@/lib/infra/gcs";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const userRoles = (user as any)?.roles?.length > 0 ? (user as any).roles : [user?.role];
    if (!user || (!userRoles.includes("ADMIN") && !userRoles.includes("REVIEWER"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const languageId = searchParams.get("languageId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const speakerId = searchParams.get("speakerId");

    const where: Prisma.RecordingWhereInput = { status: "PENDING_REVIEW" };
    if (languageId) where.languageId = languageId;
    if (speakerId) where.speakerId = speakerId;

    const [recordings, total, distinctSpeakers] = await Promise.all([
      prisma.recording.findMany({
        where,
        include: {
          prompt: { select: { englishText: true, category: true, emotion: true, instruction: true } },
          language: { select: { id: true, code: true, name: true } },
          speaker: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.recording.count({ where }),
      prisma.recording.findMany({
        where: { status: "PENDING_REVIEW" },
        select: { speaker: { select: { id: true, displayName: true } } },
        distinct: ["speakerId"],
      }),
    ]);

    const recordingsWithUrls = await Promise.all(
      recordings.map(async (rec) => {
        let playbackUrl = rec.audioUrl;
        if (rec.audioUrl.startsWith("gs://")) {
          try {
            playbackUrl = await getSignedUrl(rec.audioUrl, 3600);
          } catch {
            playbackUrl = rec.audioUrl;
          }
        }
        return { ...rec, playbackUrl };
      })
    );

    return NextResponse.json({
      recordings: recordingsWithUrls,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      speakers: distinctSpeakers.map((r) => r.speaker).filter(Boolean),
    });
  } catch (error) {
    console.error("Error fetching recordings for review:", error);
    return NextResponse.json({ error: "Failed to fetch recordings" }, { status: 500 });
  }
}
