import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/v2/languages/[id] - Get a single language with stats
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const language = await prisma.language.findUnique({
      where: { id: params.id },
      include: {
        country: true,
        _count: {
          select: {
            prompts: true,
            recordings: true,
          },
        },
      },
    });

    if (!language) {
      return NextResponse.json({ error: "Language not found" }, { status: 404 });
    }

    // Get recording stats by status
    const recordingStats = await prisma.recording.groupBy({
      by: ["status"],
      where: { languageId: params.id },
      _count: true,
    });

    return NextResponse.json({
      language,
      stats: {
        recordings: recordingStats,
        progressPercent: language.targetMinutes > 0
          ? Math.round((language.approvedMinutes / language.targetMinutes) * 100)
          : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching language:", error);
    return NextResponse.json(
      { error: "Failed to fetch language" },
      { status: 500 }
    );
  }
}

// PATCH /api/v2/languages/[id] - Update a language (Admin only)
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
    const {
      name,
      nativeName,
      isActive,
      targetMinutes,
      speakerRatePerMinute,
      transcriberRatePerMin,
    } = body;

    const language = await prisma.language.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(nativeName !== undefined && { nativeName }),
        ...(typeof isActive === "boolean" && { isActive }),
        ...(targetMinutes && { targetMinutes }),
        ...(speakerRatePerMinute && { speakerRatePerMinute }),
        ...(transcriberRatePerMin && { transcriberRatePerMin }),
      },
      include: {
        country: true,
      },
    });

    return NextResponse.json({ language });
  } catch (error) {
    console.error("Error updating language:", error);
    return NextResponse.json(
      { error: "Failed to update language" },
      { status: 500 }
    );
  }
}

// DELETE /api/v2/languages/[id] - Delete a language (Admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if language has recordings
    const recordingCount = await prisma.recording.count({
      where: { languageId: params.id },
    });

    if (recordingCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete language with recordings" },
        { status: 400 }
      );
    }

    // Delete prompts first
    await prisma.prompt.deleteMany({
      where: { languageId: params.id },
    });

    await prisma.language.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting language:", error);
    return NextResponse.json(
      { error: "Failed to delete language" },
      { status: 500 }
    );
  }
}
