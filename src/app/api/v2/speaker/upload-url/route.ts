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
    const { promptId, contentType = "audio/wav" } = body;

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

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const extension = contentType === "audio/wav" ? "wav" : "webm";
    
    // Path: {country}/{language}/recordings/{speakerId}/{timestamp}_{randomId}.wav
    const countryCode = prompt.language.country.code.toLowerCase();
    const languageCode = prompt.language.code.toLowerCase();
    const filePath = `${countryCode}/${languageCode}/recordings/${user.id}/${timestamp}_${randomId}.${extension}`;

    // If GCS is not configured, use local storage fallback
    if (!gcsBucket) {
      console.warn("GCS not configured, using local storage mode");
      // Return a mock URL for development - audio will be uploaded via /api/v2/speaker/upload-local
      const audioUrl = `/uploads/${filePath}`;
      return NextResponse.json({
        uploadUrl: `/api/v2/speaker/upload-local?path=${encodeURIComponent(filePath)}`,
        audioUrl,
        filePath,
        expiresIn: 15 * 60,
        mode: "local",
      });
    }

    // Generate signed URL for upload (valid for 15 minutes)
    const [signedUrl] = await gcsBucket.file(filePath).getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
    });

    // Full GCS URL for the file
    const audioUrl = `gs://${process.env.GCS_BUCKET}/${filePath}`;

    return NextResponse.json({
      uploadUrl: signedUrl,
      audioUrl,
      filePath,
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
