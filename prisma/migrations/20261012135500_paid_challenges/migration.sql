-- AlterEnum

ALTER TYPE "ChallengeStatus" ADD VALUE 'AWAITING_PAYMENT';
ALTER TYPE "ChallengeStatus" ADD VALUE 'PAYMENT_REVIEW';
ALTER TYPE "ChallengeStatus" ADD VALUE 'PAYMENT_REJECTED';
ALTER TYPE "ChallengeStatus" ADD VALUE 'COMPLETION_REVIEW';
ALTER TYPE "ChallengeStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidById" TEXT,
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "reward" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "settledAt" TIMESTAMP(3),
ADD COLUMN     "settledById" TEXT,
ADD COLUMN     "transferredAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_settledById_fkey" FOREIGN KEY ("settledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
