-- CreateTable
CREATE TABLE "DeepLearningContent" (
    "id" TEXT NOT NULL,
    "studyPlanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeepLearningContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeepTopic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "deepLearningContentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeepTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "deepLearningContentId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deepLearningContentId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeepLearningContent_studyPlanId_idx" ON "DeepLearningContent"("studyPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "DeepTopic_slug_key" ON "DeepTopic"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DeepTopic_deepLearningContentId_key" ON "DeepTopic"("deepLearningContentId");

-- CreateIndex
CREATE INDEX "DeepTopic_deepLearningContentId_idx" ON "DeepTopic"("deepLearningContentId");

-- AddForeignKey
ALTER TABLE "DeepLearningContent" ADD CONSTRAINT "DeepLearningContent_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeepTopic" ADD CONSTRAINT "DeepTopic_deepLearningContentId_fkey" FOREIGN KEY ("deepLearningContentId") REFERENCES "DeepLearningContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_deepLearningContentId_fkey" FOREIGN KEY ("deepLearningContentId") REFERENCES "DeepLearningContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_deepLearningContentId_fkey" FOREIGN KEY ("deepLearningContentId") REFERENCES "DeepLearningContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
