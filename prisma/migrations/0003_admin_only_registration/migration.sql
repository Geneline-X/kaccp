-- Admin-only account creation.
--
-- Self-registration is removed: an admin creates every account. Consent that the
-- signup form used to collect (but never stored) is now recorded:
--   * ageVerifiedAt / ageVerifiedById — the admin's attestation that the person is 18+.
--   * termsAcceptedAt / termsVersion  — the contributor's own acceptance at first login.
--   * mustChangePassword              — the admin chose the password; the user replaces it.
--
-- Existing rows: termsAcceptedAt stays NULL so every existing speaker/transcriber is
-- asked to accept the Terms on their next login. ageVerifiedAt stays NULL (no admin
-- checked them). mustChangePassword defaults to false — they chose their own password.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "ageVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "ageVerifiedById" TEXT;
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "termsVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
