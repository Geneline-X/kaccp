import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { PromptCategory, PromptEmotion } from "@prisma/client";

// GET /api/v2/prompts - List prompts (with filters)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const languageId = searchParams.get("languageId");
    const category = searchParams.get("category") as PromptCategory | null;
    const emotion = searchParams.get("emotion") as PromptEmotion | null;
    const activeOnly = searchParams.get("activeOnly") !== "false";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where = {
      ...(languageId && { languageId }),
      ...(category && { category }),
      ...(emotion && { emotion }),
      ...(activeOnly && { isActive: true }),
    };

    const [prompts, total] = await Promise.all([
      prisma.prompt.findMany({
        where,
        include: {
          language: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          _count: {
            select: {
              recordings: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.prompt.count({ where }),
    ]);

    return NextResponse.json({
      prompts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching prompts:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompts" },
      { status: 500 }
    );
  }
}

// POST /api/v2/prompts - Create a single prompt (Admin only)
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      languageId,
      englishText,
      category,
      emotion = "NEUTRAL",
      instruction,
      targetDurationSec = 5,
    } = body;

    if (!languageId || !englishText || !category) {
      return NextResponse.json(
        { error: "languageId, englishText, and category are required" },
        { status: 400 }
      );
    }

    // Validate category
    if (!Object.values(PromptCategory).includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${Object.values(PromptCategory).join(", ")}` },
        { status: 400 }
      );
    }

    // Validate emotion
    if (!Object.values(PromptEmotion).includes(emotion)) {
      return NextResponse.json(
        { error: `Invalid emotion. Must be one of: ${Object.values(PromptEmotion).join(", ")}` },
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

    const prompt = await prisma.prompt.create({
      data: {
        languageId,
        englishText,
        category,
        emotion,
        instruction,
        targetDurationSec,
      },
      include: {
        language: true,
      },
    });

    return NextResponse.json({ prompt }, { status: 201 });
  } catch (error) {
    console.error("Error creating prompt:", error);
    return NextResponse.json(
      { error: "Failed to create prompt" },
      { status: 500 }
    );
  }
}
