-- DropIndex
DROP INDEX "idx_flujos_trigger_gin";

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "refresh_token_expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "refresh_token_hash" TEXT;
