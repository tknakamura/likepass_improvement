-- AlterEnum
ALTER TYPE "ContentStatus" ADD VALUE 'NPC_REVIEWING';

-- CreateTable
CREATE TABLE "NpcJudge" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryNameJa" TEXT NOT NULL,
    "personaJa" TEXT NOT NULL,
    "viewingLensJa" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NpcJudge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NpcEvaluation" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "value" "VoteValue" NOT NULL,
    "commentJa" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "modelName" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NpcEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NpcJudge_slug_key" ON "NpcJudge"("slug");

-- CreateIndex
CREATE INDEX "NpcJudge_active_sortOrder_idx" ON "NpcJudge"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "NpcEvaluation_contentId_idx" ON "NpcEvaluation"("contentId");

-- CreateIndex
CREATE INDEX "NpcEvaluation_judgeId_idx" ON "NpcEvaluation"("judgeId");

-- CreateIndex
CREATE UNIQUE INDEX "NpcEvaluation_contentId_judgeId_key" ON "NpcEvaluation"("contentId", "judgeId");

-- AddForeignKey
ALTER TABLE "NpcEvaluation" ADD CONSTRAINT "NpcEvaluation_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NpcEvaluation" ADD CONSTRAINT "NpcEvaluation_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "NpcJudge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
