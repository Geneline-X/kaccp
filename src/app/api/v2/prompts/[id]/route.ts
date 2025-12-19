import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { PromptCategory, PromptEmotion } from "@prisma/client";

// GET /api/v2/prompts/[id] - Get a single prompt
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const prompt = await prisma.prompt.findUnique({
      where: { id: params.id },
      include: {
        language: {
          include: {
            country: true,
          },
        },
        _count: {
          select: {
            recordings: true,
          },
        },
      },
    });

    if (!prompt) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error("Error fetching prompt:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompt" },
      { status: 500 }
    );
  }
}

// PATCH /api/v2/prompts/[id] - Update a prompt (Admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { englishText, category, emotion, instruction, targetDurationSec, isActive } = body;

    // Validate category if provided
    if (category && !Object.values(PromptCategory).includes(category)) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    // Validate emotion if provided
    if (emotion && !Object.values(PromptEmotion).includes(emotion)) {
      return NextResponse.json(
        { error: "Invalid emotion" },
        { status: 400 }
      );
    }

    const prompt = await prisma.prompt.update({
      where: { id: params.id },
      data: {
        ...(englishText && { englishText }),
        ...(category && { category }),
        ...(emotion && { emotion }),
        ...(instruction !== undefined && { instruction }),
        ...(targetDurationSec && { targetDurationSec }),
        ...(typeof isActive === "boolean" && { isActive }),
      },
      include: {
        language: true,
      },
    });

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error("Error updating prompt:", error);
    return NextResponse.json(
      { error: "Failed to update prompt" },
      { status: 500 }
    );
  }
}

// DELETE /api/v2/prompts/[id] - Delete a prompt (Admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if prompt has recordings
    const recordingCount = await prisma.recording.count({
      where: { promptId: params.id },
    });

    if (recordingCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete prompt with recordings. Deactivate it instead." },
        { status: 400 }
      );
    }

    await prisma.prompt.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting prompt:", error);
    return NextResponse.json(
      { error: "Failed to delete prompt" },
      { status: 500 }
    );
  }
}
