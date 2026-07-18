-- Consolidate tag-scoped human votes back to one vote per user×content.
-- Keep the latest intention (updatedAt → createdAt → id).
DELETE FROM "Vote" AS v
USING "Vote" AS newer
WHERE v."userId" = newer."userId"
  AND v."contentId" = newer."contentId"
  AND (
    v."updatedAt" < newer."updatedAt"
    OR (v."updatedAt" = newer."updatedAt" AND v."createdAt" < newer."createdAt")
    OR (
      v."updatedAt" = newer."updatedAt"
      AND v."createdAt" = newer."createdAt"
      AND v."id" < newer."id"
    )
  );

-- Drop Vote tag-scoped constraints / columns.
DROP INDEX IF EXISTS "Vote_userId_contentId_sourceTagId_key";
DROP INDEX IF EXISTS "Vote_sourceTagId_idx";
DROP INDEX IF EXISTS "Vote_contentId_sourceTagId_idx";
ALTER TABLE "Vote" DROP CONSTRAINT IF EXISTS "Vote_sourceTagId_fkey";
ALTER TABLE "Vote" DROP COLUMN IF EXISTS "sourceTagId";
CREATE UNIQUE INDEX "Vote_userId_contentId_key" ON "Vote"("userId", "contentId");

-- Consolidate NPC evaluations to one vote per content×judge.
-- Prefer legacy photo-level rows (tagId IS NULL); otherwise majority of tag-scoped rows.
CREATE TEMP TABLE "_NpcEvalKeep" AS
WITH photo_level AS (
  SELECT DISTINCT ON ("contentId", "judgeId")
    id,
    "contentId",
    "judgeId",
    value,
    "commentJa",
    confidence,
    "modelName",
    "promptVersion",
    "createdAt",
    "updatedAt"
  FROM "NpcEvaluation"
  WHERE "tagId" IS NULL
  ORDER BY "contentId", "judgeId", "updatedAt" DESC, id DESC
),
tag_value_counts AS (
  SELECT
    "contentId",
    "judgeId",
    value,
    COUNT(*)::int AS cnt,
    MAX(COALESCE(confidence, 0)) AS max_confidence,
    MAX("updatedAt") AS max_updated_at,
    MIN(id) AS pick_id
  FROM "NpcEvaluation"
  WHERE "tagId" IS NOT NULL
  GROUP BY "contentId", "judgeId", value
),
winning_value AS (
  SELECT DISTINCT ON ("contentId", "judgeId")
    "contentId",
    "judgeId",
    value
  FROM tag_value_counts
  ORDER BY
    "contentId",
    "judgeId",
    cnt DESC,
    max_confidence DESC,
    max_updated_at DESC,
    pick_id ASC
),
tag_majority AS (
  SELECT DISTINCT ON (e."contentId", e."judgeId")
    e.id,
    e."contentId",
    e."judgeId",
    e.value,
    e."commentJa",
    e.confidence,
    e."modelName",
    'migration-photo-majority-v1' AS "promptVersion",
    e."createdAt",
    e."updatedAt"
  FROM "NpcEvaluation" e
  JOIN winning_value w
    ON w."contentId" = e."contentId"
   AND w."judgeId" = e."judgeId"
   AND w.value = e.value
  WHERE e."tagId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM photo_level pl
      WHERE pl."contentId" = e."contentId"
        AND pl."judgeId" = e."judgeId"
    )
  ORDER BY
    e."contentId",
    e."judgeId",
    COALESCE(e.confidence, 0) DESC,
    e."updatedAt" DESC,
    e.id ASC
)
SELECT * FROM photo_level
UNION ALL
SELECT * FROM tag_majority;

DELETE FROM "NpcEvaluation";

INSERT INTO "NpcEvaluation" (
  id,
  "contentId",
  "judgeId",
  value,
  "commentJa",
  confidence,
  "modelName",
  "promptVersion",
  "createdAt",
  "updatedAt"
)
SELECT
  id,
  "contentId",
  "judgeId",
  value,
  "commentJa",
  confidence,
  "modelName",
  "promptVersion",
  "createdAt",
  "updatedAt"
FROM "_NpcEvalKeep";

DROP TABLE "_NpcEvalKeep";

-- Drop NpcEvaluation tag-scoped constraints / columns.
DROP INDEX IF EXISTS "NpcEvaluation_contentId_judgeId_tagId_key";
DROP INDEX IF EXISTS "NpcEvaluation_tagId_idx";
DROP INDEX IF EXISTS "NpcEvaluation_contentId_tagId_idx";
ALTER TABLE "NpcEvaluation" DROP CONSTRAINT IF EXISTS "NpcEvaluation_tagId_fkey";
ALTER TABLE "NpcEvaluation" DROP COLUMN IF EXISTS "tagId";
CREATE UNIQUE INDEX "NpcEvaluation_contentId_judgeId_key" ON "NpcEvaluation"("contentId", "judgeId");

-- Reset tag rankings derived from the old tag-scoped vote model.
DELETE FROM "RankingSnapshot";
UPDATE "ContentTag" SET "currentRank" = NULL, "previousRank" = NULL;
