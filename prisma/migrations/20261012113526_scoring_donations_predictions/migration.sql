-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('AWAITING_TRANSFER', 'PENDING_REVIEW', 'CONFIRMED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" "DonationStatus" NOT NULL DEFAULT 'AWAITING_TRANSFER',
ADD COLUMN     "transferredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "paymentDetails" TEXT;

-- AlterTable
ALTER TABLE "WeeklyResult" ADD COLUMN     "cardioDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "penalty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stepsDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "strengthSessions" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_authorId_targetId_key" ON "Prediction"("authorId", "targetId");

-- CreateIndex
CREATE INDEX "Donation_status_idx" ON "Donation"("status");

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
