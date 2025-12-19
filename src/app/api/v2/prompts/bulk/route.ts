import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { PromptCategory, PromptEmotion } from "@prisma/client";

interface CSVPrompt {
  english_text: string;
  category: string;
  emotion?: string;
  instruction?: string;
  target_duration_sec?: string;
}

// POST /api/v2/prompts/bulk - Bulk import prompts from CSV data (Admin only)
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { languageId, prompts: csvPrompts } = body as {
      languageId: string;
      prompts: CSVPrompt[];
    };

    if (!languageId || !csvPrompts || !Array.isArray(csvPrompts)) {
      return NextResponse.json(
        { error: "languageId and prompts array are required" },
        { status: 400 }
      );
    }

    // Check if language exists
    const language = await prisma.language.findUnique({
      where: { id: languageId },
    });

    if (!language) {
      return NextResponse.json(
        { error: "Language not found" },
        { status: 404 }
      );
    }

    // Validate and transform prompts
    const validPrompts: {
      languageId: string;
      englishText: string;
      category: PromptCategory;
      emotion: PromptEmotion;
      instruction: string | null;
      targetDurationSec: number;
    }[] = [];
    const errors: { row: number; error: string }[] = [];

    const validCategories = Object.values(PromptCategory);
    const validEmotions = Object.values(PromptEmotion);

    csvPrompts.forEach((prompt, index) => {
      const row = index + 1;

      // Check required fields
      if (!prompt.english_text || !prompt.category) {
        errors.push({ row, error: "Missing english_text or category" });
        return;
      }

      // Map category (handle both formats: "GREETINGS" or "greetings")
      const categoryUpper = prompt.category.toUpperCase().replace(/\s+/g, "_");
      if (!validCategories.includes(categoryUpper as PromptCategory)) {
        errors.push({
          row,
          error: `Invalid category: ${prompt.category}. Valid: ${validCategories.join(", ")}`,
        });
        return;
      }

      // Map emotion
      let emotion: PromptEmotion = PromptEmotion.NEUTRAL;
      if (prompt.emotion) {
        const emotionUpper = prompt.emotion.toUpperCase();
        if (validEmotions.includes(emotionUpper as PromptEmotion)) {
          emotion = emotionUpper as PromptEmotion;
        }
      }

      validPrompts.push({
        languageId,
        englishText: prompt.english_text.trim(),
        category: categoryUpper as PromptCategory,
        emotion,
        instruction: prompt.instruction?.trim() || null,
        targetDurationSec: parseInt(prompt.target_duration_sec || "5") || 5,
      });
    });

    if (validPrompts.length === 0) {
      return NextResponse.json(
        { error: "No valid prompts to import", errors },
        { status: 400 }
      );
    }

    // Bulk insert
    const result = await prisma.prompt.createMany({
      data: validPrompts,
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      imported: result.count,
      total: csvPrompts.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Show first 10 errors
      errorCount: errors.length,
    });
  } catch (error) {
    console.error("Error bulk importing prompts:", error);
    return NextResponse.json(
      { error: "Failed to import prompts" },
      { status: 500 }
    );
  }
}

// GET /api/v2/prompts/bulk - Get CSV template
export async function GET() {
  const template = `english_text,category,emotion,instruction,target_duration_sec
"Good morning, how are you?",GREETINGS,NEUTRAL,,5
"I am so happy to see you!",EMOTIONS_HAPPY,HAPPY,"Say with excitement",4
"Where is the nearest market?",QUESTIONS,QUESTION,,5
"The price is too high",MARKET_SHOPPING,NEUTRAL,"Haggling tone",6
"I feel sick, I need help",HEALTH,URGENT,,5`;

  return new NextResponse(template, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=prompts_template.csv",
    },
  });
}
