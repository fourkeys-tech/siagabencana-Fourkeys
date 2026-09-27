-- AlterEnum
ALTER TYPE "DistributionStatus" ADD VALUE 'RESERVED';
ALTER TYPE "DistributionStatus" ADD VALUE 'CANCELLED';

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('RECEIPT', 'DAMAGE', 'LOSS', 'RESERVATION', 'RESERVATION_RELEASE', 'DISTRIBUTION_OUT', 'DISTRIBUTION_IN');

-- AlterTable
ALTER TABLE "LogisticsItem" ADD COLUMN "reservedQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LogisticsItem" ADD COLUMN "damagedQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LogisticsItem" ADD COLUMN "minimumQuantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "logisticsItemId" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "distributionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryMovement_logisticsItemId_createdAt_idx" ON "InventoryMovement"("logisticsItemId", "createdAt");
CREATE INDEX "InventoryMovement_campId_createdAt_idx" ON "InventoryMovement"("campId", "createdAt");
CREATE INDEX "InventoryMovement_type_createdAt_idx" ON "InventoryMovement"("type", "createdAt");
CREATE INDEX "InventoryMovement_distributionId_idx" ON "InventoryMovement"("distributionId");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_logisticsItemId_fkey" FOREIGN KEY ("logisticsItemId") REFERENCES "LogisticsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "Distribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
