-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SPEAKER', 'TRANSCRIBER', 'REVIEWER');

-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('PENDING_REVIEW', 'PENDING_TRANSCRIPTION', 'TRANSCRIBED', 'APPROVED', 'REJECTED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'SLE', 'GNF', 'LRD');

-- CreateEnum
CREATE TYPE "PromptCategory" AS ENUM ('GREETINGS', 'NUMBERS_MONEY', 'QUESTIONS', 'COMMANDS_REQUESTS', 'EMOTIONS_HAPPY', 'EMOTIONS_SAD', 'DAILY_LIFE', 'MARKET_SHOPPING', 'DIRECTIONS_PLACES', 'FAMILY_PEOPLE', 'HEALTH', 'WEATHER_TIME', 'LOCAL_SCENARIOS', 'PHONETIC_COVERAGE', 'CONVERSATIONS', 'SHORT_PHRASES', 'PLACE_NAMES', 'PROVERBS', 'PASTORAL_LIFE', 'RELIGION_FAITH', 'FUNCTIONAL_PHRASES');

-- CreateEnum
CREATE TYPE "PromptEmotion" AS ENUM ('NEUTRAL', 'HAPPY', 'SAD', 'ANGRY', 'QUESTION', 'EXCITED', 'SURPRISED', 'WHISPER', 'URGENT');

-- CreateEnum
CREATE TYPE "AutoTranscriptionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "displayName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'SPEAKER',
    "roles" "UserRole"[],
    "phone" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "speakerLabel" TEXT,
    "speaksLanguages" TEXT[],
    "writesLanguages" TEXT[],
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEarningsCents" INTEGER NOT NULL DEFAULT 0,
    "totalRecordingsSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTranscriptions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nativeName" TEXT,
    "countryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetMinutes" INTEGER NOT NULL DEFAULT 12000,
    "collectedMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "approvedMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "speakerRatePerMinute" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "transcriberRatePerMin" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "includeUniversalPrompts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prompt" (
    "id" TEXT NOT NULL,
    "languageId" TEXT,
    "englishText" TEXT NOT NULL,
    "category" "PromptCategory" NOT NULL,
    "emotion" "PromptEmotion" NOT NULL DEFAULT 'NEUTRAL',
    "instruction" TEXT,
    "targetDurationSec" INTEGER NOT NULL DEFAULT 5,
    "hint" TEXT,
    "isFreeForm" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "timesRecorded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkippedPrompt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkippedPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "speakerId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "fileSize" INTEGER,
    "sampleRate" INTEGER,
    "status" "RecordingStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "transcript" TEXT,
    "transcriptConfidence" DOUBLE PRECISION,
    "autoTranscriptionStatus" "AutoTranscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "autoTranscribedAt" TIMESTAMP(3),
    "transcriptMetadata" JSONB,
    "consentGiven" BOOLEAN NOT NULL DEFAULT true,
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transcription" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "transcriberId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "TranscriptionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transcription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptionAssignment" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRatePlan" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "ratePerMinuteCents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'SLE',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PaymentRatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'SLE',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "notes" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "deltaCents" INTEGER NOT NULL,
    "description" TEXT,
    "relatedPaymentId" TEXT,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportRecord" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "languageId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "audioPath" TEXT NOT NULL,
    "transcription" TEXT NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "speakerId" TEXT NOT NULL,

    CONSTRAINT "ExportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "sourceLanguage" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userIdHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "audioPath" TEXT NOT NULL,
    "audioDurationS" DOUBLE PRECISION NOT NULL,
    "asrTranscript" TEXT NOT NULL,
    "asrConfidence" DOUBLE PRECISION,
    "detectedIntent" TEXT,
    "extractedFields" JSONB,
    "outcome" TEXT,
    "ttsAudioPath" TEXT,
    "deviceInfo" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudioSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewQueue" (
    "id" TEXT NOT NULL,
    "audioSessionId" TEXT,
    "recordingId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'pilot',
    "priorityTier" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "asrTranscript" TEXT,
    "audioPath" TEXT NOT NULL,
    "extractedFields" JSONB,
    "correctedTranscript" TEXT,
    "reviewerId" TEXT,
    "secondReviewerId" TEXT,
    "secondTranscript" TEXT,
    "disagreementFlag" BOOLEAN NOT NULL DEFAULT false,
    "datasetVersionId" TEXT,
    "mergedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetVersion" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "description" TEXT,
    "sourceReviewIds" JSONB,
    "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "pilotHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kaccpHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evalWer" DOUBLE PRECISION,
    "evalDate" TIMESTAMP(3),
    "modelArtifactPath" TEXT,
    "trainingConfig" JSONB,
    "trainingStartedAt" TIMESTAMP(3),
    "trainingCompletedAt" TIMESTAMP(3),
    "exportPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatasetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnotationRule" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "examples" JSONB,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnotationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_speakerLabel_key" ON "User"("speakerLabel");

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Language_code_key" ON "Language"("code");

-- CreateIndex
CREATE INDEX "Language_countryId_idx" ON "Language"("countryId");

-- CreateIndex
CREATE INDEX "Language_isActive_idx" ON "Language"("isActive");

-- CreateIndex
CREATE INDEX "Prompt_languageId_category_idx" ON "Prompt"("languageId", "category");

-- CreateIndex
CREATE INDEX "Prompt_languageId_isActive_idx" ON "Prompt"("languageId", "isActive");

-- CreateIndex
CREATE INDEX "SkippedPrompt_userId_idx" ON "SkippedPrompt"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SkippedPrompt_userId_promptId_key" ON "SkippedPrompt"("userId", "promptId");

-- CreateIndex
CREATE INDEX "Recording_languageId_status_idx" ON "Recording"("languageId", "status");

-- CreateIndex
CREATE INDEX "Recording_speakerId_idx" ON "Recording"("speakerId");

-- CreateIndex
CREATE INDEX "Recording_status_idx" ON "Recording"("status");

-- CreateIndex
CREATE INDEX "Recording_autoTranscriptionStatus_idx" ON "Recording"("autoTranscriptionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Transcription_recordingId_key" ON "Transcription"("recordingId");

-- CreateIndex
CREATE INDEX "Transcription_transcriberId_idx" ON "Transcription"("transcriberId");

-- CreateIndex
CREATE INDEX "Transcription_status_idx" ON "Transcription"("status");

-- CreateIndex
CREATE INDEX "TranscriptionAssignment_userId_releasedAt_idx" ON "TranscriptionAssignment"("userId", "releasedAt");

-- CreateIndex
CREATE INDEX "TranscriptionAssignment_expiresAt_idx" ON "TranscriptionAssignment"("expiresAt");

-- CreateIndex
CREATE INDEX "TranscriptionAssignment_recordingId_idx" ON "TranscriptionAssignment"("recordingId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRatePlan_name_key" ON "PaymentRatePlan"("name");

-- CreateIndex
CREATE INDEX "Payment_userId_reference_idx" ON "Payment"("userId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_userId_reference_key" ON "Payment"("userId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "ExportRecord_recordingId_key" ON "ExportRecord"("recordingId");

-- CreateIndex
CREATE INDEX "ExportRecord_languageId_idx" ON "ExportRecord"("languageId");

-- CreateIndex
CREATE INDEX "Translation_entityType_entityId_idx" ON "Translation"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Translation_targetLanguage_idx" ON "Translation"("targetLanguage");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_entityType_entityId_fieldName_targetLanguage_key" ON "Translation"("entityType", "entityId", "fieldName", "targetLanguage");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_name_key" ON "ApiKey"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_isActive_idx" ON "ApiKey"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AudioSession_sessionId_key" ON "AudioSession"("sessionId");

-- CreateIndex
CREATE INDEX "AudioSession_userIdHash_idx" ON "AudioSession"("userIdHash");

-- CreateIndex
CREATE INDEX "AudioSession_timestamp_idx" ON "AudioSession"("timestamp");

-- CreateIndex
CREATE INDEX "AudioSession_outcome_idx" ON "AudioSession"("outcome");

-- CreateIndex
CREATE INDEX "ReviewQueue_status_idx" ON "ReviewQueue"("status");

-- CreateIndex
CREATE INDEX "ReviewQueue_priorityTier_idx" ON "ReviewQueue"("priorityTier");

-- CreateIndex
CREATE INDEX "ReviewQueue_audioSessionId_idx" ON "ReviewQueue"("audioSessionId");

-- CreateIndex
CREATE INDEX "ReviewQueue_datasetVersionId_idx" ON "ReviewQueue"("datasetVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetVersion_versionId_key" ON "DatasetVersion"("versionId");

-- CreateIndex
CREATE INDEX "DatasetVersion_status_idx" ON "DatasetVersion"("status");

-- CreateIndex
CREATE INDEX "DatasetVersion_versionId_idx" ON "DatasetVersion"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnotationRule_ruleId_key" ON "AnnotationRule"("ruleId");

-- CreateIndex
CREATE INDEX "AnnotationRule_category_idx" ON "AnnotationRule"("category");

-- CreateIndex
CREATE INDEX "AnnotationRule_isActive_idx" ON "AnnotationRule"("isActive");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Language" ADD CONSTRAINT "Language_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkippedPrompt" ADD CONSTRAINT "SkippedPrompt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkippedPrompt" ADD CONSTRAINT "SkippedPrompt_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcription" ADD CONSTRAINT "Transcription_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcription" ADD CONSTRAINT "Transcription_transcriberId_fkey" FOREIGN KEY ("transcriberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcription" ADD CONSTRAINT "Transcription_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptionAssignment" ADD CONSTRAINT "TranscriptionAssignment_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptionAssignment" ADD CONSTRAINT "TranscriptionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_relatedPaymentId_fkey" FOREIGN KEY ("relatedPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportRecord" ADD CONSTRAINT "ExportRecord_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueue" ADD CONSTRAINT "ReviewQueue_audioSessionId_fkey" FOREIGN KEY ("audioSessionId") REFERENCES "AudioSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueue" ADD CONSTRAINT "ReviewQueue_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueue" ADD CONSTRAINT "ReviewQueue_secondReviewerId_fkey" FOREIGN KEY ("secondReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueue" ADD CONSTRAINT "ReviewQueue_datasetVersionId_fkey" FOREIGN KEY ("datasetVersionId") REFERENCES "DatasetVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

