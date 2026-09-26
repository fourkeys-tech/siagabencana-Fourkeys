-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'MANAGER', 'FIELD_OFFICER');

-- CreateEnum
CREATE TYPE "DivisionType" AS ENUM ('LOGISTICS', 'SHELTER', 'DATA_REGISTRATION');

-- CreateEnum
CREATE TYPE "CampStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('SUFFICIENT', 'LOW', 'CRITICAL', 'SPOILED_OR_DAMAGED');

-- CreateEnum
CREATE TYPE "FacilityStatus" AS ENUM ('GOOD', 'DAMAGED', 'REPAIRING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "division" "DivisionType",
    "campId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Camp" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "maxCapacity" INTEGER NOT NULL,
    "currentOccupants" INTEGER NOT NULL DEFAULT 0,
    "status" "CampStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Camp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogisticsItem" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'SUFFICIENT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityReport" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "facilityName" TEXT NOT NULL,
    "status" "FacilityStatus" NOT NULL DEFAULT 'GOOD',
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvacueeRecord" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalFamily" INTEGER NOT NULL DEFAULT 1,
    "hasSpecialNeeds" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "arrivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvacueeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_campId_idx" ON "User"("campId");

-- CreateIndex
CREATE INDEX "User_role_division_idx" ON "User"("role", "division");

-- CreateIndex
CREATE INDEX "Camp_status_idx" ON "Camp"("status");

-- CreateIndex
CREATE INDEX "LogisticsItem_campId_idx" ON "LogisticsItem"("campId");

-- CreateIndex
CREATE INDEX "LogisticsItem_campId_status_idx" ON "LogisticsItem"("campId", "status");

-- CreateIndex
CREATE INDEX "FacilityReport_campId_idx" ON "FacilityReport"("campId");

-- CreateIndex
CREATE INDEX "FacilityReport_campId_status_idx" ON "FacilityReport"("campId", "status");

-- CreateIndex
CREATE INDEX "EvacueeRecord_campId_idx" ON "EvacueeRecord"("campId");

-- CreateIndex
CREATE INDEX "EvacueeRecord_campId_departedAt_idx" ON "EvacueeRecord"("campId", "departedAt");

-- CreateIndex
CREATE INDEX "EvacueeRecord_campId_hasSpecialNeeds_idx" ON "EvacueeRecord"("campId", "hasSpecialNeeds");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsItem" ADD CONSTRAINT "LogisticsItem_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityReport" ADD CONSTRAINT "FacilityReport_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvacueeRecord" ADD CONSTRAINT "EvacueeRecord_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
