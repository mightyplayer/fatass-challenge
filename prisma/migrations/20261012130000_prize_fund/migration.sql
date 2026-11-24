-- CreateTable
CREATE TABLE "PrizeFund" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "baseAmount" INTEGER NOT NULL DEFAULT 0,
    "keeperId" TEXT,
    "sbpPhone" TEXT,
    "sbpBank" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizeFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundContribution" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "message" TEXT,
    "status" "DonationStatus" NOT NULL DEFAULT 'AWAITING_TRANSFER',
    "transferredAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FundContribution_status_idx" ON "FundContribution"("status");

-- AddForeignKey
ALTER TABLE "PrizeFund" ADD CONSTRAINT "PrizeFund_keeperId_fkey" FOREIGN KEY ("keeperId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundContribution" ADD CONSTRAINT "FundContribution_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundContribution" ADD CONSTRAINT "FundContribution_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
