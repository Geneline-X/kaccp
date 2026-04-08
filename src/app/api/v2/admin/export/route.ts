import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

// GET /api/v2/admin/export - Export reviewed recordings in LJSpeech format
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
    const previewOnly = searchParams.get("preview") === "true";

    if (!languageId) {
      return NextResponse.json(
        { error: "languageId is required" },
        { status: 400 }
      );
    }

    // Get language info
    const language = await prisma.language.findUnique({
      where: { id: languageId },
      include: { country: true },
    });

    if (!language) {
      return NextResponse.json(
        { error: "Language not found" },
        { status: 404 }
      );
    }

    // Audio-reviewed recordings are in PENDING_TRANSCRIPTION, TRANSCRIBED, or APPROVED status
    const where: any = {
      languageId,
      status: { in: ["PENDING_TRANSCRIPTION", "TRANSCRIBED", "APPROVED"] },
    };
    if (speakerId) where.speakerId = speakerId;
    if (includeTranscriptions) where.transcription = { status: "APPROVED" };

    // Fetch recordings, count, total duration, and distinct speakers
    const [recordings, total, durationAgg, distinctSpeakers] = await Promise.all([
      prisma.recording.findMany({
        where,
        include: {
          transcription: true,
          speaker: {
            select: { id: true, displayName: true, speakerLabel: true },
          },
          prompt: {
            select: { englishText: true, category: true },
          },
        },
        orderBy: { createdAt: "asc" },
        // For preview, only fetch first 10; for download, fetch everything
        ...(previewOnly ? { take: 10 } : {}),
      }),
      prisma.recording.count({ where }),
      prisma.recording.aggregate({
        where,
        _sum: { durationSec: true },
        _count: { speakerId: true },
      }),
      prisma.recording.findMany({
        where: { languageId },
        select: { speaker: { select: { id: true, displayName: true, speakerLabel: true } } },
        distinct: ["speakerId"],
      }),
    ]);

    const totalDurationSec = durationAgg._sum.durationSec || 0;

    // Track per-speaker recording index for LJSpeech IDs
    const speakerCounters = new Map<string, number>();

    const exportData = recordings.map((rec) => {
      const count = (speakerCounters.get(rec.speakerId) || 0) + 1;
      speakerCounters.set(rec.speakerId, count);

      const ljId = `${language.code.toUpperCase()}_${rec.speakerId}_${String(count).padStart(5, "0")}`;

      const base: any = {
        id: ljId,
        audio_file: rec.audioUrl,
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
    });

    // LJSpeech CSV: id|audio_path|text (3 columns)
    // Without transcriptions: id|audio_path|english_prompt|duration_sec|speaker_id|speaker_name|category
    if (format === "csv") {
      let csvContent: string;

      if (includeTranscriptions) {
        // True LJSpeech format: id|audio_path|transcription
        const csvHeader = "id|audio_path|transcription";
        const csvRows = exportData.map((row) =>
          `${row.id}|${row.audio_file}|${row.transcription}`
        );
        csvContent = [csvHeader, ...csvRows].join("\n");
      } else {
        // Full metadata format when no transcriptions
        const csvHeader = "id|audio_path|english_prompt|duration_sec|speaker_id|speaker_name|category";
        const csvRows = exportData.map((row) =>
          `${row.id}|${row.audio_file}|${row.english_prompt}|${row.duration_sec}|${row.speaker_id}|${row.speaker_name}|${row.category}`
        );
        csvContent = [csvHeader, ...csvRows].join("\n");
      }

      const filename = `${language.country.code.toLowerCase()}_${language.code}_metadata.csv`;

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=${filename}`,
        },
      });
    }

    // Count unique speakers from the full dataset via a separate query
    const uniqueSpeakerCount = await prisma.recording.findMany({
      where,
      select: { speakerId: true },
      distinct: ["speakerId"],
    });

    return NextResponse.json({
      language: { code: language.code, name: language.name, country: language.country.name },
      stats: {
        totalRecordings: total,
        totalDurationSec,
        totalDurationHours: Math.round((totalDurationSec / 3600) * 100) / 100,
        uniqueSpeakers: uniqueSpeakerCount.length,
      },
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

    const language = await prisma.language.findUnique({
      where: { id: languageId },
    });

    if (!language) {
      return NextResponse.json(
        { error: "Language not found" },
        { status: 404 }
      );
    }

    // Get reviewed recordings not yet exported
    const recordings = await prisma.recording.findMany({
      where: {
        languageId,
        status: { in: ["PENDING_TRANSCRIPTION", "TRANSCRIBED", "APPROVED"] },
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
