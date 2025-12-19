import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/v2/speaker/recordings - Get speaker's recording history
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const languageId = searchParams.get("languageId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where = {
      speakerId: user.id,
      ...(languageId && { languageId }),
    };

    const [recordings, total] = await Promise.all([
      prisma.recording.findMany({
        where,
        include: {
          prompt: {
            select: {
              englishText: true,
              category: true,
              emotion: true,
            },
          },
          language: {
            select: {
              code: true,
              name: true,
            },
          },
          transcription: {
            select: {
              text: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.recording.count({ where }),
    ]);

    // Get stats
    const stats = await prisma.recording.groupBy({
      by: ["status"],
      where: { speakerId: user.id },
      _count: true,
      _sum: {
        durationSec: true,
      },
    });

    return NextResponse.json({
      recordings,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching speaker recordings:", error);
    return NextResponse.json(
      { error: "Failed to fetch recordings" },
      { status: 500 }
    );
  }
}

// POST /api/v2/speaker/recordings - Submit a new recording
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { promptId, audioUrl, durationSec, fileSize, sampleRate, deviceInfo } = body;

    if (!promptId || !audioUrl || !durationSec) {
      return NextResponse.json(
        { error: "promptId, audioUrl, and durationSec are required" },
        { status: 400 }
      );
    }

    // Validate duration (max 10 seconds)
    if (durationSec > 10) {
      return NextResponse.json(
        { error: "Recording must be 10 seconds or less" },
        { status: 400 }
      );
    }

    // Get prompt and language
    const prompt = await prisma.prompt.findUnique({
      where: { id: promptId },
      include: {
        language: true,
      },
    });

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    // Check if user already recorded this prompt
    const existingRecording = await prisma.recording.findFirst({
      where: {
        promptId,
        speakerId: user.id,
      },
    });

    if (existingRecording) {
      return NextResponse.json(
        { error: "You have already recorded this prompt" },
        { status: 400 }
      );
    }

    // Create recording
    const recording = await prisma.recording.create({
      data: {
        promptId,
        speakerId: user.id,
        languageId: prompt.languageId,
        audioUrl,
        durationSec,
        fileSize,
        sampleRate,
        deviceInfo,
        consentGiven: true,
      },
      include: {
        prompt: true,
        language: true,
      },
    });

    // Update prompt timesRecorded
    await prisma.prompt.update({
      where: { id: promptId },
      data: {
        timesRecorded: { increment: 1 },
      },
    });

    // Update language collectedMinutes
    await prisma.language.update({
      where: { id: prompt.languageId },
      data: {
        collectedMinutes: { increment: durationSec / 60 },
      },
    });

    // Update user stats
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totalRecordingsSec: { increment: durationSec },
      },
    });

    return NextResponse.json({ recording }, { status: 201 });
  } catch (error) {
    console.error("Error creating recording:", error);
    return NextResponse.json(
      { error: "Failed to create recording" },
      { status: 500 }
    );
  }
}
