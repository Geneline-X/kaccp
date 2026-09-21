/* Merge per-speaker dataset CSVs into one training file.
 *
 * Each speaker is exported separately because their newly-bundled audio lives in a
 * different Drive folder, and a single export run can only emit one --drive-prefix.
 * This stitches them back together and re-checks the things that actually break a
 * training run: header drift, duplicate audio paths, missing English, stray columns.
 *
 * Usage:
 *   npx tsx scripts/combine-krio-datasets.ts --out=./krio_tts_dataset.csv richard_final.csv jojo_final.csv
 */
import * as fs from "fs";
import * as path from "path";

const HEADER = "audio_filepath,speaker_id,text,eng_text";

// Minimal RFC-4180 row reader: fields may be quoted and contain commas.
function parseRow(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { out.push(field); field = ""; }
    else field += c;
  }
  out.push(field);
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const outFile =
    args.find((a) => a.startsWith("--out="))?.slice("--out=".length) || "./krio_tts_dataset.csv";
  const inputs = args.filter((a) => !a.startsWith("--"));
  // A row with no English cannot train English->Krio, and a half-filled column is
  // worse than an absent one: it silently shrinks the usable set at train time.
  const requireEnglish = args.includes("--require-english");
  const requireKrio = args.includes("--require-krio");

  if (inputs.length === 0) {
    console.error("Pass at least one input CSV, e.g. richard_final.csv jojo_final.csv");
    process.exit(1);
  }

  const kept: string[] = [];
  const seenPath = new Map<string, string>();
  let duplicates = 0;
  let malformed = 0;
  let incomplete = 0;

  for (const file of inputs) {
    if (!fs.existsSync(file)) {
      console.error(`Not found: ${file}`);
      process.exit(1);
    }
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.trim());
    const header = lines.shift();
    if (header !== HEADER) {
      console.error(`${file}: unexpected header\n  got      ${header}\n  expected ${HEADER}`);
      process.exit(1);
    }

    const perSpeaker = new Map<string, { rows: number }>();
    let added = 0;
    for (const line of lines) {
      const cols = parseRow(line);
      if (cols.length !== 4) { malformed++; continue; }
      const [audio, speaker] = cols;
      // The same recording must never appear twice — it would be trained on twice
      // and, worse, could carry two different transcripts.
      if (requireEnglish && !cols[3].trim()) { incomplete++; continue; }
      if (requireKrio && !cols[2].trim()) { incomplete++; continue; }
      const prior = seenPath.get(audio);
      if (prior) { duplicates++; continue; }
      seenPath.set(audio, file);
      kept.push(line);
      added++;
      const s = perSpeaker.get(speaker) || { rows: 0 };
      s.rows++;
      perSpeaker.set(speaker, s);
    }
    console.log(`${path.basename(file)}: ${added} rows`);
    for (const [spk, v] of perSpeaker) console.log(`    ${spk}: ${v.rows}`);
  }

  fs.writeFileSync(outFile, [HEADER, ...kept].join("\n") + "\n", "utf8");

  // Report on the combined result rather than trusting the inputs.
  const speakers = new Map<string, number>();
  const folders = new Map<string, number>();
  let noEnglish = 0;
  let noText = 0;
  for (const line of kept) {
    const [audio, speaker, text, eng] = parseRow(line);
    speakers.set(speaker, (speakers.get(speaker) || 0) + 1);
    const dir = audio.slice(0, audio.lastIndexOf("/"));
    folders.set(dir, (folders.get(dir) || 0) + 1);
    if (!eng.trim()) noEnglish++;
    if (!text.trim()) noText++;
  }

  console.log(`\n=== COMBINED -> ${path.resolve(outFile)} ===`);
  console.log(`  rows              : ${kept.length}`);
  console.log(`  duplicate paths   : ${duplicates}${duplicates ? "  (dropped)" : ""}`);
  console.log(`  malformed rows    : ${malformed}`);
  console.log(`  incomplete rows   : ${incomplete}${incomplete ? "  (dropped)" : ""}`);
  console.log(`  blank eng_text    : ${noEnglish}`);
  console.log(`  blank text (krio) : ${noText}`);
  console.log(`  speakers          :`);
  for (const [s, n] of [...speakers].sort((a, b) => b[1] - a[1])) console.log(`      ${String(n).padStart(5)}  ${s}`);
  console.log(`  audio folders     :`);
  for (const [f, n] of [...folders].sort((a, b) => b[1] - a[1])) console.log(`      ${String(n).padStart(5)}  ${f}`);
}

main();
