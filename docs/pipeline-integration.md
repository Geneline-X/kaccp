# Flot Data Pipeline — Integration Guide

## What Was Built

Five database models + twelve API endpoints + three domain services + four admin UI pages for the capture → triage → review → versioning → export loop.

## Schema (already pushed to DB)

| Model | Purpose |
|---|---|
| `ApiKey` | Service-to-service auth keys (sha256 hashed) |
| `AudioSession` | Every Flot voice interaction logged here |
| `ReviewQueue` | Triage → KACCP correction items |
| `DatasetVersion` | Versioned training snapshots with lineage |
| `AnnotationRule` | Living annotation standard, API-queryable |

## Auth Model

- **Service endpoints** (`POST /api/v2/pipeline/sessions`): API key auth via `Authorization: Bearer <key>`
- **Admin/Reviewer endpoints**: JWT auth (existing KACCP auth)

API keys are stored in the `ApiKey` table (sha256 hashed). Admin creates/revokes keys via UI or API.

## API Endpoints

All under `/api/v2/pipeline/`.

### 1. Capture — Flot Integration

**`POST /api/v2/pipeline/sessions`**

Requires API key: `Authorization: Bearer kaccp_sk_<hex>`.

Your Go gateway builds the audio path, uploads audio to GCS, then sends the session.

**GCS audio path template:**

```
gs://{bucket}/pipeline/{service}/{date}/{sessionId}.wav
```

`{service}` identifies the source — use whatever client name you want:

| Service | Example path |
|---|---|
| Flot production | `gs://bucket/pipeline/flot/2026-06-21/550e8400.wav` |
| E2E testing | `gs://bucket/pipeline/e2e-test/2026-06-21/550e8401.wav` |
| Manual test | `gs://bucket/pipeline/manual/2026-06-21/550e8402.wav` |
| Third-party client | `gs://bucket/pipeline/acme-corpo/2026-06-21/550e8403.wav` |

Your Go service uploads the raw audio there first, then sends the full `gs://` URI as `audioPath`.

Flot calls this on every voice-note interaction:

```json
{
  "sessionId": "flot-uuid-123",
  "userIdHash": "sha256-of-phone-number",
  "audioPath": "gs://bucket/pipeline/flot/2026-06-21/550e8400.wav",
  "audioDurationS": 4.2,
  "asrTranscript": "A wan send 500 leones",
  "asrConfidence": 0.72,
  "detectedIntent": "send_money",
  "extractedFields": {
    "amount": "500",
    "recipient": "Mariama",
    "channel": "Orange Money"
  },
  "outcome": "success",
  "deviceInfo": "whatsapp/android"
}
```

**Response:**
```json
{
  "session": { "id": "cm7...", "sessionId": "flot-uuid-123" },
  "triage": {
    "tier": 3,
    "reason": "High confidence, successful — sample rate review",
    "shouldReview": false
  }
}
```

**Triage logic (outcome-first, confidence optional):**

| Tier | Trigger | Action |
|---|---|---|
| 1 — Critical | Failed transaction + high amount | Review within 24h |
| 2 — Standard | Failed/retry, or low ASR confidence | Review weekly batch |
| 3 — Sample | Success + high confidence | Random 5-10% audit |
| 4 — Disagreement | Double-verification mismatch | Escalate to language lead |

If triage returns `shouldReview: true`, the endpoint automatically pushes a `ReviewQueue` item.

### 2. Audio Playback for Pipeline Items

**`GET /api/v2/pipeline/audio?path=gs://bucket/pilot/audio/abc.wav`**

Returns a signed GCS URL for audio playback. Admin/Reviewer JWT required.

### 3. Review — KACCP Integration

**`GET /api/v2/pipeline/review-queue?status=pending&tier=1&page=1&limit=50`**

Lists review items sorted by priority (Tier 1 first). Admin/Reviewer JWT required.

**`PATCH /api/v2/pipeline/review-queue/[id]`**

Submit a correction (first pass) or double-verification (second pass):

```json
// First correction
{ "correctedTranscript": "A wan send 500 leones" }

// Second correction (triggers disagreement check)
{ "correctedTranscript": "A wan sen 500 leones" }
```

If the two corrections differ, `disagreementFlag` is set to `true` and status goes to `pending` (language lead escalation).

### 4. Dataset Versioning — Admin

**`POST /api/v2/pipeline/datasets`**

Merges all `corrected` reviews into a new version (`krio_asr_v1`, `krio_asr_v2`...). Admin JWT required.

**`POST /api/v2/pipeline/datasets/[id]/merge`**

Appends newly corrected reviews into an existing version.

**`POST /api/v2/pipeline/datasets/[id]/export`**

Exports version as LJSpeech CSV or JSON to `gs://bucket/datasets/krio_asr_v3/krio_asr_v3_metadata.csv`.

```json
{ "format": "ljspeech" }
```

**`PATCH /api/v2/pipeline/datasets/[id]`**

Update version status (draft → training → evaluated → promoted), eval WER, model artifact path.

### 5. Annotation Rules — KACCP Reviewers

**`GET /api/v2/pipeline/annotation-rules?category=spelling&activeOnly=true`**

Returns all rules. Admin/Reviewer JWT required.

**`POST /api/v2/pipeline/annotation-rules`** — Create a new rule (language lead).

**`PATCH /api/v2/pipeline/annotation-rules/[id]`** — Update a rule.

### 6. API Key Management — Admin

**`GET /api/v2/pipeline/api-keys`** — List all keys (prefix, name, status, last used). Admin JWT.

**`POST /api/v2/pipeline/api-keys`** — Create a new key:

```json
{ "name": "flot-prod" }
```

Response (key shown once):
```json
{
  "key": "kaccp_sk_a1b2c3d4e5f6...",
  "prefix": "kaccp_sk_a1b2"
}
```

**`PATCH /api/v2/pipeline/api-keys/[id]`** — Revoke or reactivate:

```json
{ "isActive": false }
```

## Admin UI Pages

All under `/admin/v2/pipeline/` (accessible from admin sidebar nav):

| Page | URL | What it does |
|---|---|---|
| **Pipeline Review** | `/admin/v2/pipeline/review` | Left = queue list (filterable by tier). Right = audio player + ASR transcript + textarea for correction. Double-verification: second correction auto-compares and flags disagreements |
| **Datasets** | `/admin/v2/pipeline/datasets` | Lists all versions with hours/session metrics. Buttons: Merge, Export (LJSpeech/JSON), Mark Training, Promote to Production |
| **Annotation Rules** | `/admin/v2/pipeline/annotation-rules` | Collapsible cards for all 11 rules + financial dictionary. Filter by category, show inactive |
| **API Keys** | `/admin/v2/pipeline/api-keys` | Create keys (shown once), list with prefix/status/last-used, revoke/reactivate |

## Seed Data

```bash
node scripts/seed-annotation-rules.js
```

Seeds 11 annotation rules + financial spelling dictionary into the `annotation_rules` table. Run once after deploy.

## Deploy Checklist

1. **Schema** — Already pushed (`npx prisma db push`)
2. **Seed** — `node scripts/seed-annotation-rules.js`
3. **API key** — `POST /api/v2/pipeline/api-keys` with `{"name": "flot-prod"}` → gives you the key
4. **Give key to Flot** — They send `Authorization: Bearer kaccp_sk_<hex>` on every `POST /sessions`
5. **Start pilot** — Flot sends voice sessions, triage pushes to review queue, admins/reviewers correct via Pipeline Review page, weekly merge → new dataset version, export to GCS for retraining

## Data Flow Summary

```
Flot voice interaction
  │
  ▼
POST /api/v2/pipeline/sessions  ← API key auth
  │
  ├── AudioSession created
  └── Triage → ReviewQueue (if needed)
        │
        ▼
Admin UI: /admin/v2/pipeline/review  ← JWT auth
  │  Play audio → correct transcript → submit
  │  (double-verification for Tier 1)
  │
  ▼
POST /api/v2/pipeline/datasets  ← Admin only
  │  Merge corrected reviews → krio_asr_vN
  │
  ▼
POST /api/v2/pipeline/datasets/[id]/export
  │  → gs://bucket/datasets/krio_asr_v3/metadata.csv
  │
  ▼
ASR/TTS retraining pipeline
```
