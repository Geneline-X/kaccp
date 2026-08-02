import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const CSV_PATH = "./krio_transcripts_progress (2).csv";

const prisma = new PrismaClient();

interface CsvRow {
  filePath: string;
  fileName: string;
  text: string;
  speakerLabel: string;
}

function parseCsv(): CsvRow[] {
  const csv = fs.readFileSync(CSV_PATH, "utf8");
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const header = lines.shift();
  if (!header || !header.includes("audio_filepath,text")) {
    throw new Error(`Unexpected CSV header: ${header}`);
  }

  const rows: CsvRow[] = [];
  for (const line of lines) {
    const idx = line.indexOf(",");
    if (idx < 0) {
      console.warn("Skipping line without comma:", line);
      continue;
    }
    const filePath = line.slice(0, idx).trim();
    const text = line.slice(idx + 1).trim();
    const fileName = path.basename(filePath);
    const speakerMatch = fileName.match(/^(kri_speaker_\d+)_/);
    const speakerLabel = speakerMatch ? speakerMatch[1] : "unknown";
    rows.push({ filePath, fileName, text, speakerLabel });
  }
  return rows;
}

function getAudioFileName(audioUrl: string): string {
  return path.basename(audioUrl);
}

async function main() {
  const dryRun = !process.argv.includes("--execute");
  const rows = parseCsv();

  console.log(`CSV rows: ${rows.length}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "EXECUTE"}`);
  console.log();

  const loadErrorRows = rows.filter((r) => r.text.toUpperCase() === "LOAD_ERROR");
  const validRows = rows.filter((r) => r.text.toUpperCase() !== "LOAD_ERROR");

  console.log(`LOAD_ERROR rows: ${loadErrorRows.length}`);
  console.log(`Valid transcript rows: ${validRows.length}`);
  console.log();

  // Identify all speaker labels present in CSV
  const speakerLabels = Array.from(new Set(validRows.map((r) => r.speakerLabel)));
  console.log(`Speakers in CSV: ${speakerLabels.join(", ")}`);
  console.log("Loading candidate recordings from database...");

  // Fetch all relevant recordings in one query (audioUrl ends with any filename from CSV)
  // We use the filename pattern kri_speaker_XXXXX_YYYYY.wav as the key.
  const recordings = await prisma.recording.findMany({
    where: {
      language: { code: "kri" },
      audioUrl: { contains: "kri_speaker_" },
    },
    include: {
      language: { select: { code: true, name: true } },
      transcription: { select: { id: true, text: true, status: true } },
    },
  });

  console.log(`Loaded ${recordings.length} candidate recordings from DB`);
  console.log();

  // Build filename -> recording map
  const recordingByFileName = new Map<string, typeof recordings[0]>();
  const duplicateFileNames = new Set<string>();
  for (const rec of recordings) {
    const fn = getAudioFileName(rec.audioUrl);
    if (recordingByFileName.has(fn)) {
      duplicateFileNames.add(fn);
    } else {
      recordingByFileName.set(fn, rec);
    }
  }

  // Match CSV rows
  const matches: { row: CsvRow; recording: typeof recordings[0] }[] = [];
  const unmatched: CsvRow[] = [];
  const duplicates: CsvRow[] = [];

  for (const row of validRows) {
    if (duplicateFileNames.has(row.fileName)) {
      duplicates.push(row);
    } else if (recordingByFileName.has(row.fileName)) {
      matches.push({ row, recording: recordingByFileName.get(row.fileName)! });
    } else {
      unmatched.push(row);
    }
  }

  console.log("=== MATCH RESULTS ===");
  console.log(`Matched exactly: ${matches.length}`);
  console.log(`Unmatched: ${unmatched.length}`);
  console.log(`Duplicate filenames in DB: ${duplicates.length}`);
  console.log();

  // Status breakdown of matched recordings
  const statusCounts: Record<string, number> = {};
  const autoTxCounts: Record<string, number> = {};
  let alreadyHasTranscript = 0;
  let alreadyHasHumanTranscription = 0;
  let wouldOverwrite = 0;

  for (const { recording } of matches) {
    statusCounts[recording.status] = (statusCounts[recording.status] || 0) + 1;
    autoTxCounts[recording.autoTranscriptionStatus] =
      (autoTxCounts[recording.autoTranscriptionStatus] || 0) + 1;
    if (recording.transcript) alreadyHasTranscript++;
    if (recording.transcription) alreadyHasHumanTranscription++;
  }
  for (const { row, recording } of matches) {
    if (recording.transcript && recording.transcript !== row.text) {
      wouldOverwrite++;
    }
  }

  console.log("=== CURRENT STATUS OF MATCHED RECORDINGS ===");
  console.log("Recording status:", statusCounts);
  console.log("Auto transcription status:", autoTxCounts);
  console.log(`Already have auto-transcript: ${alreadyHasTranscript}`);
  console.log(`Already have human transcription: ${alreadyHasHumanTranscription}`);
  console.log(`Transcript would change (overwrite): ${wouldOverwrite}`);
  console.log();

  // Speakers
  const speakerCounts: Record<string, number> = {};
  for (const { row } of matches) {
    speakerCounts[row.speakerLabel] = (speakerCounts[row.speakerLabel] || 0) + 1;
  }
  console.log("=== MATCHES BY SPEAKER ===");
  for (const spk of Object.keys(speakerCounts).sort()) {
    console.log(`  ${spk}: ${speakerCounts[spk]}`);
  }
  console.log();

  // Sample matches
  console.log("=== SAMPLE MATCHES ===");
  for (const { row, recording } of matches.slice(0, 5)) {
    console.log(`CSV: ${row.fileName}`);
    console.log(`  DB id: ${recording.id}`);
    console.log(`  audioUrl: ${recording.audioUrl}`);
    console.log(`  status: ${recording.status}, autoTx: ${recording.autoTranscriptionStatus}`);
    console.log(`  existing transcript: ${(recording.transcript || "").slice(0, 60)}`);
    console.log(`  new transcript: ${row.text.slice(0, 60)}`);
    console.log();
  }

  // Sample unmatched
  if (unmatched.length > 0) {
    console.log("=== SAMPLE UNMATCHED ===");
    for (const row of unmatched.slice(0, 10)) {
      console.log(`  ${row.fileName}`);
    }
    console.log();
  }

  if (duplicates.length > 0) {
    console.log("=== SAMPLE DUPLICATES ===");
    for (const row of duplicates.slice(0, 5)) {
      console.log(`  ${row.fileName}`);
    }
    console.log();
  }

  // Status change analysis (for reporting)
  const statusChangeCounts: Record<string, number> = {};
  for (const { recording } of matches) {
    if (recording.transcription) continue; // do not reset recordings that already have human work
    if (recording.status === "PENDING_TRANSCRIPTION") continue;
    if (recording.status === "REJECTED") continue; // audio was rejected, keep it out of queue
    const key = `${recording.status} → PENDING_TRANSCRIPTION`;
    statusChangeCounts[key] = (statusChangeCounts[key] || 0) + 1;
  }

  console.log("=== STATUS CHANGES (dry-run preview) ===");
  if (Object.keys(statusChangeCounts).length === 0) {
    console.log("No status changes needed.");
  } else {
    for (const [key, count] of Object.entries(statusChangeCounts)) {
      console.log(`  ${key}: ${count}`);
    }
  }
  console.log();

  // Execute if requested
  if (!dryRun) {
    console.log("=== EXECUTING IMPORT ===");
    let updated = 0;
    let skipped = 0;
    let statusChanged = 0;
    let total = matches.length;
    const reportEvery = 100;

    for (let i = 0; i < matches.length; i++) {
      const { row, recording } = matches[i];

      const needsTranscript =
        recording.transcript !== row.text ||
        recording.autoTranscriptionStatus !== "COMPLETED";

      // Only send back to transcription queue if no human transcription exists yet
      // and the recording is not permanently rejected.
      const canResetStatus =
        !recording.transcription &&
        recording.status !== "PENDING_TRANSCRIPTION" &&
        recording.status !== "REJECTED";

      if (!needsTranscript && !canResetStatus) {
        skipped++;
        continue;
      }

      const updateData: any = {};
      if (needsTranscript) {
        updateData.transcript = row.text;
        updateData.autoTranscriptionStatus = "COMPLETED";
        updateData.autoTranscribedAt = new Date();
        updateData.transcriptMetadata = {
          source: "csv_import",
          filename: row.fileName,
          originalText: row.text,
          importedAt: new Date().toISOString(),
        };
      }
      if (canResetStatus) {
        updateData.status = "PENDING_TRANSCRIPTION";
        statusChanged++;
      }

      await prisma.recording.update({
        where: { id: recording.id },
        data: updateData,
      });
      updated++;
      if ((i + 1) % reportEvery === 0) {
        console.log(`  Progress: ${i + 1}/${total} (${Math.round(((i + 1) / total) * 100)}%)`);
      }
    }
    console.log(`Updated: ${updated}`);
    console.log(`Status reset to PENDING_TRANSCRIPTION: ${statusChanged}`);
    console.log(`Skipped (already up to date): ${skipped}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
