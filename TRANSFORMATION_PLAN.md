# KACCP Transformation Plan: Consented Voice Data Collection Platform

## Executive Summary

Transform KACCP from a **YouTube audio transcription tool** into a **consented voice data collection platform** for building ASR (Automatic Speech Recognition) and TTS (Text-to-Speech) models for 2000+ low-resource African languages.

---

## Current State Analysis

### What We Have
- **Next.js 15** application with PostgreSQL (Prisma ORM)
- **Google Cloud Storage** integration for audio files
- **User authentication** system (JWT-based, roles: ADMIN, TRANSCRIBER)
- **Audio chunk workflow**: Claim → Transcribe → Review → Approve
- **Payment system**: Earnings tracking, wallet, payouts
- **Leaderboard** and gamification elements
- **UploadThing** integration for file uploads

### What Needs to Change
| Current | New |
|---------|-----|
| YouTube audio → Transcription | User records voice → Validation |
| Admin uploads audio chunks | System provides prompts, users record |
| Transcribers listen & type | Contributors speak & record |
| OpenAI for English correction | Remove (not good for African languages) |
| Single language (Krio→English) | Multi-language support (18+ languages) |
| AudioSource → AudioChunk model | Prompt → Recording → Validation model |

---

## The Core Problem to Solve

**Languages like Krio, Mende, Temne have no standardized written form.**

Most speakers can speak but cannot read/write their language. This means:
1. We **cannot** use the Mozilla Common Voice approach (read sentences aloud)
2. We need **alternative prompt methods** that don't require reading

---

## Proposed Solution: Multi-Modal Prompt System

### Prompt Types for Non-Written Languages

#### 1. **Audio Prompts (Primary Method)**
- Pre-recorded audio in the target language
- User listens and **repeats** what they hear
- Works for speakers who can't read
- Quality: High (controlled vocabulary)

#### 2. **Image/Picture Prompts**
- Show an image (e.g., "a woman cooking")
- User describes what they see in their language
- Generates spontaneous speech
- Quality: Medium (varied but natural)

#### 3. **Scenario Prompts**
- Text description in a language they CAN read (English/French)
- "Describe how to greet an elder in your village"
- User speaks naturally in target language
- Quality: Medium-High (culturally relevant)

#### 4. **Translation Prompts** (for bilingual speakers)
- Show English/French sentence
- User translates by speaking in target language
- Creates parallel corpus (valuable for MT)
- Quality: High (aligned data)

#### 5. **Conversation Prompts**
- Paired recording sessions
- Two users have a guided conversation
- Generates natural dialogue data
- Quality: High (spontaneous, natural)

---

## New Data Model

### Core Entities

```
┌─────────────────────────────────────────────────────────────────┐
│                         LANGUAGE                                 │
├─────────────────────────────────────────────────────────────────┤
│ id, code (ISO 639-3), name, nativeName, country, region         │
│ hasWrittenForm, scriptType, status (ACTIVE/COMING_SOON)         │
│ targetMinutes, collectedMinutes, validatedMinutes               │
│ speakerIncentivePerMin, transcriberIncentivePerMin, lcafFactor  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          PROMPT                                  │
├─────────────────────────────────────────────────────────────────┤
│ id, languageId                                                  │
│ type: AUDIO_REPEAT | IMAGE_DESCRIBE | SCENARIO | TRANSLATION    │
│ contentText (scenario description or translation source)        │
│ contentAudioUrl (for AUDIO_REPEAT - what to repeat)             │
│ contentImageUrl (for IMAGE_DESCRIBE - what to describe)         │
│ expectedDurationSec (target: 3-10 seconds)                      │
│ category (GREETING/NUMBERS/FOOD/DIRECTIONS/EMOTIONS/etc.)       │
│ status (ACTIVE/DISABLED), timesRecorded                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RECORDING                                 │
├─────────────────────────────────────────────────────────────────┤
│ id, promptId, speakerId, languageId                             │
│ audioUrl, durationSec (target: 3-10 sec), fileSize, sampleRate  │
│ status: PENDING_TRANSCRIPTION | TRANSCRIBED | APPROVED | REJECTED│
│ hasBackgroundNoise, hasSilenceGaps (quality flags)              │
│ consentGiven, consentTimestamp                                  │
│ deviceType, browser (metadata)                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TRANSCRIPTION                               │
├─────────────────────────────────────────────────────────────────┤
│ id, recordingId, transcriberId                                  │
│ text (exactly what was said in the recording)                   │
│ status: PENDING_REVIEW | APPROVED | REJECTED                    │
│ submittedAt, reviewedAt                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        REVIEW                                    │
├─────────────────────────────────────────────────────────────────┤
│ id, transcriptionId, reviewerId                                 │
│ decision: APPROVED | REJECTED | EDITED                          │
│ editedText (if reviewer corrected transcription)                │
│ issues (AUDIO_MISMATCH/SPELLING/INCOMPLETE/NOISE/etc.)          │
│ notes                                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPROVED PAIR (TTS Ready)                     │
├─────────────────────────────────────────────────────────────────┤
│ Audio file (3-10 sec, clean, no silence gaps)                   │
│ + Transcription text (exact match)                              │
│ = Ready for TTS training export                                 │
└─────────────────────────────────────────────────────────────────┘
```

### User Profile Extensions

```
User {
  ...existing fields...
  + nativeLanguages: Language[]      // Languages they speak natively
  + fluentLanguages: Language[]      // Languages they're fluent in
  + country: Country
  + region: String                   // For dialect tracking
  + gender: MALE/FEMALE/OTHER/PREFER_NOT_TO_SAY
  + ageRange: 18-25/26-35/36-45/46-55/56+
  + deviceType: String               // For audio quality tracking
  + totalRecordingsSec: Int
  + totalValidations: Int
  + recordingQualityScore: Float     // Based on validation outcomes
}
```

---

## User Flows

### Three User Roles

| Role | What They Do | Skills Needed | Payment |
|------|--------------|---------------|----------|
| **Speaker** | Records voice clips | Speaks the language | Per recording |
| **Transcriber** | Writes what was said | Can write the language | Per transcription |
| **Reviewer** | Validates audio+text pairs | Speaks & writes | Per review |

### Flow 1: Speaker Records Voice

```
1. Login/Register
   └─> Select native language(s)
   └─> Accept consent agreement (CC0 license)
   └─> Complete profile (age, gender, region)

2. Dashboard
   └─> See available prompts
   └─> See personal stats (recordings, earnings)
   └─> See leaderboard

3. Record Session (target: 3-10 second clips)
   └─> System shows prompt (audio/image/scenario/translation)
   └─> User clicks "Record"
   └─> User speaks (short, natural phrase)
   └─> User clicks "Stop"
   └─> System auto-trims silence
   └─> User can:
       - Play back
       - Re-record
       - Submit
       - Skip prompt
   └─> Earn incentive credit
```

### Flow 2: Transcriber Writes Text

```
1. Claim Recording
   └─> See list of recordings needing transcription
   └─> Claim one (locked for X minutes)

2. Transcribe
   └─> Listen to audio (can replay, slow down)
   └─> Type exactly what was said
   └─> Submit transcription
   └─> Earn incentive credit

3. Quality Metrics
   └─> Transcription accuracy tracked
   └─> High-quality transcribers get priority
```

### Flow 3: Reviewer Validates Pairs

```
1. Review Queue
   └─> See audio + transcription pairs
   └─> Listen to audio
   └─> Read transcription

2. Decision
   └─> APPROVE: Audio matches text, good quality
   └─> REJECT: Mismatch, noise, or errors
   └─> EDIT: Fix minor transcription errors

3. Approved pairs → Ready for TTS export
```

### Flow 4: Admin Manages Platform

```
1. Language Management
   └─> Add new language
   └─> Set incentive rates (based on LCAF)
   └─> Set target hours
   └─> Enable/disable languages

2. Prompt Management
   └─> Upload audio prompts (for AUDIO_REPEAT)
   └─> Upload image prompts (for IMAGE_DESCRIBE)
   └─> Create scenario/translation prompts
   └─> Bulk import prompts

3. Quality Control
   └─> Review flagged recordings
   └─> Monitor transcriber accuracy
   └─> Export validated datasets (audio + text pairs)
   └─> Monitor progress by language
```

---

## Technical Implementation Plan

### Phase 1: Core Infrastructure (Week 1-2)

#### 1.1 Database Schema Migration
```prisma
// New models to add
model Language {
  id                    String      @id @default(cuid())
  code                  String      @unique  // ISO 639-3
  name                  String               // English name
  nativeName            String?              // Name in the language
  country               String               // Primary country
  region                String?              // Region/dialect area
  hasWrittenForm        Boolean     @default(false)
  scriptType            String?              // Latin, Arabic, etc.
  status                LanguageStatus @default(COMING_SOON)
  targetMinutes         Int         @default(18000) // 300 hours
  incentivePerMinute    Float       @default(0.0415) // USD
  lcafFactor            Float       @default(1.0)
  
  prompts               Prompt[]
  recordings            Recording[]
  userNative            User[]      @relation("NativeLanguages")
  userFluent            User[]      @relation("FluentLanguages")
  
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt
}

model Prompt {
  id                    String      @id @default(cuid())
  languageId            String
  language              Language    @relation(fields: [languageId], references: [id])
  
  type                  PromptType
  contentText           String?              // For text-based prompts
  contentAudioUrl       String?              // For audio prompts
  contentImageUrl       String?              // For image prompts
  referenceAudioUrl     String?              // Expected pronunciation
  
  expectedDurationSec   Int         @default(5)
  difficulty            Difficulty  @default(EASY)
  category              String?              // Topical category
  
  status                PromptStatus @default(ACTIVE)
  timesRecorded         Int         @default(0)
  timesValidated        Int         @default(0)
  
  recordings            Recording[]
  
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt
}

model Recording {
  id                    String      @id @default(cuid())
  promptId              String
  prompt                Prompt      @relation(fields: [promptId], references: [id])
  userId                String
  user                  User        @relation(fields: [userId], references: [id])
  languageId            String
  language              Language    @relation(fields: [languageId], references: [id])
  
  audioUrl              String
  durationSec           Float
  fileSize              Int
  sampleRate            Int?
  
  status                RecordingStatus @default(PENDING)
  validationCount       Int         @default(0)
  upvotes               Int         @default(0)
  downvotes             Int         @default(0)
  
  // Consent tracking
  consentGiven          Boolean     @default(false)
  consentTimestamp      DateTime?
  consentVersion        String?
  
  // Device metadata
  deviceType            String?
  browser               String?
  
  validations           Validation[]
  
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt
}

model Validation {
  id                    String      @id @default(cuid())
  recordingId           String
  recording             Recording   @relation(fields: [recordingId], references: [id])
  validatorId           String
  validator             User        @relation(fields: [validatorId], references: [id])
  
  decision              ValidationDecision
  issues                String[]             // Array of issue codes
  transcription         String?              // Optional transcription
  notes                 String?
  
  createdAt             DateTime    @default(now())
}

enum LanguageStatus {
  ACTIVE
  COMING_SOON
  DISABLED
}

enum PromptType {
  AUDIO_REPEAT      // Listen and repeat
  IMAGE_DESCRIBE    // Describe an image
  SCENARIO          // Respond to a scenario
  TRANSLATION       // Translate from another language
  FREE_SPEECH       // Speak freely on a topic
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}

enum PromptStatus {
  ACTIVE
  DISABLED
  ARCHIVED
}

enum RecordingStatus {
  PENDING
  VALIDATED
  REJECTED
  FLAGGED
}

enum ValidationDecision {
  VALID
  INVALID
  SKIP
}
```

#### 1.2 Remove OpenAI Dependency
- Remove `src/lib/ai.ts`
- Remove OpenAI from `package.json`
- Remove AI improvement feature from transcription flow
- Update API routes that use AI

#### 1.3 Update User Model
```prisma
model User {
  // ... existing fields ...
  
  // New fields
  gender                String?
  ageRange              String?
  nativeLanguages       Language[] @relation("NativeLanguages")
  fluentLanguages       Language[] @relation("FluentLanguages")
  totalRecordingsSec    Int        @default(0)
  totalValidations      Int        @default(0)
  recordingQualityScore Float      @default(0)
  
  recordings            Recording[]
  validations           Validation[]
}
```

### Phase 2: Recording Workflow (Week 2-3)

#### 2.1 New Pages
- `/contributor` - Main dashboard for voice contributors
- `/contributor/record` - Recording interface
- `/contributor/validate` - Validation interface
- `/contributor/profile` - Extended profile with language settings

#### 2.2 Recording Interface Components
```
RecordingPage
├── PromptDisplay
│   ├── AudioPrompt (with play button)
│   ├── ImagePrompt (with image display)
│   └── TextPrompt (for literate users)
├── AudioRecorder
│   ├── RecordButton
│   ├── WaveformVisualizer
│   ├── Timer
│   └── PlaybackControls
├── SubmissionControls
│   ├── ReRecordButton
│   ├── SkipButton
│   └── SubmitButton
└── SessionStats
    ├── RecordingsThisSession
    ├── TotalEarnings
    └── ProgressBar
```

#### 2.3 Audio Recording API
- Use Web Audio API for browser recording
- Target: 48kHz sample rate, 16-bit PCM (high quality for TTS)
- Store as WAV (lossless) for training, MP3 for playback
- Upload directly to GCS via signed URLs

#### 2.4 TTS Audio Quality Requirements

**Critical for TTS training - audio must be clean:**

| Requirement | Target | How to Enforce |
|-------------|--------|----------------|
| **Duration** | 3-10 seconds | UI timer, auto-stop at 10s |
| **Sample Rate** | 48kHz | Web Audio API config |
| **Bit Depth** | 16-bit | WAV format |
| **Silence** | <300ms gaps | Auto-trim + detection |
| **Background Noise** | Minimal | Recording tips, rejection |
| **Volume** | Consistent | Normalize on server |

**Auto-processing pipeline:**
```
Record → Trim silence → Check duration → Normalize volume → Upload
         (leading/    (reject if     (peak normalize
          trailing)    <1s or >10s)   to -3dB)
```

**Quality flags on Recording:**
- `hasBackgroundNoise`: Detected ambient noise
- `hasSilenceGaps`: Internal pauses >300ms
- `isClipped`: Audio clipping detected
- `isTooQuiet`: Peak volume too low

Recordings with quality issues can still be submitted but are flagged for review.

### Phase 3: Transcription System (Week 3-4)

#### 3.1 Transcriber Interface
```
TranscriberPage
├── RecordingPlayer
│   ├── AudioPlayer (with speed control: 0.5x, 1x, 1.5x)
│   ├── WaveformDisplay
│   └── ReplayButton
├── PromptContext (what the speaker was asked to say)
├── TranscriptionInput
│   ├── TextArea (for typing transcription)
│   ├── CharacterCount
│   └── LanguageKeyboard (special characters if needed)
├── SubmissionControls
│   ├── SubmitButton
│   ├── SkipButton (can't transcribe)
│   └── FlagButton (audio has issues)
└── SessionStats
    ├── TranscribedThisSession
    └── EarningsToday
```

#### 3.2 Transcription Workflow
1. Transcriber claims a recording (locked for 10 minutes)
2. Listens to audio (can replay, slow down)
3. Types exactly what was said
4. Submits → Recording moves to PENDING_REVIEW
5. Transcriber earns credit

#### 3.3 Review Interface (Admin/Reviewer)
```
ReviewPage
├── AudioPlayer (the recording)
├── TranscriptionDisplay (what transcriber wrote)
├── PromptContext (what was asked)
├── DecisionButtons
│   ├── ApproveButton (audio matches text perfectly)
│   ├── EditButton (minor fixes needed)
│   └── RejectButton (major issues)
├── EditableText (if editing)
├── IssueSelector (if rejecting)
│   ├── AudioTextMismatch
│   ├── SpellingErrors
│   ├── IncompleteTranscription
│   ├── BackgroundNoise
│   └── SilenceGaps
└── Notes (optional feedback)
```

#### 3.4 Review Logic
- Each transcription needs 1 review (by admin or trained reviewer)
- APPROVED → Recording + Text pair ready for export
- EDITED → Reviewer's corrected text becomes final
- REJECTED → Recording goes back to transcription queue or is discarded

### Phase 4: Admin & Export (Week 4-5)

#### 4.1 Admin Dashboard Updates
- Language management CRUD
- Prompt management (bulk upload)
- Recording quality monitoring
- Export validated datasets

#### 4.2 Dataset Export Format
```
export/
├── krio/
│   ├── metadata.json
│   ├── audio/
│   │   ├── kri_001.wav
│   │   ├── kri_002.wav
│   │   └── ...
│   └── transcripts.tsv (if available)
├── mende/
│   └── ...
└── manifest.json
```

---

## Language Expansion Roadmap

### Phase 1: Sierra Leone (Months 1-3)
| Language | Code | Target Hours | Est. Cost |
|----------|------|--------------|-----------|
| Krio | kri | 100 | $249 |
| Mende | men | 100 | $249 |
| Temne | tem | 100 | $249 |
| **Subtotal** | | **300 hrs** | **$747** |

### Phase 2: Guinea Languages in SL (Months 2-4)
| Language | Code | Target Hours | Est. Cost |
|----------|------|--------------|-----------|
| Pular (Fula) | fuf | 100 | $336 |
| Maninka | emk | 100 | $336 |
| Susu | sus | 100 | $336 |
| **Subtotal** | | **300 hrs** | **$1,008** |

### Phase 3: Regional Expansion (Months 4-12)
Follow the country expansion plan in the original table.

---

## Consent & Legal Framework

### Consent Agreement (CC0)
Every contributor must agree to:
1. Their voice recordings become public domain (CC0)
2. Recordings may be used for AI/ML training
3. They are the speaker in the recording
4. They are 18+ years old
5. They understand recordings are permanent

### Data Collection
- No PII in recordings
- Demographic data is optional and anonymized
- User can delete account (but recordings remain as CC0)

---

## Incentive Structure

### Recording Incentives
| Country | LCAF | Rate/Min (USD) | Rate/Hour (USD) |
|---------|------|----------------|-----------------|
| Sierra Leone | 1.00 | $0.0415 | $2.49 |
| Guinea | 1.35 | $0.0560 | $3.36 |
| Liberia | 0.90 | $0.0374 | $2.24 |
| Mali | 1.05 | $0.0436 | $2.62 |
| Ivory Coast | 1.60 | $0.0664 | $3.98 |
| Nigeria | 2.20 | $0.0913 | $5.48 |
| Ghana | 1.80 | $0.0747 | $4.48 |

### Validation Incentives
- 50% of recording rate per validated clip
- Bonus for high-accuracy validators

### Quality Bonuses
- +20% for recordings with 100% validation rate
- +10% for completing daily goals

---

## Technical Requirements

### Audio Quality Standards
- Sample rate: 16kHz minimum (48kHz preferred)
- Bit depth: 16-bit
- Format: WAV/FLAC for storage, MP3 for playback
- Max duration: 10 seconds per recording
- Min duration: 1 second

### Browser Support
- Chrome 80+ (best Web Audio API support)
- Firefox 75+
- Safari 14+
- Edge 80+

### Mobile Optimization
- PWA support for offline recording
- Responsive design
- Touch-friendly controls

---

## Migration Strategy

### Data to Keep
- User accounts
- Payment/wallet history
- Leaderboard data

### Data to Archive
- Old AudioSource records
- Old AudioChunk records
- Old Transcription records

### New Tables
- Language
- Prompt
- Recording
- Validation

---

## Success Metrics

### Primary KPIs
1. **Hours Collected** per language
2. **Validation Rate** (% of recordings validated)
3. **Quality Score** (% of recordings approved)
4. **Contributor Retention** (weekly active users)

### Secondary KPIs
1. Average recording duration
2. Recordings per session
3. Time to validation
4. Cost per validated hour

---

## Next Steps

1. **Review this plan** and provide feedback
2. **Approve schema changes** before implementation
3. **Prioritize features** for MVP
4. **Begin Phase 1** implementation

---

## Questions to Resolve

1. **Prompt sourcing**: Where will audio prompts come from initially?
   - Option A: Record prompts with native speakers in-house
   - Option B: Use existing Krio audio from YouTube (for prompts only)
   - Option C: Start with image/scenario prompts

2. **Transcription**: Should we collect transcriptions?
   - For Krio: Yes (has written form)
   - For Mende/Temne: Optional (limited literacy)

3. **Dialect handling**: How to track regional variations?
   - Add region field to recordings
   - Let users self-identify dialect

4. **Quality control**: Who validates recordings?
   - Other contributors (crowdsourced)
   - Trained validators (paid)
   - Hybrid approach

5. **Payment method**: How to pay contributors?
   - Orange Money (current)
   - Mobile money (MTN, Airtel)
   - Bank transfer
   - Crypto (for international)

---

*Document Version: 1.0*
*Last Updated: December 2024*
*Author: Cascade AI Assistant*
