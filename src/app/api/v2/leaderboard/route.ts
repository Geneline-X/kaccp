import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/v2/leaderboard - Get leaderboard for speakers and transcribers
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "all"; // speakers, transcribers, all
    const languageId = searchParams.get("languageId");
    const limit = parseInt(searchParams.get("limit") || "20");

    const result: any = {};

    // Get top speakers
    if (type === "all" || type === "speakers") {
      const speakerStats = await prisma.recording.groupBy({
        by: ["speakerId"],
        where: {
          status: "APPROVED",
          ...(languageId && { languageId }),
        },
        _count: { id: true },
        _sum: { durationSec: true },
        orderBy: { _sum: { durationSec: "desc" } },
        take: limit,
      });

      // Get user details for speakers
      const speakerIds = speakerStats.map((s) => s.speakerId);
      const speakerUsers = await prisma.user.findMany({
        where: { id: { in: speakerIds } },
        select: {
          id: true,
          displayName: true,
          email: true,
          speaksLanguages: true,
          createdAt: true,
        },
      });

      const speakerMap = new Map(speakerUsers.map((u) => [u.id, u]));

      result.speakers = speakerStats.map((stat, index) => {
        const user = speakerMap.get(stat.speakerId);
        return {
          rank: index + 1,
          id: stat.speakerId,
          displayName: user?.displayName || "Anonymous",
          languages: user?.speaksLanguages || [],
          recordingsCount: stat._count.id,
          totalDurationSec: stat._sum.durationSec || 0,
          totalMinutes: Math.round((stat._sum.durationSec || 0) / 60 * 10) / 10,
          joinedAt: user?.createdAt,
        };
      });
    }

    // Get top transcribers
    if (type === "all" || type === "transcribers") {
      const transcriberStats = await prisma.transcription.groupBy({
        by: ["transcriberId"],
        where: {
          status: "APPROVED",
          ...(languageId && { recording: { languageId } }),
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: limit,
      });

      // Get user details for transcribers
      const transcriberIds = transcriberStats.map((t) => t.transcriberId);
      const transcriberUsers = await prisma.user.findMany({
        where: { id: { in: transcriberIds } },
        select: {
          id: true,
          displayName: true,
          email: true,
          writesLanguages: true,
          qualityScore: true,
          createdAt: true,
        },
      });

      const transcriberMap = new Map(transcriberUsers.map((u) => [u.id, u]));

      // Get total duration transcribed for each transcriber
      const transcriberDurations = await Promise.all(
        transcriberIds.map(async (id) => {
          const sum = await prisma.transcription.findMany({
            where: { transcriberId: id, status: "APPROVED" },
            select: { recording: { select: { durationSec: true } } },
          });
          return {
            id,
            totalDuration: sum.reduce((acc, t) => acc + (t.recording?.durationSec || 0), 0),
          };
        })
      );

      const durationMap = new Map(transcriberDurations.map((d) => [d.id, d.totalDuration]));

      result.transcribers = transcriberStats.map((stat, index) => {
        const user = transcriberMap.get(stat.transcriberId);
        const totalDuration = durationMap.get(stat.transcriberId) || 0;
        return {
          rank: index + 1,
          id: stat.transcriberId,
          displayName: user?.displayName || "Anonymous",
          languages: user?.writesLanguages || [],
          transcriptionsCount: stat._count.id,
          totalDurationSec: totalDuration,
          totalMinutes: Math.round(totalDuration / 60 * 10) / 10,
          qualityScore: user?.qualityScore || 0,
          joinedAt: user?.createdAt,
        };
      });
    }

    // Get overall stats
    const [totalSpeakers, totalTranscribers, totalRecordings, totalTranscriptions] = await Promise.all([
      prisma.user.count({ where: { role: "SPEAKER" } }),
      prisma.user.count({ where: { role: "TRANSCRIBER" } }),
      prisma.recording.count({ where: { status: "APPROVED" } }),
      prisma.transcription.count({ where: { status: "APPROVED" } }),
    ]);

    const totalDuration = await prisma.recording.aggregate({
      where: { status: "APPROVED" },
      _sum: { durationSec: true },
    });

    result.stats = {
      totalSpeakers,
      totalTranscribers,
      totalRecordings,
      totalTranscriptions,
      totalHours: Math.round((totalDuration._sum.durationSec || 0) / 3600 * 10) / 10,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
