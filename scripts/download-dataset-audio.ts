/* Download the audio files referenced by an exported KACCP dataset CSV into a
 * local LJSpeech-style layout so preprocessing can read them.
 *
 * Reads the CSV produced by the Language Lead export
 * (GET /api/v2/admin/export/corrected?format=csv) — pipe-delimited with an
 * `audio_path` column (e.g. gs://bucket/pipeline/gateway/2026-06-27/<id>.wav).
 *
 * Usage:
 *   npx tsx scripts/download-dataset-audio.ts --csv=./tts_kaccp_dataset.csv [--out=./wavs] [--meta=./metadata.csv] [--language=kri] [--zip=./krio-audio.zip] [--max=100] [--parallel=8]
 *
 * --language filters rows by the CSV `language` column (e.g. kri keeps Krio
 *   transcriptions only and drops PILOT rows; omit for everything).
 * --zip writes a single archive (wavs/ + metadata.csv) ready for Drive upload.
 *
 * It also writes a normalized metadata.csv: id|wav_path|transcription|english_text|source|duration_sec|speaker_id|speaker_name|language
 */
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { createRequire } from "module";
import { getStorageProvider } from "../src/lib/infra/storage";

interface Row {
  columns: Record<string, string>;
  raw: string;
  line: number;
}

const DEFAULT_OUT_DIR = "wavs";
const DEFAULT_META_FILE = "metadata.csv";

const nodeRequire = createRequire(path.join(process.cwd(), "package.json"));

function boolFlag(args: string[], name: string): boolean {
  return args.some((a) => a === `--${name}`);
}

function stringFlag(args: string[], name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const match = args.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function loadDotEnv(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const match of content.matchAll(/^([A-Z_][A-Z0-9_]*)\s*=(.*)$/gm)) {
    const key = match[1];
    if (!process.env[key]) {
      let value = match[2].replace(/^\s+|\s+$/g, "").replace(/^'|'$/g, "");
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[key] = value;
    }
  }
}

function parsePipedCsv(filePath: string): { header: string[]; rows: Row[] } {
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length === 0) throw new Error("CSV is empty");
  const header = lines.shift()!.split("|");
  const rows: Row[] = [];
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split("|");
    const lineNo = i + 2; // 1-based, accounting for header
    if (parts.length < header.length) {
      console.warn(`[line ${lineNo}] Skipping row with ${parts.length} columns (expected ${header.length}): ${lines[i].slice(0, 80)}`);
      continue;
    }
    if (parts.length > header.length) {
      // The transcription text may contain `|`; merge the excess back into it.
      const excess = parts.splice(header.length - 1);
      parts[header.length - 1] = excess.join("|");
    }
    const columns: Record<string, string> = {};
    header.forEach((h, idx) => (columns[h] = (parts[idx] ?? "").trim()));
    rows.push({ columns, raw: lines[i], line: lineNo });
  }
  return { header, rows };
}

function parseGsUri(uri: string): { bucket: string; object: string } {
  if (uri.startsWith("https://storage.googleapis.com/")) {
    const rest = uri.slice("https://storage.googleapis.com/".length);
    const slash = rest.indexOf("/");
    return slash >= 0
      ? { bucket: rest.slice(0, slash), object: rest.slice(slash + 1) }
      : { bucket: rest, object: "" };
  }
  if (uri.startsWith("gs://")) {
    const rest = uri.slice("gs://".length);
    const slash = rest.indexOf("/");
    return slash >= 0
      ? { bucket: rest.slice(0, slash), object: rest.slice(slash + 1) }
      : { bucket: rest, object: "" };
  }
  if (uri.startsWith("local://") || uri.startsWith("/uploads/")) {
    return { bucket: "local", object: uri };
  }
  throw new Error(`Unsupported audio path: ${uri}`);
}

function localObjectPath(uri: string): string {
  const key = uri.startsWith("local://")
    ? uri.slice("local://".length)
    : uri.startsWith("/uploads/")
      ? uri.replace(/^\/+/, "")
      : uri;
  const root = process.env.LOCAL_STORAGE_ROOT || path.join(process.cwd(), ".local-storage");
  return path.join(root, key);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Resolve an ffmpeg binary: prefer the bundled ffmpeg-static, fall back to a
// system "ffmpeg" on PATH.
function resolveFfmpeg(): string {
  try {
    const bundled = nodeRequire("ffmpeg-static") as string | null;
    if (bundled && fs.existsSync(bundled)) return bundled;
  } catch {
    // ffmpeg-static not installed — fall through to PATH lookup
  }
  // PATH lookup is done lazily at convert time via spawn error handling.
  return "ffmpeg";
}

function convertToWav(ffmpegBin: string, input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin, ["-y", "-i", input, output], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("error", (e: NodeJS.ErrnoException) => {
      if ((e as any).code === "ENOENT") reject(new Error("ffmpeg not found on PATH (install ffmpeg or npm i -D ffmpeg-static)"));
      else reject(e);
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(0, 300)}`));
    });
  });
}

async function main() {
  loadDotEnv(path.join(process.cwd(), ".env"));

  const args = process.argv.slice(2);
  const csvPath = stringFlag(args, "csv");
  if (!csvPath) {
    console.error("Missing required flag: --csv=<path to exported CSV>");
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${path.resolve(csvPath)}`);
    console.error("");
    console.error("The CSV is downloaded from the Language Lead page in the app:");
    console.error("  1) open /admin/v2/pipeline/language-lead");
    console.error("  2) pick the language (Krio) and click one of the 'Export ...' buttons");
    console.error("  3) find the downloaded file (usually in your Downloads folder)");
    console.error("  4) pass that path here, e.g.:");
    console.error('     npm run download:audios -- --csv="<path-to-downloaded-csv>" --language=kri --zip="./krio-audio.zip"');
    process.exit(1);
  }

  const zipOut = stringFlag(args, "zip");
  // Keep the repo clean: when a --zip path is given, put wavs/ and metadata.csv
  // in the same folder as the zip (anywhere you like), unless overridden.
  const zipDir = zipOut ? path.dirname(path.resolve(zipOut)) : undefined;
  const outDir = stringFlag(args, "out") || (zipDir ? path.join(zipDir, "wavs") : DEFAULT_OUT_DIR);
  const metaFile = stringFlag(args, "meta") || (zipDir ? path.join(zipDir, "metadata.csv") : DEFAULT_META_FILE);
  const languageFilter = stringFlag(args, "language")?.toLowerCase();
  const max = parseInt(stringFlag(args, "max", "") || "", 10);
  const parallel = Math.max(1, parseInt(stringFlag(args, "parallel", "8") || "8", 10));
  const dryRun = boolFlag(args, "dry-run");

  const provider = getStorageProvider();
  const { header, rows } = parsePipedCsv(csvPath);
  const relBase = path.dirname(path.resolve(metaFile));
  console.log(`CSV: ${csvPath}`);
  console.log(`Rows: ${rows.length}`);
  console.log(`Language filter: ${languageFilter ?? "(all)"} [uses CSV 'language' column, e.g. kri | PILOT]`);
  console.log(`Columns: ${header.join(" | ")}`);
  console.log(`Output dir: ${outDir}`);
  console.log(`Dry run: ${dryRun ? "yes" : "no"}`);
  console.log("");

  if (!header.includes("audio_path") && !header.includes("audio_file")) {
    console.error('CSV has no "audio_path" column. Columns found: ' + header.join(", "));
    process.exit(1);
  }
  const pathKey = header.includes("audio_path") ? "audio_path" : "audio_file";
  const idKey = header.includes("id") ? "id" : "recording_id";

  const filtered = languageFilter
    ? rows.filter((r) => (r.columns.language || "").trim().toLowerCase() === languageFilter)
    : rows;
  console.log(`Rows after language filter: ${filtered.length}`);
  const targets = filtered.slice(0, max && max > 0 ? max : undefined);
  const valid: Row[] = [];
  const invalid: { row: Row; error: string }[] = [];
  for (const row of targets) {
    const uri = row.columns[pathKey];
    if (!uri) {
      invalid.push({ row, error: "empty audio_path" });
      continue;
    }
    try {
      parseGsUri(uri);
      valid.push(row);
    } catch (e: any) {
      invalid.push({ row, error: e.message });
    }
  }
  console.log(`Valid audio paths: ${valid.length}`);
  console.log(`Invalid / empty: ${invalid.length}`);
  if (invalid.length > 0) {
    for (const { row, error } of invalid.slice(0, 10)) {
      console.warn(`  [line ${row.line}] ${error} -> ${row.raw.slice(0, 100)}`);
    }
  }
  console.log("");

  await fs.promises.mkdir(outDir, { recursive: true });

  const results = new Map<string, "downloaded" | "skipped" | "failed">();
  const failedByPath = new Map<string, string>();
  const downloadedMeta: string[] = [];
  let index = 0;

  async function worker() {
    while (true) {
      const i = index++;
      if (i >= valid.length) break;
      const row = valid[i];
      const uri = row.columns[pathKey];
      const id = row.columns[idKey] || `item_${String(i + 1).padStart(5, "0")}`;
      const parsed = parseGsUri(uri);
      const srcExt = parsed.object.includes(".") ? path.extname(parsed.object).toLowerCase() : ".wav";
      const outPath = path.join(outDir, `${id}.wav`);
      const displayPath = path.relative(relBase, path.resolve(outPath)).split(path.sep).join("/") || path.basename(outPath);
      const recordingId = row.columns.recording_id ?? row.columns.id ?? "";

      if (dryRun) {
        results.set(uri, "downloaded");
        downloadedMeta.push([id, displayPath, recordingId, row.columns.transcription ?? "", row.columns.english_text ?? "", row.columns.source ?? "", row.columns.duration_sec ?? "", row.columns.speaker_id ?? "", row.columns.speaker_name ?? "", row.columns.language ?? ""].join("|"));
        if ((i + 1) % 200 === 0) console.log(`  dry-run processed ${i + 1}/${valid.length}`);
        continue;
      }

      try {
        if (await fileExists(outPath)) {
          results.set(uri, "skipped");
          downloadedMeta.push([id, displayPath, recordingId, row.columns.transcription ?? "", row.columns.english_text ?? "", row.columns.source ?? "", row.columns.duration_sec ?? "", row.columns.speaker_id ?? "", row.columns.speaker_name ?? "", row.columns.language ?? ""].join("|"));
          if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${valid.length} (skip: ${displayPath})`);
          continue;
        }

        let buffer: Buffer;
        if (parsed.bucket === "local") {
          buffer = await fs.promises.readFile(localObjectPath(uri));
        } else {
          buffer = await provider.downloadBuffer(uri);
        }

        if (srcExt === ".wav") {
          await fs.promises.writeFile(outPath, buffer);
        } else {
          // Convert non-wav (e.g. webm) to wav via ffmpeg for LJSpeech-style preprocessing.
          const tmpPath = path.join(outDir, `.${id}${srcExt}.tmp`);
          await fs.promises.writeFile(tmpPath, buffer);
          try {
            const ffmpegBin = resolveFfmpeg();
            await convertToWav(ffmpegBin, tmpPath, outPath);
          } finally {
            await fs.promises.rm(tmpPath, { force: true }).catch(() => {});
          }
        }
        results.set(uri, "downloaded");
        downloadedMeta.push([id, displayPath, recordingId, row.columns.transcription ?? "", row.columns.english_text ?? "", row.columns.source ?? "", row.columns.duration_sec ?? "", row.columns.speaker_id ?? "", row.columns.speaker_name ?? "", row.columns.language ?? ""].join("|"));
        if ((i + 1) % 50 === 0) {
          console.log(`  ${i + 1}/${valid.length} (${results.get(uri)}: ${displayPath})`);
        }
      } catch (e: any) {
        results.set(uri, "failed");
        failedByPath.set(uri, e?.message || String(e));
        console.warn(`  [fail] ${displayPath}: ${e?.message || e}`);
      }
    }
  }

  if (!dryRun) {
    const workers = Array.from({ length: parallel }, () => worker());
    await Promise.all(workers);
  }

  const downloaded = Array.from(results.values()).filter((r) => r === "downloaded").length;
  const skipped = Array.from(results.values()).filter((r) => r === "skipped").length;
  const failed = Array.from(results.values()).filter((r) => r === "failed").length;

  console.log("");
  console.log("=== SUMMARY ===");
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Already present: ${skipped}`);
  console.log(`Failed: ${failed}`);

  const metaHeader = "id|wav_path|recording_id|transcription|english_text|source|duration_sec|speaker_id|speaker_name|language";
  if (!dryRun) {
    await fs.promises.writeFile(metaFile, [metaHeader, ...downloadedMeta].join("\n"), "utf8");
    console.log(`Metadata written to: ${metaFile} (${downloadedMeta.length} rows)`);
  }

  if (failedByPath.size > 0) {
    const failedFile = path.join(path.dirname(metaFile), "failed_paths.txt");
    await fs.promises.writeFile(failedFile, [...failedByPath.entries()].map(([p, e]) => `${p}\t${e}`).join("\n"), "utf8");
    console.log(`Failed paths written to: ${failedFile}`);
  }

  if (zipOut && !dryRun) {
    await zipDirectory(outDir, metaFile, zipOut);
  }

  if (failed > 0) {
    process.exitCode = 2;
  }
}

async function zipDirectory(dirPath: string, metaPath: string, zipPath: string): Promise<void> {
  const { ZipArchive } = await import("archiver");
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const output = fs.createWriteStream(zipPath);
  archive.pipe(output);
  const meta = path.basename(metaPath);
  archive.file(metaPath, { name: meta });
  archive.directory(dirPath, "wavs");
  await new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
    archive.finalize();
  });
  console.log(`Zip written to: ${zipPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});