# Krio TTS dataset

`krio_tts_dataset.csv` — the English-text-to-Krio-audio training set.
8,205 rows, ~28.9 hours, one row per recording:

```
audio_filepath,speaker_id,text,eng_text
```

| column | meaning |
| --- | --- |
| `audio_filepath` | absolute Google Drive path to the `.wav` |
| `speaker_id` | `richard` \| `jojo` \| `fatmata` — one stable tag per voice |
| `text` | Krio transcript (blank on 2,249 rows — not used for English→Krio) |
| `eng_text` | English the speaker was asked to say. **Populated on every row.** |

| speaker | rows | hours |
| --- | --- | --- |
| `richard` (Richard Pambu) | 4,749 | 13.24 |
| `jojo` (Josephine A Nyango) | 3,248 | 15.08 |
| `fatmata` (Fatmata Binta Kamara) | 208 | 0.54 |

Audio lives in five Drive folders:

```
/content/drive/MyDrive/krio/richard/recordings          2,910
/content/drive/MyDrive/krio/jojo/recordings             2,855
/content/drive/MyDrive/krio/richard/richard_new_wavs    1,839
/content/drive/MyDrive/krio/jojo/jojo_new_wavs            393
/content/drive/MyDrive/krio/Fatmata Binta Kamara/recordings  208
```

The two `*_new_wavs` folders were pulled from the GCS bucket and uploaded
separately; the rest were already on Drive.

---

## Validate the dataset in Colab

Paste this into a single Colab cell. It mounts Drive, checks that every
`audio_filepath` exists, opens each WAV to confirm it is readable, and reports
clip-length statistics.

Expect `MISSING : 0`, `unreadable : 0`, total audio near 28.9 hours, `RESULT: PASS`.

```python
from google.colab import drive
drive.mount('/content/drive')
import csv, os, wave, collections, statistics

CSV_PATH = '/content/drive/MyDrive/krio/krio_tts_dataset.csv'
EXPECTED_HEADER = ['audio_filepath', 'speaker_id', 'text', 'eng_text']

if not os.path.exists(CSV_PATH):
    print('NOT FOUND:', CSV_PATH)
    print('Contents of /content/drive/MyDrive/krio :')
    for f in sorted(os.listdir('/content/drive/MyDrive/krio')):
        print('   ', f)
    raise SystemExit('Fix CSV_PATH above, then re-run.')

with open(CSV_PATH, encoding='utf-8', newline='') as fh:
    reader = csv.reader(fh)
    header = next(reader)
    rows = [r for r in reader if len(r) == 4]

print('=' * 60)
print('CSV')
print('=' * 60)
print('header :', header)
print('rows   :', len(rows), '(expected 8205)')
print('header ok :', header == EXPECTED_HEADER)
print('blank eng_text :', sum(1 for r in rows if not r[3].strip()))
print('duplicate paths:', len(rows) - len(set(r[0] for r in rows)))
print('speakers :', sorted(set(r[1] for r in rows)))

print()
print('=' * 60)
print('PATH CHECK (does every file exist on Drive?)')
print('=' * 60)
missing = []
found = 0
by_folder = collections.Counter()
miss_folder = collections.Counter()
for audio, spk, text, eng in rows:
    folder = audio.rsplit('/', 1)[0]
    by_folder[folder] += 1
    if os.path.exists(audio):
        found += 1
    else:
        missing.append((spk, audio))
        miss_folder[folder] += 1

print('FOUND   :', found, '/', len(rows))
print('MISSING :', len(missing))
print()
for folder, n in by_folder.most_common():
    bad = miss_folder[folder]
    mark = '   <-- PROBLEM' if bad else ''
    print('  %5d / %-5d ok   %s%s' % (n - bad, n, folder, mark))

if missing:
    print()
    print('first 20 missing:')
    for spk, audio in missing[:20]:
        print('   ', spk, audio)

print()
print('=' * 60)
print('AUDIO CHECK (readable? how long?)')
print('=' * 60)
durations = []
unreadable = []
for audio, spk, text, eng in rows:
    if not os.path.exists(audio):
        continue
    try:
        with wave.open(audio, 'rb') as w:
            durations.append(w.getnframes() / float(w.getframerate()))
    except Exception as err:
        unreadable.append((audio, str(err)[:60]))

print('readable   :', len(durations))
print('unreadable :', len(unreadable))
for audio, err in unreadable[:10]:
    print('   ', audio, '->', err)

if durations:
    durations.sort()
    n = len(durations)
    over15 = sum(1 for d in durations if d > 15)
    print()
    print('total audio : %.2f hours  (expected about 28.9)' % (sum(durations) / 3600.0))
    print('median clip : %.1f s' % statistics.median(durations))
    print('p90 / max   : %.1f s / %.1f s' % (durations[int(n * 0.9)], durations[-1]))
    print('over 15s    : %d (%.0f%%)' % (over15, 100.0 * over15 / n))
    print('under 1s    : %d' % sum(1 for d in durations if d < 1))

print()
print('=' * 60)
if not missing and not unreadable:
    print('RESULT: PASS - all', len(rows), 'rows point at readable audio')
else:
    print('RESULT: FAIL -', len(missing), 'missing,', len(unreadable), 'unreadable')
print('=' * 60)
```

### Reading the result

- A whole folder marked `<-- PROBLEM` means the upload landed somewhere other
  than the path in the CSV. Regenerate with the corrected `--drive-prefix`; no
  re-download is needed because the audio is cached locally.
- `total audio` well below 28.9 hours while paths still resolve points at
  truncated uploads rather than missing files. The `unreadable` and `under 1s`
  counts will show it.

---

## Regenerating

```bash
npm run krio:dl:richard     # fetch Richard's GCS-only audio (1,839 files, ~715 MB)
npm run krio:dl:jojo        # fetch Josephine's GCS-only audio (393 files, ~150 MB)
npm run krio:final:richard  # write richard_final.csv with real Drive paths
npm run krio:final:jojo     # write jojo_final.csv with real Drive paths
npm run krio:combine        # merge into krio_tts_dataset.csv
```

Downloads resume: re-running skips any file already on disk.

`drive_a.csv` / `drive_b.csv` are copies of the Drive progress CSVs
(`krio_transcripts_progress (3).csv` and `..._Final.csv`). They exist only so
`--only-missing` knows which audio is already on Drive and can skip it.

---

## What was excluded, and why

Decisions worth not re-litigating later.

**`kri_speaker_0022` — 500 rows.** Its recordings are spontaneous speech
attached to unrelated prompt-bank entries. 81% of those rows share *zero*
content words with what was actually said:

```
audio says : "tiday sell slow tiday from god make morning na 30 leones A done sell..."
prompt says: "It is very far from here."
```

Including it would silently corrupt the English side. The export prints a
per-speaker agreement table and flags `<-- BROKEN PROMPT LINK` if this recurs.

**Free-form prompts — 836 rows, 4.53 h.** Their `englishText` is an instruction
("Describe the steps to prepare yams for frying"), not a sentence the speaker
translated, so it is not a transcript of the audio. 821 of them are Josephine's
and *do* have Krio text, so they are usable for Krio→Krio via
`--free-form=krio-only`. They sit in `extra_jojo_freeform.csv` with `eng_text`
blank, waiting on human English. Once annotators fill those in, re-run
`npm run krio:combine` to reach 9,026 rows / 33.4 h.

**`REJECTED` / `FLAGGED` — 552 rows.** Failed audio quality review. All but two
have no transcript anyway.

**Six minor speakers — ~180 rows, under 1 hour.** Theresa (110), Fatmata Saccoh
(44), and others. Valid data, but the audio is GCS-only and each speaker has far
too little to train a voice. Add with
`--only-speaker=<id> --download-audio=... --drive-prefix=...` if ever needed.

---

## Gotchas

**One speaker, two filename prefixes.** Some speakers were re-labelled partway
through collection, so one person's files carry two prefixes:

| person | filenames | account |
| --- | --- | --- |
| Josephine A Nyango | `kri_speaker_0017_*` (3,959) + `kri_speaker_0018_*` (392) | `speaker_0018` |
| Richard Pambu | `kri_speaker_0014_*` (2,934) + `kri_speaker_0015_*` (2,100) | `speaker_0015` |

`speaker_id` comes from the **account**, not the filename, so each person is a
single voice. Using `--speaker-id=filename` would split them in two and a
speaker-selection trainer would treat them as different people.

The filenames themselves are real GCS object names and must never be normalised
— both `speaker_0017/` and `speaker_0018/` exist as folders in the bucket.

**Drive folder names are annotators, not speakers.** `jojo`, `richard` and
`Fatmata Binta Kamara` are the people who processed each batch. That mapping
lives nowhere in the database, which is why `--drive-csv` exists at all.

**Never invent a path.** Paths come from a `--drive-csv` or from a file the
script downloaded itself. `--allow-inferred-paths` will construct one from the
speaker's batch folder, but it is a guess and may not exist on Drive.

**Flaky DNS.** The managed-Postgres host intermittently fails to resolve on some
machines, which kills long exports mid-run. The resolved IP is cached in
`.db-host-ip` (gitignored); `. scripts/_dburl.sh` re-resolves it, or pass
`--db-ip=<addr>`.

---

## Known gaps

- **822 English texts pending** from annotators, worth +4.48 h on Josephine.
- **Clips are long** — median 19.4 s, 64 words, 76% over 15 s. This applies to
  the whole corpus and is likely the first thing to tune in an Orpheus config.
- **~3 h of Josephine's audio is unaccounted for.** The database knows about
  21.03 h of her; roughly 24 h is believed to be on Drive. If so, those
  recordings were never registered in the database and no export can see them.
