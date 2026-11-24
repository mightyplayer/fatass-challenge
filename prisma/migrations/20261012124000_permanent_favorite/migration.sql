-- Голос за фаворита больше не недельный: у болельщика остаётся только последний.
DELETE FROM "Vote" v
WHERE EXISTS (SELECT 1 FROM "Vote" w WHERE w."fanId" = v."fanId" AND w."week" > v."week");

-- DropIndex
DROP INDEX "Vote_fanId_week_key";

-- AlterTable
ALTER TABLE "Vote" DROP COLUMN "week";

-- CreateIndex
CREATE UNIQUE INDEX "Vote_fanId_key" ON "Vote"("fanId");

-- CreateIndex
CREATE INDEX "Vote_participantId_idx" ON "Vote"("participantId");
