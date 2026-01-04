import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/v2/languages/[id] - Get a single language with stats
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const language = await prisma.language.findUnique({
      where: { id },
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
      where: { languageId: id },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      where: { id },
      data: {
        ...(name && { name }),
        ...(nativeName !== undefined && { nativeName }),
        ...(typeof isActive === "boolean" && { isActive }),
        ...(typeof targetMinutes === "number" && { targetMinutes }),
        ...(typeof speakerRatePerMinute === "number" && { speakerRatePerMinute }),
        ...(typeof transcriberRatePerMin === "number" && { transcriberRatePerMin }),
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if language has recordings
    const recordingCount = await prisma.recording.count({
      where: { languageId: id },
    });

    if (recordingCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete language with recordings" },
        { status: 400 }
      );
    }

    // Delete prompts first
    await prisma.prompt.deleteMany({
      where: { languageId: id },
    });

    await prisma.language.delete({
      where: { id },
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
