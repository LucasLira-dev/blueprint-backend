-- CreateIndex
CREATE INDEX "QuizAttempt_userId_idx" ON "QuizAttempt"("userId");

-- CreateIndex
CREATE INDEX "QuizAttempt_deepLearningContentId_idx" ON "QuizAttempt"("deepLearningContentId");

-- CreateIndex
CREATE INDEX "QuizQuestion_deepLearningContentId_idx" ON "QuizQuestion"("deepLearningContentId");
