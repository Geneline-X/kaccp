import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

// POST /api/v2/speaker/upload-local - Local file upload for development
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }

    // Get the audio data from the request body
    const audioData = await req.arrayBuffer();

    // Create the uploads directory structure
    const uploadDir = join(process.cwd(), "public", "uploads");
    const fullPath = join(uploadDir, filePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));

    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, Buffer.from(audioData));

    return NextResponse.json({
      success: true,
      path: `/uploads/${filePath}`,
    });
  } catch (error: any) {
    console.error("Error uploading file locally:", error);
    return NextResponse.json(
      { error: `Failed to upload file: ${error.message}` },
      { status: 500 }
    );
  }
}

// Also support PUT for compatibility with GCS signed URL pattern
export async function PUT(req: NextRequest) {
  return POST(req);
}
