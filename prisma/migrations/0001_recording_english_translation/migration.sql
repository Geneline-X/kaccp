-- Per-recording English translation.
--
-- Free-form prompts carry an instruction in Prompt.englishText ("Describe how to
-- prepare yams"), not a sentence the speaker translated, so that column cannot be
-- the English side of a training pair. Prompt rows are also shared across
-- recordings, so it must never be overwritten. These columns hold the translation
-- of what was actually said, per recording.
--
-- All columns are nullable and additive: safe to apply to a live database.

-- AlterTable
ALTER TABLE "Recording" ADD COLUMN "englishTranslation" TEXT;
ALTER TABLE "Recording" ADD COLUMN "englishTranslatedById" TEXT;
ALTER TABLE "Recording" ADD COLUMN "englishTranslatedAt" TIMESTAMP(3);
ALTER TABLE "Recording" ADD COLUMN "englishTranslationStatus" "TranscriptionStatus";
ALTER TABLE "Recording" ADD COLUMN "englishReviewedById" TEXT;
ALTER TABLE "Recording" ADD COLUMN "englishReviewNotes" TEXT;

-- CreateIndex
CREATE INDEX "Recording_englishTranslationStatus_idx" ON "Recording"("englishTranslationStatus");

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_englishTranslatedById_fkey"
  FOREIGN KEY ("englishTranslatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_englishReviewedById_fkey"
  FOREIGN KEY ("englishReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
