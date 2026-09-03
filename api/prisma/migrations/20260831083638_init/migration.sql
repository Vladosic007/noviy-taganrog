-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'moderator', 'superadmin');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('pending', 'published', 'merged', 'rejected');

-- CreateEnum
CREATE TYPE "ProblemStatus" AS ENUM ('found', 'in_progress', 'resolved', 'declined');

-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('before', 'after');

-- CreateEnum
CREATE TYPE "RejectReason" AS ENUM ('not_confirmed', 'duplicate', 'out_of_scope', 'insufficient', 'rules', 'not_taganrog');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "vk_id" BIGINT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "photo_url" TEXT,
    "role" "Role" NOT NULL DEFAULT 'user',
    "notify_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "ban_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "category_id" TEXT,
    "custom_category" TEXT,
    "description" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "address_text" TEXT,
    "street_id" TEXT,
    "house" TEXT,
    "occurred_on" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'pending',
    "reject_reason" "RejectReason",
    "reject_comment" TEXT,
    "problem_id" TEXT,
    "moderated_by" TEXT,
    "moderated_at" TIMESTAMP(3),
    "consent_version" TEXT,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" TEXT NOT NULL,
    "public_id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "address_text" TEXT,
    "street_id" TEXT,
    "house" TEXT,
    "status" "ProblemStatus" NOT NULL DEFAULT 'found',
    "signature_goal" INTEGER NOT NULL DEFAULT 100,
    "occurred_on" DATE,
    "published_at" TIMESTAMP(3),
    "status_changed_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_by" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "signatures_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT,
    "problem_id" TEXT,
    "kind" "PhotoKind" NOT NULL DEFAULT 'before',
    "path" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "likes" (
    "user_id" TEXT NOT NULL,
    "problem_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("user_id","problem_id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" TEXT NOT NULL,
    "problem_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "consent_text_version" TEXT NOT NULL,
    "consented_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "user_agent" TEXT,
    "revoked_at" TIMESTAMP(3),
    "exported_at" TIMESTAMP(3),

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "user_id" TEXT NOT NULL,
    "problem_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("user_id","problem_id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streets" (
    "id" TEXT NOT NULL,
    "osm_id" BIGINT,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "problems_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "streets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "street_id" TEXT NOT NULL,
    "house" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_status_history" (
    "id" TEXT NOT NULL,
    "problem_id" TEXT NOT NULL,
    "from_status" "ProblemStatus",
    "to_status" "ProblemStatus" NOT NULL,
    "comment" TEXT,
    "changed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "problem_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeals" (
    "id" TEXT NOT NULL,
    "street_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "problem_ids" TEXT[],
    "signatures_count" INTEGER NOT NULL DEFAULT 0,
    "file_path" TEXT,

    CONSTRAINT "appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "payload" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "problem_id" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_vk_id_key" ON "users"("vk_id");

-- CreateIndex
CREATE INDEX "submissions_status_created_at_idx" ON "submissions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "problems_public_id_key" ON "problems"("public_id");

-- CreateIndex
CREATE INDEX "problems_status_is_published_idx" ON "problems"("status", "is_published");

-- CreateIndex
CREATE INDEX "problems_street_id_idx" ON "problems"("street_id");

-- CreateIndex
CREATE UNIQUE INDEX "signatures_problem_id_user_id_key" ON "signatures"("problem_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "streets_name_normalized_idx" ON "streets"("name_normalized");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_street_id_fkey" FOREIGN KEY ("street_id") REFERENCES "streets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_street_id_fkey" FOREIGN KEY ("street_id") REFERENCES "streets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_street_id_fkey" FOREIGN KEY ("street_id") REFERENCES "streets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_status_history" ADD CONSTRAINT "problem_status_history_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
