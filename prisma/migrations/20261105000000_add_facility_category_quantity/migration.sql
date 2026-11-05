-- Kategori baku + jumlah unit fasilitas, dasar perhitungan kecukupan posko (standar Sphere).
CREATE TYPE "FacilityCategory" AS ENUM ('HOUSING', 'TOILET', 'WATER', 'POWER', 'KITCHEN', 'HEALTH', 'OTHER');

ALTER TABLE "FacilityReport"
  ADD COLUMN "category" "FacilityCategory" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "FacilityReport" ADD CONSTRAINT "FacilityReport_quantity_check" CHECK ("quantity" > 0);

-- Backfill kategori dari nama lama (kata kunci yang sama dengan ikon halaman publik sebelumnya).
-- Jumlah data lama tetap 1 dan perlu diperbarui petugas lewat menu Edit.
UPDATE "FacilityReport" SET "category" = CASE
  WHEN "facilityName" ~* '(toilet|mck|kamar mandi|\mwc\M)' THEN 'TOILET'::"FacilityCategory"
  WHEN "facilityName" ~* '(\mair\M|tandon|pompa)' THEN 'WATER'::"FacilityCategory"
  WHEN "facilityName" ~* '(listrik|genset|lampu)' THEN 'POWER'::"FacilityCategory"
  WHEN "facilityName" ~* '(medis|kesehatan|obat|\mpmi\M|klinik)' THEN 'HEALTH'::"FacilityCategory"
  WHEN "facilityName" ~* '(tenda|barak|tidur|hunian)' THEN 'HOUSING'::"FacilityCategory"
  WHEN "facilityName" ~* '(dapur|makan)' THEN 'KITCHEN'::"FacilityCategory"
  ELSE 'OTHER'::"FacilityCategory"
END;

CREATE INDEX "FacilityReport_campId_category_idx" ON "FacilityReport"("campId", "category");
