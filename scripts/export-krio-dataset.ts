/* Export the Krio dataset as a training CSV that points at the audio already on
 * Google Drive.
 *
 *   audio_filepath,speaker_id,text,eng_text
 *   /content/drive/MyDrive/krio/jojo/recordings/kri_speaker_0017_02826.wav,kri_speaker_0017,<krio>,<english>
 *
 * Why the --drive-csv flag: the Drive layout is
 *   /content/drive/MyDrive/krio/<batch folder>/recordings/<file>.wav
 * and <batch folder> is the annotator who processed the batch (jojo, richard,
 * "Fatmata Binta Kamara") — not the speaker, and not stored anywhere in the
 * database. The progress CSVs that shipped with the Drive upload are the only
 * record of it, so they are read here purely to resolve paths. Nothing is written
 * back to the database.
 *
 * The English column comes from the prompt bank (Prompt.englishText, the sentence
 * the speaker was asked to say). The Krio column prefers a reviewer-approved
 * Transcription and falls back to the imported transcript.
 *
 * speaker_id comes from the speaker's User account, not from the .wav filename.
 * Some speakers were re-labelled partway through collection, so one person shows
 * up under two filename prefixes (kri_speaker_0017 and kri_speaker_0018 are both
 * Josephine A Nyango; 0014 and 0015 are both Richard Pambu). Keying off the
 * account keeps one id per person. Pass --speaker-id=filename for the old behaviour.
 *
 * Usage:
 *   npx tsx scripts/export-krio-dataset.ts \
 *     --drive-csv="C:/Users/omen/Downloads/krio_transcripts_progress (3).csv" \
 *     --out=./krio_dataset.csv
 *
 * Flags:
 *   --drive-csv=<file>  CSV containing /content/drive/... paths. Repeatable. Required
 *                       unless the batch folder can be inferred for every file.
 *   --out=<file>        Output path (default ./krio_dataset.csv)
 *   --language=<code>   Language code (default kri)
 *   --text=<mode>       approved | imported | any   (default any)
 *                         approved — reviewer-approved transcriptions only
 *                         imported — CSV/auto-imported transcripts only
 *                         any      — approved first, fall back to imported
 *   --require-text      Drop rows with no Krio text (default: keep them, blank text)
 *   --speaker-id=<src>  account | filename   (default account)
 *   --allow-inferred-paths  Also emit recordings whose path is absent from every
 *                          --drive-csv, building the path from the speaker's batch
 *                          folder. OFF by default: the progress CSVs only list files
 *                          that reached transcription, so a constructed path is a
 *                          guess and may not exist on Drive.
 *   --drive-root=<p>    Drive root (default /content/drive/MyDrive/krio)
 *   --drop-status=<list>   Recording statuses to exclude.
 *                          Default REJECTED,FLAGGED — that audio failed quality review.
 *                          Pass --drop-status= (empty) to keep everything.
 *
 * Bundle mode — stop depending on the progress CSVs entirely. Copies the audio out
 * of GCS into one folder and writes a CSV pointing at where it will live on Drive:
 *   --download-audio=<dir> Local folder to write the .wav files into.
 *   --drive-prefix=<path>  The Drive path that folder will have after you upload it,
 *                          e.g. /content/drive/MyDrive/krio/tts_bundle/wavs
 *   --only-missing         Bundle just the recordings absent from the --drive-csv files.
 *   --parallel=<n>         Concurrent downloads (default 8).
 * Re-running skips files already on disk, so an interrupted download resumes.
 *   --db-ip=<addr>      Connect to this IP instead of resolving the DB hostname
 *
 * Quality gates — the English column is only worth anything if the prompt really
 * is what the speaker said, so the export checks that rather than assuming it:
 *   --free-form=<mode>     drop (default) | krio-only | keep
 *                          Free-form recordings are good audio whose englishText is an
 *                          instruction ("Describe how to prepare yams"), not a
 *                          translation. drop leaves them out; krio-only keeps the audio
 *                          and its Krio text with eng_text blanked, which is usable for
 *                          Krio-text TTS; keep emits the instruction as-is.
 *   --exclude-speaker=<id> Drop a speaker entirely. Repeatable. Use for speakers whose
 *                          recordings are attached to the wrong prompts.
 *   --only-speaker=<id>    Keep ONLY these speakers. Repeatable. For single-speaker TTS
 *                          fine-tuning, where one voice is trained at a time.
 *   --speaker-alias=<a>=<b> Rename a speaker_id in the output, e.g.
 *                          --speaker-alias=kri_speaker_0018=jojo. Cosmetic only: it
 *                          relabels the voice tag and never regroups rows. Handy because
 *                          the account label can differ from the filename prefix
 *                          (Josephine's files are mostly named 0017, account is 0018).
 *   --min-overlap=<0..1>   Drop rows whose Krio text shares less than this fraction of
 *                          the English prompt's content words. Default 0 (report only).
 *
 * Whatever the gates do, a per-speaker agreement table is always printed. A speaker
 * with a high zero-overlap rate has a broken recording->prompt link and must not be
 * shipped with English text.
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

// --- Database URL, with the host optionally pinned ---------------------------
// DNS on some dev machines times out intermittently, which kills a 10k-row export
// halfway through. .db-host-ip (written by scripts/_dburl.sh, gitignored) lets us
// skip resolution entirely. sslmode=require does not verify the hostname, so
// swapping in the address is safe.
function databaseUrl(dbIpFlag?: string): string {
  let url = process.env.DATABASE_URL || "";
  if (!url && fs.existsSync(".env")) {
    const match = fs
      .readFileSync(".env", "utf8")
      .match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
    if (match) url = match[1].trim();
  }
  if (!url) throw new Error("DATABASE_URL is not set and could not be read from .env");

  const ip =
    dbIpFlag ||
    (fs.existsSync(".db-host-ip") ? fs.readFileSync(".db-host-ip", "utf8").trim() : "");
  if (ip) {
    const pinned = url.replace(/@[^:/@]+:(\d+)/, `@${ip}:$1`);
    if (pinned !== url) console.log(`db: pinned host -> ${ip}`);
    return pinned;
  }
  return url;
}

// Flaky DNS//network shows up as a connection error on the first query. Retry
// rather than lose the whole run.
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      const retryable = /Can't reach database server|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND/i.test(
        String(e?.message || e)
      );
      if (!retryable || i === attempts) break;
      const waitMs = i * 5000;
      console.warn(`  ${label}: connection failed (attempt ${i}/${attempts}), retrying in ${waitMs / 1000}s`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastError;
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl(
        process.argv.slice(2).find((a) => a.startsWith("--db-ip="))?.slice("--db-ip=".length)
      ),
    },
  },
});

const DRIVE_PATH_RE = /\/content\/drive\/[^,"]*\.wav/i;
const DEFAULT_DRIVE_ROOT = "/content/drive/MyDrive/krio";

function flag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

function value(args: string[], name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = args.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).replace(/^["']|["']$/g, "") : fallback;
}

function values(args: string[], name: string): string[] {
  const prefix = `--${name}=`;
  return args
    .filter((a) => a.startsWith(prefix))
    .map((a) => a.slice(prefix.length).replace(/^["']|["']$/g, ""));
}

// RFC 4180 — the transcripts are full of commas, so every field gets quoted when
// it needs to be. Newlines are flattened so one recording is always one line.
function csvField(raw: unknown): string {
  const text = raw === null || raw === undefined ? "" : String(raw).replace(/\s*[\r\n]+\s*/g, " ").trim();
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function speakerPrefix(fileName: string): string | null {
  const m = fileName.match(/^(kri_speaker_\d+)_/);
  return m ? m[1] : null;
}

// Krio borrows heavily from English, so the fraction of the English prompt's
// content words that also appear in the Krio transcript is a reliable signal that
// the recording really is that prompt. Genuine pairs sit around 0.2-0.5; a
// mis-linked pair sits at 0.
function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9ɔɛŋ\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function promptAgreement(krio: string, english: string): number {
  const k = contentWords(krio);
  const e = contentWords(english);
  if (k.size === 0 || e.size === 0) return -1; // not measurable
  let shared = 0;
  for (const w of e) if (k.has(w)) shared++;
  return shared / e.size;
}

function batchFolder(drivePath: string): string {
  // /content/drive/MyDrive/krio/<folder>/recordings/<file>.wav
  const parts = drivePath.split("/").filter(Boolean);
  const idx = parts.indexOf("recordings");
  return idx > 0 ? parts[idx - 1] : "";
}

function readDrivePaths(file: string): Map<string, string> {
  const byName = new Map<string, string>();
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(DRIVE_PATH_RE);
    if (!match) continue;
    const drivePath = match[0].trim();
    const base = path.basename(drivePath);
    if (!byName.has(base)) byName.set(base, drivePath);
  }
  return byName;
}

async function main() {
  const args = process.argv.slice(2);
  const outFile = value(args, "out", "./krio_dataset.csv")!;
  const languageCode = value(args, "language", "kri")!;
  const textMode = (value(args, "text", "any") || "any") as "approved" | "imported" | "any";
  const requireText = flag(args, "require-text");
  const speakerIdSource = (value(args, "speaker-id", "account") || "account") as
    | "account"
    | "filename";
  // Free-form recordings are good audio whose English is an instruction, not a
  // transcript. Three ways to treat them:
  //   drop      - leave them out (safe for English->Krio cross-lingual)
  //   krio-only - keep the audio, keep the Krio text, blank eng_text so the
  //               instruction can never be mistaken for a transcript
  //   keep      - keep everything including the instruction text
  const freeFormMode = (value(args, "free-form", flag(args, "include-free-form") ? "keep" : "drop") ||
    "drop") as "drop" | "krio-only" | "keep";
  const excludedSpeakers = new Set(values(args, "exclude-speaker"));
  // Orpheus-style speaker selection: train one voice at a time, so bundle one voice
  // at a time too rather than dragging down every speaker's audio.
  const onlySpeakers = new Set(values(args, "only-speaker"));
  // Rename the speaker_id in the output, e.g. --speaker-alias=kri_speaker_0018=jojo.
  // Purely cosmetic: it relabels the voice tag without regrouping any rows.
  const speakerAlias = new Map<string, string>(
    values(args, "speaker-alias")
      .map((pair) => pair.split("="))
      .filter((parts) => parts.length === 2)
      .map(([from, to]) => [from.trim(), to.trim()] as [string, string])
  );
  const minOverlap = Number(value(args, "min-overlap", "0"));
  // Never invent a path by default — every audio_filepath must come from a CSV.
  const allowInfer = flag(args, "allow-inferred-paths");
  const verifiedPathsOnly = !allowInfer;
  const driveRoot = (value(args, "drive-root", DEFAULT_DRIVE_ROOT) || DEFAULT_DRIVE_ROOT).replace(/\/+$/, "");
  const driveCsvs = values(args, "drive-csv");

  // Bundle mode: pull the audio out of GCS into one folder and point the CSV at
  // where it will live once uploaded. Removes the whole path-guessing problem.
  const downloadDir = value(args, "download-audio");
  const drivePrefix = (value(args, "drive-prefix") || "").replace(/\/+$/, "");
  const onlyMissing = flag(args, "only-missing");
  const parallelDownloads = Math.max(1, Number(value(args, "parallel", "8")));
  const bundleMode = Boolean(downloadDir);

  // REJECTED/FLAGGED audio failed quality review — never ship it to a TTS trainer.
  const dropStatuses = new Set(
    (value(args, "drop-status", "REJECTED,FLAGGED") || "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );

  if (!["approved", "imported", "any"].includes(textMode)) {
    console.error(`--text must be approved | imported | any (got "${textMode}")`);
    process.exit(1);
  }
  if (!["account", "filename"].includes(speakerIdSource)) {
    console.error(`--speaker-id must be account | filename (got "${speakerIdSource}")`);
    process.exit(1);
  }
  if (driveCsvs.length === 0 && !bundleMode) {
    console.error("Pass at least one --drive-csv=<file> so paths come from real data,");
    console.error("or use --download-audio=<dir> to build a self-contained bundle.");
    process.exit(1);
  }
  if (bundleMode && !drivePrefix) {
    console.error("--download-audio needs --drive-prefix=<path>, e.g.");
    console.error("  --drive-prefix=/content/drive/MyDrive/krio/tts_bundle/wavs");
    process.exit(1);
  }

  // --- 1. Drive path lookup, built from the progress CSVs ---
  const drivePathByFile = new Map<string, string>();
  for (const file of driveCsvs) {
    if (!fs.existsSync(file)) {
      console.error(`Drive CSV not found: ${file}`);
      process.exit(1);
    }
    const found = readDrivePaths(file);
    for (const [name, drivePath] of found) {
      if (!drivePathByFile.has(name)) drivePathByFile.set(name, drivePath);
    }
    console.log(`  ${path.basename(file)}: ${found.size} drive paths`);
  }
  console.log(`Drive paths known: ${drivePathByFile.size}`);

  // Majority batch folder per speaker, for files the CSVs did not cover.
  const votes = new Map<string, Map<string, number>>();
  for (const [name, drivePath] of drivePathByFile) {
    const prefix = speakerPrefix(name);
    const folder = batchFolder(drivePath);
    if (!prefix || !folder) continue;
    if (!votes.has(prefix)) votes.set(prefix, new Map());
    const perFolder = votes.get(prefix)!;
    perFolder.set(folder, (perFolder.get(folder) || 0) + 1);
  }
  const folderBySpeaker = new Map<string, string>();
  for (const [prefix, perFolder] of votes) {
    const ranked = [...perFolder.entries()].sort((a, b) => b[1] - a[1]);
    folderBySpeaker.set(prefix, ranked[0][0]);
    if (ranked.length > 1) {
      console.warn(`  ${prefix} spans ${ranked.map(([f, n]) => `${f}(${n})`).join(", ")} — inferring "${ranked[0][0]}"`);
    }
  }
  if (folderBySpeaker.size) {
    console.log("Batch folder per speaker:", Object.fromEntries(folderBySpeaker));
  }
  console.log();

  // --- 2. Recordings + prompt-bank English + Krio text ---
  const language = await withRetry("language", () =>
    prisma.language.findFirst({ where: { code: languageCode } })
  );
  if (!language) {
    console.error(`Language "${languageCode}" not found.`);
    process.exit(1);
  }

  const recordings = await withRetry("recordings", () =>
    prisma.recording.findMany({
      where: { languageId: language.id },
      select: {
        id: true,
        audioUrl: true,
        status: true,
        durationSec: true,
        transcript: true,
        prompt: { select: { englishText: true, isFreeForm: true, category: true } },
        transcription: { select: { text: true, status: true } },
        speaker: { select: { id: true, displayName: true, speakerLabel: true } },
      },
      orderBy: { audioUrl: "asc" },
    })
  );
  console.log(`Recordings for ${language.name} (${languageCode}): ${recordings.length}`);

  const rows: string[] = [];
  const skipped: string[] = [];
  const relabelled = new Map<string, number>();
  const speakerRows = new Map<string, number>();
  const speakerSeconds = new Map<string, number>();
  let totalSeconds = 0;
  const agreementBySpeaker = new Map<
    string,
    { n: number; sum: number; zero: number; unknown: number }
  >();
  const stats = {
    approvedText: 0,
    importedText: 0,
    noText: 0,
    exactPath: 0,
    inferredPath: 0,
    noPath: 0,
    noEnglish: 0,
    noSpeakerId: 0,
    freeForm: 0,
    excludedSpeaker: 0,
    lowOverlap: 0,
    unverifiedPath: 0,
    droppedStatus: 0,
    bundled: 0,
    alreadyOnDrive: 0,
    otherSpeaker: 0,
    freeFormKrioOnly: 0,
  };
  const toDownload: { uri: string; base: string }[] = [];

  for (const rec of recordings) {
    const base = path.basename(rec.audioUrl);

    // Resolve identity FIRST. Speaker selection has to run before anything queues a
    // download, or --only-speaker would still pull every other speaker's audio.
    const filenameId = speakerPrefix(base) || "";
    const accountId = rec.speaker?.speakerLabel ? `kri_${rec.speaker.speakerLabel}` : "";
    const resolvedId =
      speakerIdSource === "filename" ? filenameId : accountId || filenameId;
    const speakerId = speakerAlias.get(resolvedId) || resolvedId;

    if (
      onlySpeakers.size &&
      !onlySpeakers.has(resolvedId) &&
      !onlySpeakers.has(speakerId) &&
      !onlySpeakers.has(filenameId)
    ) {
      stats.otherSpeaker++;
      continue;
    }

    if (
      excludedSpeakers.has(resolvedId) ||
      excludedSpeakers.has(speakerId) ||
      excludedSpeakers.has(filenameId)
    ) {
      stats.excludedSpeaker++;
      skipped.push(`${base}\texcluded speaker ${speakerId}\t${rec.audioUrl}`);
      continue;
    }

    // Free-form prompts carry an instruction, not a sentence the speaker translated.
    if (rec.prompt?.isFreeForm && freeFormMode === "drop") {
      stats.freeForm++;
      skipped.push(`${base}\tfree-form prompt\t${rec.prompt.englishText.slice(0, 80)}`);
      continue;
    }

    // Audio that failed quality review is unusable for TTS however good the text is.
    if (dropStatuses.has(rec.status)) {
      stats.droppedStatus++;
      skipped.push(`${base}\tstatus ${rec.status}\t${rec.audioUrl}`);
      continue;
    }

    let drivePath: string | undefined;
    if (bundleMode) {
      // The bundle IS the source of truth: we copy the object out of GCS ourselves,
      // so the path is known rather than guessed.
      const existing = onlyMissing ? drivePathByFile.get(base) : undefined;
      if (existing) {
        // Already on Drive — keep its real path and skip the download, so the CSV
        // stays complete without re-fetching bytes you have.
        drivePath = existing;
        stats.alreadyOnDrive++;
      } else {
        drivePath = `${drivePrefix}/${base}`;
        toDownload.push({ uri: rec.audioUrl, base });
        stats.bundled++;
      }
    } else if ((drivePath = drivePathByFile.get(base))) {
      stats.exactPath++;
    } else if (verifiedPathsOnly) {
      stats.unverifiedPath++;
      skipped.push(`${base}\tpath not in any --drive-csv\t${rec.audioUrl}`);
      continue;
    } else if (allowInfer) {
      const prefix = speakerPrefix(base);
      const folder = prefix ? folderBySpeaker.get(prefix) : undefined;
      if (folder) {
        drivePath = `${driveRoot}/${folder}/recordings/${base}`;
        stats.inferredPath++;
      }
    }
    if (!drivePath) {
      stats.noPath++;
      skipped.push(`${base}\tno drive path\t${rec.audioUrl}`);
      continue;
    }

    const approved = rec.transcription?.status === "APPROVED" ? rec.transcription.text || "" : "";
    const imported = rec.transcript || "";
    let krio = "";
    if (textMode === "approved") krio = approved;
    else if (textMode === "imported") krio = imported;
    else krio = approved || imported;

    if (krio && krio === approved) stats.approvedText++;
    else if (krio) stats.importedText++;
    else stats.noText++;

    if (!krio && requireText) {
      skipped.push(`${base}\tno text (mode=${textMode})\t${rec.audioUrl}`);
      continue;
    }

    // In krio-only mode the instruction must not reach eng_text; a row with no
    // Krio text either is then empty of text entirely, so drop it.
    const isFreeForm = Boolean(rec.prompt?.isFreeForm);
    if (isFreeForm && freeFormMode === "krio-only" && !krio) {
      stats.freeForm++;
      skipped.push(`${base}	free-form with no Krio text	${rec.audioUrl}`);
      continue;
    }
    const english =
      isFreeForm && freeFormMode === "krio-only" ? "" : rec.prompt?.englishText || "";
    if (isFreeForm && freeFormMode === "krio-only") stats.freeFormKrioOnly++;
    if (!english) stats.noEnglish++;

    // The .wav filename encodes the label the speaker had at recording time, which
    // drifted for re-labelled speakers; speakerId (resolved above) is the stable identity.
    if (speakerId && filenameId && speakerId !== filenameId) {
      const key = `${filenameId} -> ${speakerId} (${rec.speaker?.displayName ?? "?"})`;
      relabelled.set(key, (relabelled.get(key) || 0) + 1);
    }

    // Does the prompt actually match what was recorded? Only measurable when we
    // have Krio text; -1 means "unknown", which is not the same as "bad".
    const agreement = promptAgreement(krio, english);
    const audit = agreementBySpeaker.get(speakerId) || { n: 0, sum: 0, zero: 0, unknown: 0 };
    if (agreement < 0) audit.unknown++;
    else {
      audit.n++;
      audit.sum += agreement;
      if (agreement === 0) audit.zero++;
    }
    agreementBySpeaker.set(speakerId, audit);

    if (minOverlap > 0 && agreement >= 0 && agreement < minOverlap) {
      stats.lowOverlap++;
      skipped.push(`${base}\tprompt agreement ${agreement.toFixed(2)} < ${minOverlap}\t${english.slice(0, 60)}`);
      continue;
    }

    totalSeconds += rec.durationSec || 0;
    if (speakerId) {
      speakerRows.set(speakerId, (speakerRows.get(speakerId) || 0) + 1);
      speakerSeconds.set(speakerId, (speakerSeconds.get(speakerId) || 0) + (rec.durationSec || 0));
    } else {
      stats.noSpeakerId++;
    }

    rows.push(
      [csvField(drivePath), csvField(speakerId), csvField(krio), csvField(english)].join(",")
    );
  }

  const header = "audio_filepath,speaker_id,text,eng_text";
  const outDir = path.dirname(path.resolve(outFile));
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, [header, ...rows].join("\n") + "\n", "utf8");

  // --- 3. Bundle mode: pull the audio out of GCS so the paths above are real ---
  if (bundleMode && toDownload.length) {
    const { downloadBuffer } = await import("../src/lib/infra/storage");
    fs.mkdirSync(downloadDir!, { recursive: true });

    let done = 0;
    let fetched = 0;
    let cached = 0;
    let bytes = 0;
    const failures: string[] = [];
    const queue = [...toDownload];

    const worker = async () => {
      for (;;) {
        const item = queue.shift();
        if (!item) return;
        const dest = path.join(downloadDir!, item.base);
        done++;
        // Resume: a re-run should not re-fetch gigabytes already on disk.
        if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
          cached++;
          bytes += fs.statSync(dest).size;
        } else {
          try {
            const buf = await downloadBuffer(item.uri);
            fs.writeFileSync(dest, buf);
            fetched++;
            bytes += buf.length;
          } catch (e: any) {
            failures.push(`${item.base}\t${item.uri}\t${e?.message || e}`);
          }
        }
        if (done % 200 === 0 || done === toDownload.length) {
          console.log(
            `  ${done}/${toDownload.length}  fetched=${fetched} cached=${cached} failed=${failures.length}  ${(bytes / 1e9).toFixed(2)} GB`
          );
        }
      }
    };

    console.log(`\n=== DOWNLOADING ${toDownload.length} wav files -> ${path.resolve(downloadDir!)} ===`);
    console.log(`  (${parallelDownloads} at a time; re-running skips files already on disk)`);
    await Promise.all(Array.from({ length: parallelDownloads }, worker));

    console.log(`\n  fetched ${fetched}, reused ${cached}, failed ${failures.length}, ${(bytes / 1e9).toFixed(2)} GB total`);

    if (failures.length) {
      const failFile = outFile.replace(/\.csv$/i, "") + ".download-failed.tsv";
      fs.writeFileSync(failFile, failures.join("\n") + "\n", "utf8");
      console.log(`  failures -> ${path.resolve(failFile)}`);

      // A CSV row pointing at audio we could not fetch is a broken row. Drop them.
      const lost = new Set(failures.map((f) => f.split("\t")[0]));
      const kept = rows.filter((r) => !lost.has(path.basename(r.split(",")[0].replace(/^"|"$/g, ""))));
      fs.writeFileSync(outFile, [header, ...kept].join("\n") + "\n", "utf8");
      console.log(`  removed ${rows.length - kept.length} rows whose audio failed to download`);
      console.log(`  ${kept.length} rows remain in ${path.resolve(outFile)}`);
    }

    console.log(
      `\n  Upload the folder to Drive so it lands at:\n    ${drivePrefix}\n` +
        `  Every audio_filepath in the CSV already points there — nothing to reconstruct.`
    );
  }

  console.log("\n=== EXPORT ===");
  console.log(`Rows written: ${rows.length} → ${path.resolve(outFile)}`);
  console.log(`  AUDIO     : ${(totalSeconds / 3600).toFixed(2)} hours`);
  console.log(`  drive path: ${stats.exactPath} from CSV, ${stats.inferredPath} inferred, ${stats.noPath} unresolved (dropped)`);
  console.log(`  krio text : ${stats.approvedText} reviewer-approved, ${stats.importedText} imported, ${stats.noText} blank`);
  console.log(`  english   : ${rows.length - stats.noEnglish} present, ${stats.noEnglish} blank`);
  console.log(`  speakers  : ${speakerRows.size} distinct (source=${speakerIdSource})${stats.noSpeakerId ? `, ${stats.noSpeakerId} with no id` : ""}`);
  for (const [id, n] of [...speakerRows.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`              ${String(n).padStart(5)}  ${id}   ${((speakerSeconds.get(id) || 0) / 3600).toFixed(2)}h`);
  }
  if (relabelled.size) {
    console.log("  re-labelled speakers folded onto their account id:");
    for (const [key, n] of [...relabelled.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`              ${String(n).padStart(5)}  ${key}`);
    }
  }
  console.log(`  dropped   : ${stats.freeForm} free-form${stats.freeFormKrioOnly?` (+${stats.freeFormKrioOnly} kept krio-only)`:""}, ${stats.excludedSpeaker} excluded speaker, ${stats.droppedStatus} failed-QC audio, ${stats.lowOverlap} low prompt agreement, ${stats.noPath} no drive path, ${stats.unverifiedPath} path not in your CSVs`);
  if (bundleMode) {
    console.log(`  bundle    : ${stats.bundled} downloaded to the new folder, ${stats.alreadyOnDrive} kept at their existing Drive path`);
  }
  if (stats.unverifiedPath) {
    console.log(`              (those recordings exist in the database but no --drive-csv lists them,
               so their Drive path is unknown. --allow-inferred-paths builds one from the
               speaker's batch folder, but it is a guess.)`);
  }

  // Does the English prompt actually describe the audio? Never let this go unseen.
  console.log("\n=== PROMPT AGREEMENT (does eng_text match what was recorded?) ===");
  console.log("  speaker              measurable   mean   zero-overlap   unverifiable");
  const suspect: string[] = [];
  for (const [spk, a] of [...agreementBySpeaker.entries()].sort((x, y) => y[1].n - x[1].n)) {
    const mean = a.n ? a.sum / a.n : 0;
    const zeroPct = a.n ? (100 * a.zero) / a.n : 0;
    const warn = a.n >= 25 && zeroPct > 50;
    if (warn) suspect.push(spk);
    console.log(
      `  ${spk.padEnd(20)} ${String(a.n).padStart(9)}   ${mean.toFixed(3)}   ${zeroPct.toFixed(1).padStart(10)}%   ${String(a.unknown).padStart(11)}${warn ? "   <-- BROKEN PROMPT LINK" : ""}`
    );
  }
  if (suspect.length) {
    console.log(
      `\n  WARNING: ${suspect.join(", ")} — the audio does not match the prompt-bank English.\n` +
        `  These recordings were not read from a prompt, so eng_text is meaningless for them.\n` +
        `  Re-run with ${suspect.map((s) => `--exclude-speaker=${s}`).join(" ")} to drop them.`
    );
  }

  if (skipped.length) {
    const skipFile = outFile.replace(/\.csv$/i, "") + ".skipped.tsv";
    fs.writeFileSync(skipFile, skipped.join("\n") + "\n", "utf8");
    console.log(`  skipped   : ${skipped.length} → ${path.resolve(skipFile)}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
