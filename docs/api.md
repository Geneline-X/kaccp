# API Reference

All endpoints are JSON over HTTPS. Paths are relative to your deployment root.

---

## Authentication

Every endpoint except registration and login requires a bearer token:

```
Authorization: Bearer <jwt>
```

Tokens are JWTs (RFC 7519) issued at login. **Authorisation is checked server-side on every
request** — the caller's role is resolved from the database, not trusted from the token claims
alone.

| Status | Meaning |
|---|---|
| `401` | No token, or the token is invalid or expired |
| `403` | Authenticated, but lacking the required role |
| `409` | Conflict — e.g. the recording was claimed by someone else first |
| `429` | Rate limited |

### Auth endpoints

| Method | Path | Body | Notes |
|---|---|---|---|
| `POST` | `/api/auth/register` | `email`, `phone`, `password`, `displayName?`, `role`, `speaksLanguages[]`, `writesLanguages[]`, `ageConfirmed`, `termsAccepted` | `role` is `SPEAKER` or `TRANSCRIBER`. Rejects when `ageConfirmed` is explicitly `false` |
| `POST` | `/api/auth/login` | `email`, `password` | Returns `{ token, user }` |
| `GET` | `/api/auth/me` | — | Current user |
| `POST` | `/api/auth/forgot-password` | `email` | |
| `POST` | `/api/auth/reset-password` | `token`, `password` | |

---

## Speaker

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v2/speaker/prompts` | Prompts available to record, filtered by the speaker's languages |
| `POST` | `/api/v2/speaker/prompts/skip` | Skip a prompt so it is not offered again |
| `POST` | `/api/v2/speaker/upload-url` | Signed URL for uploading a recording (15-minute expiry) |
| `POST` | `/api/v2/speaker/recordings` | Register an uploaded recording |
| `GET` | `/api/v2/speaker/earnings` | Earnings summary |
| `GET` | `/api/v2/speaker/wallet` | Wallet balance and transaction history |

---

## Transcriber

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v2/transcriber/available` | Recordings awaiting transcription. `?languageId`, `?limit`, `?offset` |
| `POST` | `/api/v2/transcriber/claim` | Claim one recording. Claims expire after `ASSIGNMENT_MINUTES` |
| `POST` | `/api/v2/transcriber/release` | Release a claim early |
| `POST` | `/api/v2/transcriber/submit` | Submit a transcription, or flag the recording |
| `GET` | `/api/v2/transcriber/my-work` | Active claims, recent work, rejection feedback, stats |
| `GET` | `/api/v2/transcriber/english` | Clips needing an English translation. `?page`, `?limit` |
| `POST` | `/api/v2/transcriber/english` | Submit a translation. Rejects text identical to the prompt instruction |
| `GET` | `/api/v2/transcriber/profile` | Level, streak, badges, daily progress, leaderboard summary, queue depths |
| `PATCH` | `/api/v2/transcriber/profile` | Choose an avatar. Level requirement enforced server-side |

**Flagging** — `POST /api/v2/transcriber/submit` with `isFlagged: true` and a `flagReason` of
`NOISE`, `UNCLEAR`, `TOO_QUIET`, `WRONG_LANGUAGE`, `INCOMPLETE`, `INAPPROPRIATE` or `OTHER`.
`INAPPROPRIATE` denotes a content breach rather than a quality problem — see
[content moderation](content-moderation.md).

---

## Reviewer

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v2/reviewer/recordings` | Recordings awaiting review |
| `POST` | `/api/v2/reviewer/recordings/{id}/approve` | Approve audio |
| `POST` | `/api/v2/reviewer/recordings/{id}/reject` | Reject with a reason returned to the contributor |
| `GET` | `/api/v2/admin/review` | Transcriptions awaiting text review |

---

## Admin

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v2/admin/stats` | Platform statistics |
| `GET`/`POST` | `/api/v2/languages` | List / create languages |
| `GET`/`POST` | `/api/v2/countries` | List / create countries |
| `GET`/`POST` | `/api/v2/prompts` | List / create prompts |
| `POST` | `/api/v2/prompts/bulk` | Bulk prompt import from CSV |
| `GET`/`POST` | `/api/admin/users` | List / create users |
| `GET`/`POST` | `/api/v2/admin/payouts` | Payout management |
| `GET` | `/api/v2/admin/recordings` | All recordings, filterable |

---

## Dataset export — Indicator 6

Non-PII data leaves the system in open formats. Exports carry **anonymous speaker labels only**.

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/v2/admin/export?format=csv&languageId=…` | Pipe-delimited CSV |
| `GET` | `/api/v2/admin/export?format=json&languageId=…` | JSON |
| `GET` | `/api/v2/admin/export/corrected?format=csv` | Reviewer-approved corrected text |
| `GET` | `/api/v2/admin/export/audio?languageId=…` | ZIP: `wavs/` + `metadata.csv` (LJSpeech layout) |

Query parameters: `languageId`, `speakerId`, `includeTranscriptions`, `transcriptSource`
(`approved` \| `all`), `preview`.

Field definitions are in the [data dictionary](data-dictionary.md). A sample is at
[`sample-export.csv`](sample-export.csv).

**CLI equivalent**, for reproducible scripted builds:

```bash
npx tsx scripts/export-krio-dataset.ts --language=kri --out=./dataset.csv
```

---

## Data subject rights

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v2/account/export` | Download everything held about you, as JSON — data portability |
| `DELETE` | `/api/v2/account` | Delete your account and personal data |

---

## Audio access

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v2/audio/{recordingId}` | Signed URL for one recording (1-hour read expiry) |
| `GET` | `/api/v2/pipeline/audio?path=…` | Signed URL for pipeline audio |

**Audio is never served from a public bucket.** Every response is a short-lived signed URL scoped
to a single object.

---

## Leaderboard

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v2/leaderboard?period=today\|week\|month\|all` | Rankings. Scored on approved work only |

---

## Pipeline — external audio

For audio captured outside KACCP that needs machine-transcript correction.

| Method | Path | Purpose |
|---|---|---|
| `GET`/`POST` | `/api/v2/pipeline/review-queue` | List / push review items |
| `PATCH` | `/api/v2/pipeline/review-queue/{id}` | Submit a correction |
| `GET` | `/api/v2/pipeline/language-lead` | Items awaiting final verification |
| `GET`/`POST` | `/api/v2/pipeline/datasets` | Dataset versions |
| `GET`/`POST` | `/api/v2/pipeline/api-keys` | API keys for external ingestion |

---

**Related:** [Architecture](architecture.md) · [Data dictionary](data-dictionary.md) ·
[Deployment](deployment.md)
