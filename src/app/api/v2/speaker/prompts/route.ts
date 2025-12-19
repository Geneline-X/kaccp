import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/v2/speaker/prompts - Get available prompts for speaker to record
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const languageId = searchParams.get("languageId");
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "10");

    if (!languageId) {
      return NextResponse.json(
        { error: "languageId is required" },
        { status: 400 }
      );
    }

    // Check if user speaks this language
    if (!user.speaksLanguages.includes(languageId)) {
      // Get language code to check
      const language = await prisma.language.findUnique({
        where: { id: languageId },
        select: { code: true },
      });

      if (language && !user.speaksLanguages.includes(language.code)) {
        return NextResponse.json(
          { error: "You are not registered to speak this language" },
          { status: 403 }
        );
      }
    }

    // Get prompts that this user hasn't recorded yet
    const prompts = await prisma.prompt.findMany({
      where: {
        languageId,
        isActive: true,
        ...(category && { category: category as any }),
        // Exclude prompts already recorded by this user
        NOT: {
          recordings: {
            some: {
              speakerId: user.id,
            },
          },
        },
      },
      include: {
        language: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: [
        { timesRecorded: "asc" }, // Prioritize less recorded prompts
        { createdAt: "asc" },
      ],
      take: limit,
    });

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error("Error fetching speaker prompts:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompts" },
      { status: 500 }
    );
  }
}
