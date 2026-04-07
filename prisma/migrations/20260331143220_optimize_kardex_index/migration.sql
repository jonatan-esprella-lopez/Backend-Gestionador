-- DropIndex
DROP INDEX "kardex_created_at_idx";

-- DropIndex
DROP INDEX "kardex_empresa_id_idx";

-- DropIndex
DROP INDEX "kardex_item_id_idx";

-- CreateIndex
CREATE INDEX "kardex_empresa_id_item_id_created_at_idx" ON "kardex"("empresa_id", "item_id", "created_at" DESC);
