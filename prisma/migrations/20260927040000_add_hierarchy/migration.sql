-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'DIVISION_HEAD';

-- AlterTable
ALTER TABLE "Camp" ADD COLUMN "managerId" TEXT;

-- CreateTable
CREATE TABLE "CampDivisionHead" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "division" "DivisionType" NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampDivisionHead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Camp_managerId_key" ON "Camp"("managerId");
CREATE UNIQUE INDEX "CampDivisionHead_campId_division_key" ON "CampDivisionHead"("campId", "division");
CREATE UNIQUE INDEX "CampDivisionHead_userId_campId_key" ON "CampDivisionHead"("userId", "campId");
CREATE INDEX "CampDivisionHead_userId_idx" ON "CampDivisionHead"("userId");

-- AddForeignKey
ALTER TABLE "Camp" ADD CONSTRAINT "Camp_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampDivisionHead" ADD CONSTRAINT "CampDivisionHead_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampDivisionHead" ADD CONSTRAINT "CampDivisionHead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
