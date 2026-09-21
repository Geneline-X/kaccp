-- Chosen gamification avatar.
--
-- Nullable: a user who has not picked one falls back to a deterministic starter
-- derived from their user id. Avatars are always chosen, never inferred from a
-- person's name — guessing is wrong often enough to misrepresent real people on
-- a shared leaderboard.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "avatarId" TEXT;
