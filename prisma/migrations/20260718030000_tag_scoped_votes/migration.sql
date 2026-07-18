-- AlterTable ContentTag: tag-scoped rates
ALTER TABLE "ContentTag" ADD COLUMN "likeRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ContentTag" ADD COLUMN "wilsonLower" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable NpcEvaluation: optional tag context (NULL = legacy photo-level)
ALTER TABLE "NpcEvaluation" ADD COLUMN "tagId" TEXT;

-- DropIndex / DropUnique NpcEvaluation contentId+judgeId
DROP INDEX IF EXISTS "NpcEvaluation_contentId_judgeId_key";

-- CreateIndex NpcEvaluation
CREATE INDEX "NpcEvaluation_tagId_idx" ON "NpcEvaluation"("tagId");
CREATE INDEX "NpcEvaluation_contentId_tagId_idx" ON "NpcEvaluation"("contentId", "tagId");
CREATE UNIQUE INDEX "NpcEvaluation_contentId_judgeId_tagId_key" ON "NpcEvaluation"("contentId", "judgeId", "tagId");

-- AddForeignKey
ALTER TABLE "NpcEvaluation" ADD CONSTRAINT "NpcEvaluation_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropIndex / DropUnique Vote userId+contentId
DROP INDEX IF EXISTS "Vote_userId_contentId_key";

-- CreateIndex Vote
CREATE INDEX "Vote_sourceTagId_idx" ON "Vote"("sourceTagId");
CREATE INDEX "Vote_contentId_sourceTagId_idx" ON "Vote"("contentId", "sourceTagId");
CREATE UNIQUE INDEX "Vote_userId_contentId_sourceTagId_key" ON "Vote"("userId", "contentId", "sourceTagId");

-- AddForeignKey Vote.sourceTagId -> Tag
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_sourceTagId_fkey" FOREIGN KEY ("sourceTagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
