-- CreateEnum
CREATE TYPE "DistributionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SHIPPED', 'RECEIVED');

-- CreateTable
CREATE TABLE "LogisticsRequest" (
    "id" TEXT NOT NULL,
    "sourceCampId" TEXT NOT NULL,
    "destinationCampId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "status" "DistributionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distribution" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "sourceCampId" TEXT NOT NULL,
    "destinationCampId" TEXT NOT NULL,
    "sourceItemId" TEXT,
    "createdById" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "notes" TEXT,
    "status" "DistributionStatus" NOT NULL DEFAULT 'APPROVED',
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Distribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogisticsRequest_sourceCampId_idx" ON "LogisticsRequest"("sourceCampId");
CREATE INDEX "LogisticsRequest_destinationCampId_idx" ON "LogisticsRequest"("destinationCampId");
CREATE INDEX "LogisticsRequest_status_idx" ON "LogisticsRequest"("status");
CREATE INDEX "LogisticsRequest_createdById_idx" ON "LogisticsRequest"("createdById");
CREATE UNIQUE INDEX "Distribution_requestId_key" ON "Distribution"("requestId");
CREATE INDEX "Distribution_sourceCampId_idx" ON "Distribution"("sourceCampId");
CREATE INDEX "Distribution_sourceItemId_idx" ON "Distribution"("sourceItemId");
CREATE INDEX "Distribution_destinationCampId_idx" ON "Distribution"("destinationCampId");
CREATE INDEX "Distribution_status_idx" ON "Distribution"("status");
CREATE INDEX "Distribution_createdById_idx" ON "Distribution"("createdById");

-- AddForeignKey
ALTER TABLE "LogisticsRequest" ADD CONSTRAINT "LogisticsRequest_sourceCampId_fkey" FOREIGN KEY ("sourceCampId") REFERENCES "Camp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogisticsRequest" ADD CONSTRAINT "LogisticsRequest_destinationCampId_fkey" FOREIGN KEY ("destinationCampId") REFERENCES "Camp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogisticsRequest" ADD CONSTRAINT "LogisticsRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LogisticsRequest" ADD CONSTRAINT "LogisticsRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LogisticsRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "LogisticsItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_sourceCampId_fkey" FOREIGN KEY ("sourceCampId") REFERENCES "Camp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_destinationCampId_fkey" FOREIGN KEY ("destinationCampId") REFERENCES "Camp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
