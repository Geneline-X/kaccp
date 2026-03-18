import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { getSignedUrl } from "@/lib/infra/gcs";

// GET /api/v2/admin/export - Export approved data in LJSpeech format
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || (!((user as any).roles || []).includes("ADMIN") && user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const languageId = searchParams.get("languageId");
    const speakerId = searchParams.get("speakerId");
    const includeTranscriptions = searchParams.get("includeTranscriptions") !== "false";
    const format = searchParams.get("format") || "json"; // json or csv
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "500");
    const skip = (page - 1) * limit;
    const signUrls = searchParams.get("signUrls") !== "false";

    if (!languageId) {
      return NextResponse.json(
        { error: "languageId is required" },
        { status: 400 }
      );
    }

    // Get language info
    const language = await prisma.language.findUnique({
      where: { id: languageId },
      include: {
        country: true,
      },
    });

    if (!language) {
      return NextResponse.json(
        { error: "Language not found" },
        { status: 404 }
      );
    }

    // Build where clause based on filters
    const where: any = {
      languageId,
      status: "APPROVED",
    };
    if (speakerId) where.speakerId = speakerId;
    if (includeTranscriptions) where.transcription = { status: "APPROVED" };

    // Fetch distinct speakers for this language (for filter dropdown)
    const [recordings, total, distinctSpeakers] = await Promise.all([
      prisma.recording.findMany({
        where,
        include: {
          transcription: true,
          speaker: {
            select: {
              id: true,
              displayName: true,
            },
          },
          prompt: {
            select: {
              englishText: true,
              category: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.recording.count({ where }),
      prisma.recording.findMany({
        where: { languageId, status: "APPROVED" },
        select: { speaker: { select: { id: true, displayName: true } } },
        distinct: ["speakerId"],
      }),
    ]);

    if (recordings.length === 0 && page === 1) {
      return NextResponse.json(
        { error: "No approved recordings found for this language" },
        { status: 404 }
      );
    }

    // Format data for LJSpeech-style export
    const exportData = await Promise.all(
      recordings.map(async (rec, index) => {
        // Generate LJSpeech-style ID: LANG_SPEAKER_INDEX
        const speakerShort = rec.speaker.id.slice(-6);
        const ljId = `${language.code.toUpperCase()}_${speakerShort}_${String(skip + index + 1).padStart(5, "0")}`;

        let audioFile = rec.audioUrl;
        if (signUrls && rec.audioUrl.startsWith("gs://")) {
          try {
            audioFile = await getSignedUrl(rec.audioUrl, 7 * 24 * 3600); // 7-day signed URL
          } catch {
            // fallback to gs:// if signing fails
          }
        }

        const base: any = {
          id: ljId,
          audio_file: audioFile,
          english_prompt: rec.prompt.englishText,
          category: rec.prompt.category,
          duration_sec: rec.durationSec,
          speaker_id: rec.speakerId,
          speaker_name: rec.speaker.displayName || rec.speakerId,
          recording_id: rec.id,
        };
        if (includeTranscriptions) {
          base.transcription = rec.transcription?.text || "";
        }
        return base;
      })
    );

    if (format === "csv") {
      const csvHeader = includeTranscriptions
        ? "id|audio_path|transcription|english_prompt|duration_sec|speaker_id|speaker_name|category"
        : "id|audio_path|english_prompt|duration_sec|speaker_id|speaker_name|category";
      const csvRows = exportData.map((row) =>
        includeTranscriptions
          ? `${row.id}|${row.audio_file}|${row.transcription}|${row.english_prompt}|${row.duration_sec}|${row.speaker_id}|${row.speaker_name}|${row.category}`
          : `${row.id}|${row.audio_file}|${row.english_prompt}|${row.duration_sec}|${row.speaker_id}|${row.speaker_name}|${row.category}`
      );
      const csvContent = [csvHeader, ...csvRows].join("\n");

      // Filename includes language code and country
      const filename = `${language.country.code.toLowerCase()}_${language.code}_metadata.csv`;

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=${filename}`,
        },
      });
    }

    // Return JSON with full data
    return NextResponse.json({
      language: { code: language.code, name: language.name, country: language.country.name },
      stats: {
        totalRecordings: total,
        totalDurationSec: recordings.reduce((sum, r) => sum + r.durationSec, 0),
        totalDurationHours: Math.round((recordings.reduce((sum, r) => sum + r.durationSec, 0) / 3600) * 100) / 100,
        uniqueSpeakers: new Set(recordings.map((r) => r.speakerId)).size,
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      speakers: distinctSpeakers.map((r) => r.speaker).filter(Boolean),
      data: exportData,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error exporting data:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}

// POST /api/v2/admin/export - Create export record and prepare download
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || (!((user as any).roles || []).includes("ADMIN") && user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { languageId } = body;

    if (!languageId) {
      return NextResponse.json(
        { error: "languageId is required" },
        { status: 400 }
      );
    }

    // Get language
    const language = await prisma.language.findUnique({
      where: { id: languageId },
    });

    if (!language) {
      return NextResponse.json(
        { error: "Language not found" },
        { status: 404 }
      );
    }

    // Get approved recordings not yet exported
    const recordings = await prisma.recording.findMany({
      where: {
        languageId,
        status: "APPROVED",
        transcription: {
          status: "APPROVED",
        },
        // Not already in export records
        NOT: {
          id: {
            in: (
              await prisma.exportRecord.findMany({
                where: { languageId },
                select: { recordingId: true },
              })
            ).map((e) => e.recordingId),
          },
        },
      },
      include: {
        transcription: true,
      },
    });

    if (recordings.length === 0) {
      return NextResponse.json({
        message: "No new recordings to export",
        newRecordings: 0,
      });
    }

    // Create export records
    const exportRecords = await prisma.exportRecord.createMany({
      data: recordings.map((rec) => ({
        languageId,
        languageCode: language.code,
        recordingId: rec.id,
        audioPath: rec.audioUrl,
        transcription: rec.transcription?.text || "",
        durationSec: rec.durationSec,
        speakerId: rec.speakerId,
      })),
    });

    return NextResponse.json({
      success: true,
      newRecordings: exportRecords.count,
      message: `${exportRecords.count} recordings marked for export`,
    });
  } catch (error) {
    console.error("Error creating export:", error);
    return NextResponse.json(
      { error: "Failed to create export" },
      { status: 500 }
    );
  }
}
