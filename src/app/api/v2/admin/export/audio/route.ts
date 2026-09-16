import { NextRequest, NextResponse } from "next/server";
import { PassThrough, Readable } from "stream";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { downloadBuffer } from "@/lib/infra/gcs";
import { getApprovedDatasetRows } from "@/lib/domain/pipeline/dataset-export";

function isAdmin(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || user.role === "ADMIN";
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/v2/admin/export/audio?source=kaccp&languageId=<id>
// Streams a ZIP of the approved corrected dataset's audio as .wav files
// (LJSpeech-style layout: metadata.csv + wavs/<id>.wav).
// Non-wav sources (e.g. the occasional webm upload) are skipped and listed in
// skipped_non_wav.txt — run scripts/download-dataset-audio.ts to fetch those and
// convert them locally.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source") || "kaccp"; // kaccp | pilot | all
    const languageId = searchParams.get("languageId") || undefined;

    const rows = await getApprovedDatasetRows(source as any, languageId);
    if (rows.length === 0) {
      return NextResponse.json({ error: "No approved items to export" }, { status: 404 });
    }

    const { ZipArchive } = await import("archiver");
    const stream = new PassThrough();
    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.pipe(stream);

    const metaHeader = "id|wav_path|transcription|english_text|source|duration_sec|speaker_id|speaker_name|language";
    const includedRows: string[] = [];
    const skippedAudio: string[] = [];
    const failedAudio: string[] = [];

    for (const row of rows) {
      const uri = String(row.audio_path || "");
      const id = String(row.id || "");
      const extMatch = uri.match(/\.([a-z0-9]+)$/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : "";
      if (ext !== "wav") {
        skippedAudio.push(`${id}\t${uri}`);
        continue;
      }
      try {
        const buffer = await downloadBuffer(uri);
        archive.append(buffer, { name: `wavs/${id}.wav` });
        includedRows.push(
          [
            id,
            `wavs/${id}.wav`,
            row.transcription ?? "",
            row.english_text ?? "",
            row.source ?? "",
            row.duration_sec ?? "",
            row.speaker_id ?? "",
            row.speaker_name ?? "",
            row.language ?? "",
          ].join("|")
        );
      } catch (e: any) {
        failedAudio.push(`${id}\t${uri}\t${e?.message || e}`);
      }
    }

    archive.append([metaHeader, ...includedRows].join("\n"), { name: "metadata.csv" });

    if (skippedAudio.length > 0) {
      archive.append(skippedAudio.join("\n"), { name: "skipped_non_wav.txt" });
    }
    if (failedAudio.length > 0) {
      archive.append(failedAudio.join("\n"), { name: "failed.txt" });
    }

    archive.append(
      [
        "KACCP audio export",
        `- ${includedRows.length} wav audio files included`,
        skippedAudio.length ? `- ${skippedAudio.length} non-wav sources skipped (see skipped_non_wav.txt)` : "- no non-wav sources",
        failedAudio.length ? `- ${failedAudio.length} downloads failed (see failed.txt)` : "- no download failures",
        "",
        "To fetch the skipped/non-wav items and convert them to wav:",
        "  npx tsx scripts/download-dataset-audio.ts --csv=<corrected_export.csv> --language=kri --zip=out.zip",
      ].join("\n"),
      { name: "README.txt" }
    );

    await archive.finalize();

    const base = source === "pilot" ? "asr_pilot_dataset" : source === "all" ? "combined_tts_asr_dataset" : "tts_kaccp_dataset";
    const filename = `${base}_audio.zip`;

    return new NextResponse(Readable.toWeb(stream) as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (error) {
    console.error("Error exporting audio:", error);
    return NextResponse.json(
      { error: "Failed to export audio" },
      { status: 500 }
    );
  }
}