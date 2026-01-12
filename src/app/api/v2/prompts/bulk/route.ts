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

    // Check if language exists (unless Universal)
    let targetLanguageId: string | null = languageId;
    if (languageId === "ALL") {
      targetLanguageId = null;
    } else {
      const language = await prisma.language.findUnique({
        where: { id: languageId },
      });

      if (!language) {
        return NextResponse.json(
          { error: "Language not found" },
          { status: 404 }
        );
      }
    }

    // Validate and transform prompts
    const validPrompts: {
      languageId: string | null;
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
        console.log(`Row ${row} error: Invalid category '${categoryUpper}' (Original: '${prompt.category}')`);
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
        languageId: targetLanguageId,
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

    // Check for existing prompts to avoid duplicates (since schema doesn't strictly enforce unique text)
    const existingPrompts = await prisma.prompt.findMany({
      where: {
        languageId: targetLanguageId,
        englishText: {
          in: validPrompts.map((p) => p.englishText),
        },
      },
      select: { englishText: true },
    });

    const existingTexts = new Set(existingPrompts.map((p) => p.englishText));
    const newPrompts = validPrompts.filter((p) => !existingTexts.has(p.englishText));

    if (newPrompts.length === 0) {
      return NextResponse.json({
        success: true,
        imported: 0,
        total: csvPrompts.length,
        message: "All prompts already exist for this language",
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
        errorCount: errors.length,
      });
    }

    // Bulk insert new prompts only
    const result = await prisma.prompt.createMany({
      data: newPrompts,
      skipDuplicates: true, // Specific DB-level skip
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

// DELETE /api/v2/prompts/bulk - Bulk delete prompts (Admin only)
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { promptIds } = await req.json();

    if (!promptIds || !Array.isArray(promptIds) || promptIds.length === 0) {
      return NextResponse.json(
        { error: "No promptIds provided" },
        { status: 400 }
      );
    }

    // 1. Identify prompts with recordings (cannot delete)
    const promptsWithRecordings = await prisma.prompt.findMany({
      where: {
        id: { in: promptIds },
        recordings: { some: {} },
      },
      select: { id: true, englishText: true },
    });

    const notAllowedIds = new Set(promptsWithRecordings.map((p) => p.id));
    const allowedIds = promptIds.filter((id) => !notAllowedIds.has(id));

    if (allowedIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          deleted: 0,
          failed: promptsWithRecordings.length,
          message: "All selected prompts have recordings and cannot be deleted.",
        },
        { status: 400 }
      );
    }

    // 2. Delete allowed prompts
    const result = await prisma.prompt.deleteMany({
      where: {
        id: { in: allowedIds },
      },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      failed: promptsWithRecordings.length,
      message: `Deleted ${result.count} prompts. ${promptsWithRecordings.length} skipped due to existing recordings.`,
    });
  } catch (error) {
    console.error("Error bulk deleting prompts:", error);
    return NextResponse.json(
      { error: "Failed to bulk delete prompts" },
      { status: 500 }
    );
  }
}

// PATCH /api/v2/prompts/bulk - Bulk update prompts (Admin only)
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { updates } = await req.json();

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    // Validate updates (basic check)
    const validCategories = Object.values(PromptCategory);
    const validEmotions = Object.values(PromptEmotion);
    const errors: { id: string; error: string }[] = [];
    const validUpdates: any[] = [];

    updates.forEach((update) => {
      if (!update.id) {
        return;
      }

      const data: any = {};

      if (update.englishText) data.englishText = update.englishText.trim();
      if (update.instruction !== undefined) data.instruction = update.instruction;
      if (update.targetDurationSec) data.targetDurationSec = update.targetDurationSec;

      if (update.category) {
        if (!validCategories.includes(update.category)) {
          errors.push({ id: update.id, error: "Invalid category" });
          return;
        }
        data.category = update.category;
      }

      if (update.emotion) {
        if (!validEmotions.includes(update.emotion)) {
          errors.push({ id: update.id, error: "Invalid emotion" });
          return;
        }
        data.emotion = update.emotion;
      }

      if (Object.keys(data).length > 0) {
        validUpdates.push({ id: update.id, data });
      }
    });

    if (validUpdates.length === 0) {
      return NextResponse.json(
        { error: "No valid updates found", errors },
        { status: 400 }
      );
    }

    // Execute updates in transaction
    const results = await prisma.$transaction(
      validUpdates.map((update) =>
        prisma.prompt.update({
          where: { id: update.id },
          data: update.data,
        })
      )
    );

    return NextResponse.json({
      success: true,
      updated: results.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error("Error bulk updating prompts:", error);
    return NextResponse.json(
      { error: "Failed to bulk update prompts" },
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
