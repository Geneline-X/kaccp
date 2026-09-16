import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { getApprovedDatasetRows } from "@/lib/domain/pipeline/dataset-export";

function isAdmin(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || user.role === "ADMIN";
}

// GET /api/v2/admin/export/corrected — Export approved corrected texts as a dataset.
// Splits the two datasets so they stay clean:
//   source=kaccp (default) — approved KACCP seed transcriptions (clean studio audio, English
//                            prompts present) → TTS
//   source=pilot          — approved Flot pipeline corrections (real-world calls w/ background
//                            noise, no English prompts) → ASR
//   source=all            — merged
// Each row carries the audio path pair plus the English prompt text where available.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json"; // json or csv
    const previewOnly = searchParams.get("preview") === "true";
    const languageId = searchParams.get("languageId") || undefined;
    const source = searchParams.get("source") || "kaccp"; // kaccp | pilot | all

    const exportData = await getApprovedDatasetRows(
      source as any,
      languageId,
      previewOnly ? 10 : undefined,
    );

    if (format === "csv") {
      const csvHeader = "id|audio_path|transcription|english_text|source|duration_sec|speaker_id|speaker_name|language";
      const csvRows = exportData.map((row) =>
        [
          row.id,
          row.audio_path,
          row.transcription,
          row.english_text,
          row.source,
          row.duration_sec ?? "",
          row.speaker_id,
          row.speaker_name,
          row.language,
        ].join("|")
      );
      const csvContent = [csvHeader, ...csvRows].join("\n");

      const filename = source === "pilot" ? `asr_pilot_dataset.csv` : source === "all" ? `combined_tts_asr_dataset.csv` : `tts_kaccp_dataset.csv`;

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=${filename}`,
        },
      });
    }

    return NextResponse.json({
      stats: {
        totalItems: exportData.length,
        kaccpItems: exportData.filter((r) => r.source === "kaccp_transcription").length,
        pilotItems: exportData.filter((r) => r.source !== "kaccp_transcription").length,
      },
      data: exportData,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error exporting corrected texts:", error);
    return NextResponse.json(
      { error: "Failed to export corrected texts" },
      { status: 500 }
    );
  }
}
