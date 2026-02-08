import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { locales, defaultLocale } from "@/i18n";
import { resolveTranslatedText } from "@/lib/translations/resolver";

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
    const uiLocaleParam = searchParams.get("uiLocale") || defaultLocale;
    const uiLocale = locales.includes(uiLocaleParam as any) ? uiLocaleParam : defaultLocale;

    if (!languageId) {
      return NextResponse.json(
        { error: "languageId is required" },
        { status: 400 }
      );
    }


    // Get language details to check logic
    const language = await prisma.language.findUnique({
      where: { id: languageId },
      select: { code: true, includeUniversalPrompts: true },
    });

    if (!language) {
      return NextResponse.json({ error: "Language not found" }, { status: 404 });
    }

    // Check if user speaks this language
    if (!user.speaksLanguages.includes(languageId) && !user.speaksLanguages.includes(language.code)) {
      return NextResponse.json(
        { error: "You are not registered to speak this language" },
        { status: 403 }
      );
    }

    // Get prompts that this user hasn't recorded yet
    const prompts = await prisma.prompt.findMany({
      where: {
        isActive: true,
        // Check if language wants universal prompts included
        ...(!language.includeUniversalPrompts
          ? { languageId }
          : {
            OR: [
              { languageId },
              { languageId: null }
            ]
          }
        ),
        ...(category && { category: category as any }),
        // Exclude prompts already successfully recorded in this language (by anyone)
        NOT: {
          recordings: {
            some: {
              languageId,
              status: {
                in: ["APPROVED", "PENDING_TRANSCRIPTION", "TRANSCRIBED", "FLAGGED"]
              }
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

    const promptsWithDisplayText = await Promise.all(
      prompts.map(async (prompt) => {
        const displayText = await resolveTranslatedText({
          entityType: "prompt",
          entityId: prompt.id,
          field: "englishText",
          originalText: prompt.englishText,
          requestedLanguage: uiLocale,
          defaultLanguage: defaultLocale,
        });

        const displayInstruction = await resolveTranslatedText({
          entityType: "prompt",
          entityId: prompt.id,
          field: "instruction",
          originalText: prompt.instruction || "",
          requestedLanguage: uiLocale,
          defaultLanguage: defaultLocale,
        });

        return {
          ...prompt,
          displayText: displayText.text,
          displayInstruction: displayInstruction.text || null,
        };
      })
    );

    return NextResponse.json({ prompts: promptsWithDisplayText, uiLocale });
  } catch (error) {
    console.error("Error fetching speaker prompts:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompts" },
      { status: 500 }
    );
  }
}
