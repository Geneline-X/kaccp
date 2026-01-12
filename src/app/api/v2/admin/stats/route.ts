import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/v2/admin/stats - Get platform statistics
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || (!((user as any).roles || []).includes("ADMIN") && user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get overall stats
    const [
      totalCountries,
      totalLanguages,
      totalPrompts,
      totalRecordings,
      totalTranscriptions,
      totalUsers,
    ] = await Promise.all([
      prisma.country.count({ where: { isActive: true } }),
      prisma.language.count({ where: { isActive: true } }),
      prisma.prompt.count({ where: { isActive: true } }),
      prisma.recording.count(),
      prisma.transcription.count(),
      prisma.user.count({ where: { isActive: true } }),
    ]);

    // Get recording stats by status
    const recordingsByStatus = await prisma.recording.groupBy({
      by: ["status"],
      _count: true,
      _sum: {
        durationSec: true,
      },
    });

    // Get transcription stats by status
    const transcriptionsByStatus = await prisma.transcription.groupBy({
      by: ["status"],
      _count: true,
    });

    // Get user stats by role
    const usersByRole = await prisma.user.groupBy({
      by: ["role"],
      _count: true,
    });

    // Get language progress
    const languages = await prisma.language.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        targetMinutes: true,
        collectedMinutes: true,
        approvedMinutes: true,
        _count: {
          select: {
            prompts: true,
            recordings: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const languageProgress = languages.map((lang) => ({
      ...lang,
      progressPercent: lang.targetMinutes > 0
        ? Math.round((lang.approvedMinutes / lang.targetMinutes) * 100)
        : 0,
      collectedHours: Math.round((lang.collectedMinutes / 60) * 10) / 10,
      approvedHours: Math.round((lang.approvedMinutes / 60) * 10) / 10,
      targetHours: Math.round((lang.targetMinutes / 60) * 10) / 10,
    }));

    // Calculate totals
    const totalCollectedMinutes = languages.reduce(
      (sum, l) => sum + l.collectedMinutes,
      0
    );
    const totalApprovedMinutes = languages.reduce(
      (sum, l) => sum + l.approvedMinutes,
      0
    );

    return NextResponse.json({
      overview: {
        countries: totalCountries,
        languages: totalLanguages,
        prompts: totalPrompts,
        recordings: totalRecordings,
        transcriptions: totalTranscriptions,
        users: totalUsers,
        totalCollectedHours: Math.round((totalCollectedMinutes / 60) * 10) / 10,
        totalApprovedHours: Math.round((totalApprovedMinutes / 60) * 10) / 10,
      },
      recordingsByStatus,
      transcriptionsByStatus,
      usersByRole,
      languageProgress,
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
