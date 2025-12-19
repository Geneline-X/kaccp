# KACCP v2: Speech Synthesis Data Collection Platform

## Vision
Build a scalable platform for collecting **100-200 hours of high-quality, consented speech data** per language for TTS (Text-to-Speech) training.

---

## Core Architecture

```
COUNTRY (Sierra Leone, Guinea, Liberia...)
    │
    └── LANGUAGE (Krio, Mende, Temne, Susu, Mandingo...)
            │
            └── PROMPT (English text to translate)
                    │
                    └── RECORDING (speaker's voice, max 10 sec)
                            │
                            └── TRANSCRIPTION (written text by transcriber)
```

---

## Two Main Sections

### Section 1: Voice Recording (Educated Native Speakers)
- Speaker sees **English prompt**
- Speaker **translates and speaks** in their native language
- Records voice (max 10 seconds)
- Clean audio, no background noise

### Section 2: Transliteration (In-House Transcribers)
- Transcribers claim recordings
- Listen → Write exactly what was said (in the native language)
- Flag poor quality audio
- Submit for review

---

## User Roles

| Role | Access | What They Do |
|------|--------|--------------|
| **Admin** | Full | Manage countries, languages, prompts, users, export data |
| **Speaker** | Recording | Record voice clips for assigned language |
| **Transcriber** | Transcription | Write text for recordings, review others' work |

---

## Prompt System

### Translation-Based Approach

Speakers see **English text** and **translate + speak** in their native language.

**Why this works:**
- English prompts are unlimited and easy to create
- Natural variation (each speaker translates slightly differently)
- No pre-written target language text needed
- Transcriber captures exactly what was said

### Prompt Sources

1. **LJSpeech-style Dataset** (~2,000 diverse sentences)
   - Good phonetic coverage
   - Varied sentence structures
   
2. **Local Scenarios** (~1,000 Sierra Leone specific)
   - Market haggling: "How much for this fish?"
   - Greetings: "Good morning elder, how is your family?"
   - Transport: "Driver, stop at the junction"
   - Food: "The rice and cassava leaf is ready"
   - Local expressions and idioms

3. **Emotion Variations** (~500)
   - Same sentence with different emotions
   - Happy, sad, angry, questioning, excited

### Categories

| Category | Example English Prompts | Count |
|----------|------------------------|-------|
| **Greetings & Farewells** | "Good morning", "Goodbye", "See you later" | 150 |
| **Numbers & Money** | "One hundred", "The price is fifty thousand" | 200 |
| **Questions** | "What is your name?", "Where is the market?" | 300 |
| **Commands & Requests** | "Come here", "Please help me", "Wait for me" | 200 |
| **Emotions (Happy)** | "I am so happy!", "This is wonderful!" | 150 |
| **Emotions (Sad/Angry)** | "I am very sad", "This makes me angry" | 150 |
| **Daily Life** | "I'm going to work", "The food is ready" | 400 |
| **Market & Shopping** | "How much?", "Too expensive", "Give me discount" | 250 |
| **Directions & Places** | "Turn left", "Near the school", "Go straight" | 200 |
| **Family & People** | "My mother is home", "The children are playing" | 150 |
| **Health** | "I feel sick", "Where is the hospital?" | 150 |
| **Weather & Time** | "It's raining", "Tomorrow morning" | 100 |
| **Local Scenarios** | Sierra Leone specific situations | 500 |
| **Phonetic Coverage** | Words covering all sounds | 200 |
| **Conversations** | Short dialogue lines | 300 |

**Total: ~3,500 prompts**

### Bulk Import (CSV Format)

```csv
english_text,category,emotion,instruction,target_duration_sec
"Good morning, how are you?",GREETINGS,neutral,,5
"I am so happy to see you!",EMOTIONS,happy,"Say with excitement",4
"Where is the nearest market?",QUESTIONS,neutral,,5
"The price is too high, give me discount",MARKET,neutral,"Haggling tone",6
```

Admin can upload CSV with thousands of prompts at once.

---

## Database Schema

### New Models

```prisma
model Country {
  id        String     @id @default(cuid())
  code      String     @unique  // SL, GN, LR, etc.
  name      String               // Sierra Leone, Guinea, etc.
  isActive  Boolean    @default(true)
  languages Language[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

model Language {
  id                    String      @id @default(cuid())
  code                  String      @unique  // kri, men, tem, sus, etc.
  name                  String               // Krio, Mende, Temne, Susu
  nativeName            String?              // How it's called in the language
  countryId             String
  country               Country     @relation(fields: [countryId], references: [id])
  isActive              Boolean     @default(true)
  targetMinutes         Int         @default(6000)  // 100 hours = 6000 min
  collectedMinutes      Float       @default(0)
  approvedMinutes       Float       @default(0)
  speakerRatePerMinute  Float       @default(0.05)  // USD
  transcriberRatePerMin Float       @default(0.03)  // USD
  prompts               Prompt[]
  recordings            Recording[]
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt
}

model Prompt {
  id              String    @id @default(cuid())
  languageId      String
  language        Language  @relation(fields: [languageId], references: [id])
  
  // English text that speaker translates and speaks
  englishText     String
  category        String              // GREETINGS, EMOTIONS, MARKET, etc.
  emotion         String    @default("neutral")  // neutral, happy, sad, angry, question
  instruction     String?             // Extra guidance for speaker
  
  targetDurationSec Int     @default(5)  // Expected: 3-10 seconds
  isActive        Boolean   @default(true)
  timesRecorded   Int       @default(0)
  
  recordings      Recording[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([languageId, category])
  @@index([languageId, isActive])
}

model Recording {
  id              String    @id @default(cuid())
  promptId        String
  prompt          Prompt    @relation(fields: [promptId], references: [id])
  speakerId       String
  speaker         User      @relation("SpeakerRecordings", fields: [speakerId], references: [id])
  languageId      String
  language        Language  @relation(fields: [languageId], references: [id])
  
  // Audio file (stored in GCS: /{country}/{language}/recordings/{speakerId}/{id}.wav)
  audioUrl        String              // GCS URL
  durationSec     Float               // Max 10 seconds enforced
  fileSize        Int?
  sampleRate      Int?                // 48000 Hz target
  
  status          RecordingStatus     @default(PENDING_TRANSCRIPTION)
  
  // Quality flags (set by transcriber)
  isFlagged       Boolean   @default(false)
  flagReason      String?             // NOISE, UNCLEAR, TOO_QUIET, WRONG_LANGUAGE, etc.
  
  // Consent
  consentGiven    Boolean   @default(true)
  
  // Metadata
  deviceInfo      String?
  
  transcription   Transcription?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([languageId, status])
  @@index([speakerId])
}

model Transcription {
  id              String    @id @default(cuid())
  recordingId     String    @unique
  recording       Recording @relation(fields: [recordingId], references: [id])
  transcriberId   String
  transcriber     User      @relation("TranscriberWork", fields: [transcriberId], references: [id])
  
  text            String              // The written transcription
  
  status          TranscriptionStatus @default(PENDING_REVIEW)
  
  // Review
  reviewerId      String?
  reviewer        User?     @relation("ReviewerWork", fields: [reviewerId], references: [id])
  reviewedAt      DateTime?
  reviewNotes     String?
  
  // Quality voting
  upvotes         Int       @default(0)
  downvotes       Int       @default(0)
  
  submittedAt     DateTime  @default(now())
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([transcriberId])
  @@index([status])
}

// Assignment for transcribers (claim system)
model TranscriptionAssignment {
  id            String    @id @default(cuid())
  recordingId   String
  userId        String
  expiresAt     DateTime
  releasedAt    DateTime?
  createdAt     DateTime  @default(now())
  
  @@index([userId, releasedAt])
  @@index([expiresAt])
}

enum RecordingStatus {
  PENDING_TRANSCRIPTION   // Waiting for transcriber
  TRANSCRIBED             // Has transcription, pending review
  APPROVED                // Ready for export
  REJECTED                // Quality issues
  FLAGGED                 // Needs admin attention
}

enum TranscriptionStatus {
  PENDING_REVIEW
  APPROVED
  REJECTED
  NEEDS_EDIT
}
```

### Updated User Model

```prisma
model User {
  // ... existing fields ...
  
  // New role field (replaces simple ADMIN/TRANSCRIBER)
  role              UserRole    @default(SPEAKER)
  
  // Language capabilities
  speaksLanguages   String[]    // Language codes they can speak
  writesLanguages   String[]    // Language codes they can write
  
  // Stats
  totalRecordingsSec  Float     @default(0)
  totalTranscriptions Int       @default(0)
  qualityScore        Float     @default(0)
  
  // Relations
  speakerRecordings   Recording[]      @relation("SpeakerRecordings")
  transcriberWork     Transcription[]  @relation("TranscriberWork")
  reviewerWork        Transcription[]  @relation("ReviewerWork")
}

enum UserRole {
  ADMIN
  SPEAKER
  TRANSCRIBER
  REVIEWER        // Can do both transcription and review
}
```

---

## Google Cloud Storage Structure

All recordings organized by country and language:

```
gs://{GCS_BUCKET}/
├── sierra-leone/
│   ├── krio/
│   │   ├── recordings/
│   │   │   ├── {speakerId}/
│   │   │   │   ├── {recordingId}.wav
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── exports/
│   │       └── krio_tts_dataset_v1/
│   │           ├── metadata.csv
│   │           └── wavs/
│   ├── mende/
│   │   └── ...
│   └── temne/
│       └── ...
├── guinea/
│   ├── susu/
│   └── mandingo/
└── ...
```

### File Naming Convention
- Recording: `{country}/{language}/recordings/{speakerId}/{recordingId}.wav`
- Export: `{country}/{language}/exports/{dataset_name}/`

---

## Page Structure

### Public
- `/` - Landing page
- `/login` - Login
- `/register` - Register (select role, languages)

### Speaker Dashboard (`/speaker`)
- `/speaker` - Dashboard (stats, available prompts)
- `/speaker/record` - Recording interface
- `/speaker/history` - Past recordings

### Transcriber Dashboard (`/transcriber`)
- `/transcriber` - Dashboard (stats, available work)
- `/transcriber/task/[id]` - Transcription interface
- `/transcriber/history` - Past transcriptions

### Admin Dashboard (`/admin`)
- `/admin` - Overview stats
- `/admin/countries` - Manage countries
- `/admin/languages` - Manage languages
- `/admin/prompts` - Manage prompt templates & prompts
- `/admin/prompts/import` - Bulk import prompts
- `/admin/recordings` - View all recordings
- `/admin/transcriptions` - Review transcriptions
- `/admin/users` - Manage users
- `/admin/export` - Export approved data

---

## Implementation Phases

### Phase 1: Core Platform (Week 1-2)

#### 1.1 Database Migration
- [ ] Create new schema (Country, Language, Prompt, Recording, Transcription)
- [ ] Update User model with new roles (ADMIN, SPEAKER, TRANSCRIBER)
- [ ] Add TranscriptionAssignment for claim system
- [ ] Fresh start (new database)

#### 1.2 Remove Old Code
- [ ] Remove OpenAI integration (`src/lib/ai.ts`)
- [ ] Remove old AudioSource/AudioChunk models from schema
- [ ] Clean up old API routes
- [ ] Keep useful code (auth, GCS, payments)

#### 1.3 Admin: Country & Language Management
- [ ] CRUD API for countries
- [ ] CRUD API for languages (under countries)
- [ ] Admin UI for country/language management
- [ ] Set target hours, rates per language

#### 1.4 Admin: Prompt Management
- [ ] Create prompts (English text + category + emotion)
- [ ] **Bulk CSV import** for thousands of prompts
- [ ] Categories: GREETINGS, EMOTIONS, MARKET, HEALTH, etc.
- [ ] Prompt listing with filters

#### 1.5 Speaker: Recording Interface
- [ ] Show English prompt with emotion/instruction
- [ ] Audio recorder (Web Audio API, 48kHz)
- [ ] **10 second max limit** (auto-stop)
- [ ] Playback before submit
- [ ] Upload to GCS (organized by country/language/speaker)
- [ ] Recording history & stats

#### 1.6 Transcriber: Transcription Interface
- [ ] Claim recording (assignment system, 15 min timeout)
- [ ] Audio player with speed control (0.5x, 1x, 1.5x)
- [ ] Text input for transcription
- [ ] **Flag poor audio** (noise, unclear, wrong language)
- [ ] Submit transcription
- [ ] Transcription history & stats

#### 1.7 Admin: Review Interface
- [ ] View audio + transcription pairs
- [ ] See English prompt for context
- [ ] Approve/Reject
- [ ] View flagged recordings

#### 1.8 Export
- [ ] Export approved pairs (audio + text)
- [ ] LJSpeech-compatible format (metadata.csv + wavs/)
- [ ] Filter by language, speaker, date

### Phase 2: Quality & Scale (Week 3-4)

- [ ] Progress dashboards per language (collected vs target hours)
- [ ] Speaker stats (recordings, approval rate)
- [ ] Transcriber stats (transcriptions, accuracy)
- [ ] Bulk prompt import improvements (validation, preview)
- [ ] Payment tracking per user

---

## Environment Variables (Already Have)

```env
# Database
DATABASE_URL=

# Google Cloud Storage
GCS_BUCKET=
GCS_CREDENTIALS_JSON=
GCS_SERVICE_ACCOUNT_JSON=

# Auth
JWT_SECRET=
MASTER_ADMIN_EMAIL=
MASTER_ADMIN_PASSWORD=
MASTER_ADMIN_NAME=

# Assignment settings
ASSIGNMENT_MINUTES=15
MAX_ACTIVE_ASSIGNMENTS=1
CLAIM_COOLDOWN_SECONDS=30

# File uploads
UPLOADTHING_SECRET=
UPLOADTHING_APP_ID=
UPLOADTHING_TOKEN=

# Worker (may not need for v2)
WORKER_URL=
WEBHOOK_AUTH_TOKEN=
```

---

## Export Format

Final output for TTS training:

```
export/
├── krio/
│   ├── metadata.csv
│   │   └── file_name,text,duration_sec,speaker_id
│   ├── wavs/
│   │   ├── kri_00001.wav
│   │   ├── kri_00002.wav
│   │   └── ...
│   └── transcripts.txt
│       └── kri_00001|Aw di bodi?
│       └── kri_00002|A de go na makit
├── mende/
│   └── ...
└── manifest.json
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Hours per language | 100-200 hours |
| Clip duration | 3-10 seconds |
| Approval rate | >90% |
| Audio quality | 48kHz, 16-bit, clean |
| Languages (Phase 1) | 3 (Krio, Mende, Temne) |
| Languages (Phase 2) | 6+ (add Guinea languages) |

---

## Ready to Build!

This plan is ready for implementation. Start with Phase 1.1 (Database Migration).
