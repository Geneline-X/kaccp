import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { getWriteSignedUrl } from "@/lib/infra/gcs";

// POST /api/v2/speaker/upload-url - Get a signed URL for uploading recording
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { promptId, languageId, contentType = "audio/wav" } = body;

    if (!promptId) {
      return NextResponse.json(
        { error: "promptId is required" },
        { status: 400 }
      );
    }

    // Run prompt lookup, speaker count, and recording count in parallel
    const targetLanguageIdHint = languageId; // used if prompt is universal

    const [prompt, speakerCount, recordingCount] = await Promise.all([
      prisma.prompt.findUnique({
        where: { id: promptId },
        include: {
          language: {
            include: {
              country: true,
            },
          },
        },
      }),
      // Speaker number for labeling (e.g., speaker_0001)
      prisma.user.count({
        where: {
          role: "SPEAKER",
          createdAt: { lte: user.createdAt },
        },
      }),
      // Recording count for this speaker (resolved after prompt lookup if needed)
      prisma.recording.count({
        where: {
          speakerId: user.id,
          ...(targetLanguageIdHint ? { languageId: targetLanguageIdHint } : {}),
        },
      }),
    ]);

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    const speakerLabel = `speaker_${String(speakerCount).padStart(4, "0")}`;
    const recordingNumber = String(recordingCount + 1).padStart(5, "0");

    // For universal prompts (no language), use a default structure
    // For language-specific prompts, use the language/country structure
    let countryCode = "universal";
    let languageCode = "universal";

    if (prompt.language) {
      countryCode = prompt.language.country.code.toLowerCase();
      languageCode = prompt.language.code.toLowerCase();
    } else if (languageId) {
      // Universal prompt - fetch the target language
      const language = await prisma.language.findUnique({
        where: { id: languageId },
        include: { country: true },
      });

      if (language) {
        countryCode = language.country.code.toLowerCase();
        languageCode = language.code.toLowerCase();
      }
    }

    // Generate filename: {language}_{speaker}_{recordingNumber}.wav
    // Path: {country}/{language}/wavs/{speakerLabel}/{language}_{speaker}_{number}.wav

    // Always use .wav extension - we'll convert on upload if needed
    const fileName = `${languageCode}_${speakerLabel}_${recordingNumber}.wav`;
    const filePath = `${countryCode}/${languageCode}/wavs/${speakerLabel}/${fileName}`;

    // For now, accept the browser's format (webm/mp4) and store as-is
    // The extension in the actual upload will match contentType
    const actualExtension = contentType === "audio/wav" ? "wav" : contentType === "audio/webm" ? "webm" : "mp4";
    const actualFilePath = `${countryCode}/${languageCode}/wavs/${speakerLabel}/${languageCode}_${speakerLabel}_${recordingNumber}.${actualExtension}`;

    if (!process.env.GCS_BUCKET) {
      return NextResponse.json({ error: "GCS_BUCKET is not configured" }, { status: 500 });
    }

    // Full GCS URI for the file
    const audioUrl = `gs://${process.env.GCS_BUCKET}/${actualFilePath}`;

    // Generate a write signed URL via the shared GCS client (handles all credential types)
    const signedUrl = await getWriteSignedUrl(audioUrl, contentType);

    return NextResponse.json({
      uploadUrl: signedUrl,
      audioUrl,
      filePath: actualFilePath,
      speakerLabel,
      fileName: `${languageCode}_${speakerLabel}_${recordingNumber}.${actualExtension}`,
      expiresIn: 15 * 60,
      mode: "gcs",
    });
  } catch (error: any) {
    console.error("Error generating upload URL:", error);
    return NextResponse.json(
      { error: `Failed to generate upload URL: ${error.message}` },
      { status: 500 }
    );
  }
}
