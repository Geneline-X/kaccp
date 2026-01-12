import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// Lazy initialize GCS to avoid errors when not configured
let storage: any = null;
let bucket: any = null;

function initGCS() {
  if (!storage && process.env.GCS_SERVICE_ACCOUNT_JSON && process.env.GCS_BUCKET) {
    try {
      const { Storage } = require("@google-cloud/storage");
      storage = new Storage({
        credentials: JSON.parse(process.env.GCS_SERVICE_ACCOUNT_JSON),
      });
      bucket = storage.bucket(process.env.GCS_BUCKET);
    } catch (e) {
      console.error("Failed to initialize GCS:", e);
    }
  }
  return { storage, bucket };
}

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

    // Get prompt to determine language and country
    const prompt = await prisma.prompt.findUnique({
      where: { id: promptId },
      include: {
        language: {
          include: {
            country: true,
          },
        },
      },
    });

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    // Initialize GCS
    const { bucket: gcsBucket } = initGCS();

    // Get speaker number for labeling (e.g., speaker_0001)
    // Count how many speakers exist before this user to generate sequential ID
    const speakerCount = await prisma.user.count({
      where: {
        role: "SPEAKER",
        createdAt: { lte: user.createdAt },
      },
    });
    const speakerLabel = `speaker_${String(speakerCount).padStart(4, "0")}`;

    // Count recordings by this speaker for this language to generate sequential recording number
    const targetLanguageId = prompt.languageId || languageId;
    const recordingCount = await prisma.recording.count({
      where: {
        speakerId: user.id,
        ...(targetLanguageId ? { languageId: targetLanguageId } : {}),
      },
    });
    const recordingNumber = String(recordingCount + 1).padStart(5, "0");

    // For universal prompts (no language), use a default structure
    // For language-specific prompts, use the language/country structure
    let countryCode = "universal";
    let languageCode = "universal";

    if (prompt.language) {
      countryCode = prompt.language.country.code.toLowerCase();
      languageCode = prompt.language.code.toLowerCase();
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

    // If GCS is not configured, use local storage fallback
    if (!gcsBucket) {
      console.warn("GCS not configured, using local storage mode");
      const audioUrl = `/uploads/${actualFilePath}`;
      return NextResponse.json({
        uploadUrl: `/api/v2/speaker/upload-local?path=${encodeURIComponent(actualFilePath)}`,
        audioUrl,
        filePath: actualFilePath,
        speakerLabel,
        fileName: `${languageCode}_${speakerLabel}_${recordingNumber}.${actualExtension}`,
        expiresIn: 15 * 60,
        mode: "local",
      });
    }

    // Generate signed URL for upload (valid for 15 minutes)
    const [signedUrl] = await gcsBucket.file(actualFilePath).getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
    });

    // Full GCS URL for the file
    const audioUrl = `gs://${process.env.GCS_BUCKET}/${actualFilePath}`;

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
