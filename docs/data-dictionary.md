# Data Dictionary

Every field KACCP exports, and the core database fields behind them.

---

## 1. Dataset export — CSV

`GET /api/v2/admin/export?format=csv` and the admin Export screen.
Pipe-delimited (`|`), UTF-8, one row per recording.

Pipe rather than comma because transcripts are full of commas. Every field is stripped of newlines
and pipes so one recording is always exactly one line.

| Field | Type | Null? | Meaning |
|---|---|---|---|
| `id` | string | no | Stable export identifier, `{LANG}_{speakerId}_{00001}` |
| `audio_path` | string | no | Location of the audio. `gs://bucket/...` for cloud storage, a filesystem path for local |
| `english_text` | string | no | The prompt sentence the speaker was asked to say. **For free-form prompts this is an instruction, not a transcript** — see §4 |
| `transcription` | string | yes | What the speaker actually said, in the target language. Empty when not yet transcribed |
| `transcript_source` | enum | yes | `human_approved` (reviewer-approved) or `imported` (CSV/auto-transcribed, unreviewed). **Never treat these as equivalent** |
| `duration_sec` | float | no | Audio length in seconds |
| `speaker_id` | string | no | Opaque account identifier. Not a name |
| `speaker_name` | string | yes | Display name. Present only in admin exports, never in published datasets |
| `speaker_label` | string | yes | Stable anonymous label, e.g. `speaker_0018`. **Use this for published data** |
| `category` | enum | no | Prompt category — see §5 |

## 2. Training export — CSV

Produced by `scripts/export-krio-dataset.ts`. Comma-delimited, RFC 4180 quoted, UTF-8.
This is the shape intended for model training and for sharing.

```
audio_filepath,speaker_id,text,eng_text
```

| Field | Type | Null? | Meaning |
|---|---|---|---|
| `audio_filepath` | string | no | Absolute path to the `.wav` as it will exist on the training machine |
| `speaker_id` | string | no | **Anonymous** label, e.g. `kri_speaker_0018`. Derived from the speaker's account, not the filename — see §4 |
| `text` | string | yes | Target-language transcript. May be empty; the row is still usable for text-to-speech from English |
| `eng_text` | string | no | English source sentence |

## 3. LJSpeech bundle — ZIP

`GET /api/v2/admin/export/audio`. The de-facto interchange layout for speech synthesis.

```
wavs/<id>.wav          audio, PCM WAV
metadata.csv           id|wav_path|transcription|english_text|source|duration_sec|...
skipped_non_wav.txt    sources not in WAV format, if any
failed.txt             downloads that failed, if any
README.txt             what is in the bundle
```

## 4. Four things that will catch you out

**Free-form prompts.** When `Prompt.isFreeForm` is true, `englishText` is an instruction
("Describe how to prepare yams"), not a sentence the speaker translated. It is not a valid English
side for a training pair. Exports drop these rows by default; the real translation, when a
transcriber has written one, is in `Recording.englishTranslation`.

**`speaker_id` is not the filename prefix.** Some speakers were re-labelled partway through
collection, so one person's files can carry two different prefixes. `speaker_id` is derived from
the **account**, which is stable. Keying off the filename would split one person into two speakers
and a speaker-selection trainer would treat them as different people.

**`transcript_source` matters.** `imported` text has not been through human review. Mixing it with
`human_approved` without distinguishing them means training on unverified transcripts.

**Empty `text` is not a bug.** Audio can be collected before it is transcribed. Those rows are
still valid for English→target-language synthesis. Filter on `text != ""` only if your task needs
the target-language string.

## 5. Enumerations

**`RecordingStatus`** — `PENDING_REVIEW`, `PENDING_TRANSCRIPTION`, `TRANSCRIBED`, `APPROVED`,
`REJECTED`, `FLAGGED`.
`REJECTED` and `FLAGGED` are excluded from exports by default.

**`TranscriptionStatus`** — `PENDING_REVIEW`, `APPROVED`, `REJECTED`.

**`UserRole`** — `ADMIN`, `SPEAKER`, `TRANSCRIBER`, `REVIEWER`.

**`flagReason`** — `NOISE`, `UNCLEAR`, `TOO_QUIET`, `WRONG_LANGUAGE`, `INCOMPLETE`,
`INAPPROPRIATE`, `OTHER`.
`INAPPROPRIATE` is a content breach, not a quality problem — see
[content moderation](content-moderation.md).

**`PromptCategory`** — `GREETINGS`, `NUMBERS_MONEY`, `QUESTIONS`, `COMMANDS_REQUESTS`,
`EMOTIONS_HAPPY`, `EMOTIONS_SAD`, `DAILY_LIFE`, `MARKET_SHOPPING`, `DIRECTIONS_PLACES`,
`FAMILY_PEOPLE`, `HEALTH`, `WEATHER_TIME`, `LOCAL_SCENARIOS`, `PHONETIC_COVERAGE`,
`CONVERSATIONS`, `SHORT_PHRASES`, `PLACE_NAMES`, `PROVERBS`, `PASTORAL_LIFE`, `RELIGION_FAITH`,
`FUNCTIONAL_PHRASES`.

**`PromptEmotion`** — `NEUTRAL`, `HAPPY`, `SAD`, `ANGRY`, `QUESTION`, `EXCITED`, `SURPRISED`,
`WHISPER`, `URGENT`.

## 6. Core database fields

### `Language`
| Field | Type | Meaning |
|---|---|---|
| `code` | string | ISO 639-3, e.g. `kri` |
| `name` | string | English name |
| `nativeName` | string? | Name in the language itself |
| `targetMinutes` | int | Collection goal |
| `collectedMinutes` | float | Recorded so far |
| `approvedMinutes` | float | Passed review |
| `speakerRatePerMinute` | float | Speaker pay rate |
| `transcriberRatePerMin` | float | Transcriber pay rate |

### `Prompt`
| Field | Type | Meaning |
|---|---|---|
| `englishText` | string | Sentence to say — **or an instruction when `isFreeForm`** |
| `category` | enum | See §5 |
| `emotion` | enum | Delivery guidance |
| `instruction` | string? | Extra guidance, e.g. "say with excitement" |
| `hint` | string? | Plain-language explanation for the speaker |
| `isFreeForm` | bool | Speaker talks freely on a topic |
| `targetDurationSec` | int | Expected length |
| `languageId` | string? | `null` means available to all languages |

### `Recording`
| Field | Type | Meaning |
|---|---|---|
| `audioUrl` | string | Storage URI |
| `durationSec` | float | Length |
| `sampleRate` | int? | Target 16000 Hz |
| `status` | enum | See §5 |
| `isFlagged` / `flagReason` | bool / string? | Quality or content flag |
| `transcript` | string? | Machine or imported transcript, **unreviewed** |
| `transcriptConfidence` | float? | 0–1, when machine-generated |
| `englishTranslation` | string? | Human English for free-form recordings |
| `englishTranslatedById` | string? | Who wrote it |
| `englishTranslationStatus` | enum? | Review state of that translation |
| `consentGiven` | bool | Consent recorded **per recording**, not once per account |

### `Transcription`
| Field | Type | Meaning |
|---|---|---|
| `text` | string | What was said, in the target language |
| `status` | enum | See §5 |
| `transcriberId` / `reviewerId` | string | Who wrote it / who judged it |
| `reviewNotes` | string? | Feedback shown to the transcriber on rejection |

## 7. Personal data

Fields below are **PII and never appear in published datasets**:

`User.email` · `User.phone` · `User.displayName` · `User.passwordHash` ·
`Payment.*` · `WalletTransaction.*` · server-log IP addresses

Published data identifies speakers only by `speaker_label` (e.g. `speaker_0018`). Voice itself is
biometric data — see [PRIVACY.md](../PRIVACY.md). A contributor can download everything held about
them (`GET /api/v2/account/export`) or delete their account (`DELETE /api/v2/account`).

---

**Related:** [Architecture](architecture.md) · [Dataset export](krio-tts-dataset.md) ·
[Privacy](../PRIVACY.md)
