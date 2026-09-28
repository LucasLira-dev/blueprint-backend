-- DropIndex
DROP INDEX "DeepTopic_deepLearningContentId_idx";

-- DropIndex
DROP INDEX "DeepTopic_slug_key";

-- CreateIndex
CREATE INDEX "DeepTopic_deepLearningContentId_slug_idx" ON "DeepTopic"("deepLearningContentId", "slug");
