-- Хранение фото прямо в БД (Render Free tier эфемерный, файлы на диске пропадают).
ALTER TABLE "photos" ADD COLUMN "data" BYTEA;
ALTER TABLE "photos" ADD COLUMN "mime_type" TEXT;
