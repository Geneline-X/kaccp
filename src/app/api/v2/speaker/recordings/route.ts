import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { kayXClient } from "@/lib/kay-client";
import { getSignedUrl } from "@/lib/gcs";

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
// POST /api/v2/speaker/recordings - Submit a new recording
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { promptId, audioUrl, durationSec, fileSize, sampleRate, deviceInfo, verifyWithKayX, languageId } = body;

    if (!promptId || !audioUrl || !durationSec) {
      return NextResponse.json(
        { error: "promptId, audioUrl, and durationSec are required" },
        { status: 400 }
      );
    }

    // Validate duration (max 15 seconds + small buffer)
    if (durationSec > 16) {
      return NextResponse.json(
        { error: "Recording must be 15 seconds or less" },
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

    // Determine target language for this recording
    let recordingLanguageId = prompt.languageId;

    // If prompt is universal (null languageId), we need language from request
    if (!recordingLanguageId) {
      if (!languageId) {
        return NextResponse.json(
          { error: "languageId is required for universal prompts" },
          { status: 400 }
        );
      }
      recordingLanguageId = languageId;
    }

    // Verify user can speak this language
    // Note: This check assumes 'user.speaksLanguages' contains codes (e.g. 'kri') or IDs.
    // The previous implementation checked codes. Let's resolve the ID to Code to be safe.

    // Check if user already recorded this prompt
    // For universal prompts, we check if they recorded THIS prompt in ANY language? 
    // Or this specific language? Usually a prompt is unique per meaning.
    // If I record "Hello" in Krio, should I also record it in Mende?
    // User requested "Universal" prompts -> implying one prompt object served to all.
    // So if I record it once, I'm done with that prompt.
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
        languageId: recordingLanguageId, // Use resolved language
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
      where: { id: recordingLanguageId },
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

    // Automatic Kay X transcription (enabled by default for Krio)
    const shouldAutoTranscribe = kayXClient.isEnabled();

    if (shouldAutoTranscribe) {
      // Resolve language code
      let langCode = prompt.language?.code;
      if (!langCode && recording.language) {
        langCode = recording.language.code;
      }

      const isKrio = langCode?.toLowerCase() === "kri";

      if (isKrio) {
        // Trigger auto-transcription asynchronously (don't block response)
        (async () => {
          try {
            let targetUrl = audioUrl;

            // If audio is in GCS, generate a signed URL for Kay X to access
            if (audioUrl.startsWith("gs://")) {
              targetUrl = await getSignedUrl(audioUrl);
            }

            const result = await kayXClient.transcribeUrl(targetUrl);

            if (result.success) {
              await prisma.recording.update({
                where: { id: recording.id },
                data: {
                  transcript: result.transcript,
                  transcriptConfidence: result.confidence,
                  autoTranscriptionStatus: "COMPLETED",
                  autoTranscribedAt: new Date(),
                  transcriptMetadata: result.metadata,
                },
              });
            } else {
              await prisma.recording.update({
                where: { id: recording.id },
                data: {
                  autoTranscriptionStatus: "FAILED",
                  autoTranscribedAt: new Date(),
                  transcriptMetadata: {
                    error: result.error,
                    timestamp: new Date().toISOString(),
                    details: result as any, // Cast to any for JSON compatibility
                  },
                },
              });
            }
          } catch (error) {
            console.error("Error during automatic transcription:", error);
            // Optionally mark as FAILED in DB if the error happened before kayXClient returned
            try {
              await prisma.recording.update({
                where: { id: recording.id },
                data: {
                  autoTranscriptionStatus: "FAILED",
                  transcriptMetadata: {
                    error: String(error),
                    timestamp: new Date().toISOString(),
                  },
                },
              });
            } catch (ignore) { /* ignore update error */ }
          }
        })();
      }
    }

    return NextResponse.json({ recording }, { status: 201 });
  } catch (error) {
    console.error("Error creating recording:", error);
    return NextResponse.json(
      { error: "Failed to create recording" },
      { status: 500 }
    );
  }
}
