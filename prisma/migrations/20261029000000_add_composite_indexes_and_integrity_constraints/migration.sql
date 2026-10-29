-- Drop redundant single-column indexes replaced by composite indexes
DROP INDEX IF EXISTS "Distribution_sourceCampId_idx";
DROP INDEX IF EXISTS "Distribution_destinationCampId_idx";

-- Create new composite and foreign key indexes
CREATE INDEX IF NOT EXISTS "EvacueeRecord_campId_arrivedAt_idx" ON "EvacueeRecord"("campId", "arrivedAt");
CREATE INDEX IF NOT EXISTS "LogisticsItem_campId_updatedAt_idx" ON "LogisticsItem"("campId", "updatedAt");
CREATE INDEX IF NOT EXISTS "FacilityReport_campId_updatedAt_idx" ON "FacilityReport"("campId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Distribution_sourceCampId_status_updatedAt_idx" ON "Distribution"("sourceCampId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Distribution_destinationCampId_status_updatedAt_idx" ON "Distribution"("destinationCampId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Distribution_sourceItemId_idx" ON "Distribution"("sourceItemId");
CREATE INDEX IF NOT EXISTS "LogisticsRequest_destinationCampId_status_idx" ON "LogisticsRequest"("destinationCampId", "status");
CREATE INDEX IF NOT EXISTS "LogisticsRequest_reviewedById_idx" ON "LogisticsRequest"("reviewedById");
CREATE INDEX IF NOT EXISTS "InventoryMovement_createdById_idx" ON "InventoryMovement"("createdById");

-- Add integrity CHECK constraints
ALTER TABLE "Camp" ADD CONSTRAINT "Camp_currentOccupants_check" CHECK ("currentOccupants" >= 0 AND "currentOccupants" <= "maxCapacity");
ALTER TABLE "LogisticsItem" ADD CONSTRAINT "LogisticsItem_quantity_check" CHECK ("quantity" >= 0);
ALTER TABLE "LogisticsItem" ADD CONSTRAINT "LogisticsItem_reservedQuantity_check" CHECK ("reservedQuantity" >= 0 AND "reservedQuantity" <= "quantity");
ALTER TABLE "LogisticsItem" ADD CONSTRAINT "LogisticsItem_damagedQuantity_check" CHECK ("damagedQuantity" >= 0);
ALTER TABLE "LogisticsItem" ADD CONSTRAINT "LogisticsItem_quantityBase_check" CHECK ("quantityBase" >= 0);
ALTER TABLE "LogisticsItem" ADD CONSTRAINT "LogisticsItem_reservedQuantityBase_check" CHECK ("reservedQuantityBase" >= 0 AND "reservedQuantityBase" <= "quantityBase");
ALTER TABLE "LogisticsItem" ADD CONSTRAINT "LogisticsItem_damagedQuantityBase_check" CHECK ("damagedQuantityBase" >= 0);
