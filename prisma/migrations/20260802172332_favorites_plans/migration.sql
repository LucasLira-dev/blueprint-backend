/*
  Warnings:

  - Added the required column `videoId` to the `VideoResource` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "VideoResource" ADD COLUMN     "videoId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "FavoriteStudyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyPlanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FavoriteStudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteStudyPlan_userId_idx" ON "FavoriteStudyPlan"("userId");

-- CreateIndex
CREATE INDEX "FavoriteStudyPlan_studyPlanId_idx" ON "FavoriteStudyPlan"("studyPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteStudyPlan_userId_studyPlanId_key" ON "FavoriteStudyPlan"("userId", "studyPlanId");

-- CreateIndex
CREATE INDEX "BookResource_studyPlanId_idx" ON "BookResource"("studyPlanId");

-- CreateIndex
CREATE INDEX "StudyPlan_userId_idx" ON "StudyPlan"("userId");

-- CreateIndex
CREATE INDEX "StudyPlan_visibility_idx" ON "StudyPlan"("visibility");

-- CreateIndex
CREATE INDEX "VideoResource_studyPlanId_idx" ON "VideoResource"("studyPlanId");

-- AddForeignKey
ALTER TABLE "FavoriteStudyPlan" ADD CONSTRAINT "FavoriteStudyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteStudyPlan" ADD CONSTRAINT "FavoriteStudyPlan_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
