-- AlterTable
ALTER TABLE "notifications_log" ADD COLUMN     "read" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "notifications_log_user_id_read_created_at_idx" ON "notifications_log"("user_id", "read", "created_at");
