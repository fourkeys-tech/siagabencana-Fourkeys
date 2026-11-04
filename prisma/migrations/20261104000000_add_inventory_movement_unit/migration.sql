-- Snapshot unit tampilan per mutasi stok.
ALTER TABLE "InventoryMovement" ADD COLUMN "unit" TEXT;

-- Backfill baris lama. Unit item bisa sudah diganti setelah saldonya kosong, jadi unit item
-- hanya dipakai bila definisi yang tercatat di baris mutasi sama dengan definisi item sekarang.
UPDATE "InventoryMovement" m
SET "unit" = i."unit"
FROM "LogisticsItem" i
WHERE m."logisticsItemId" = i."id"
  AND m."unit" IS NULL
  AND m."baseUnit" IS NOT DISTINCT FROM i."baseUnit"
  AND m."unitDimension" IS NOT DISTINCT FROM i."unitDimension"
  AND m."conversionFactor" IS NOT DISTINCT FROM i."conversionFactor";

-- Sisanya diturunkan dari definisi baris itu sendiri bila tidak ambigu:
-- faktor 1 berarti unit = unit dasar, g x 1000 = kg, ml x 1000 = l.
-- Selain itu dibiarkan NULL dan riwayat menampilkan saldo dasar.
UPDATE "InventoryMovement" m
SET "unit" = CASE
    WHEN m."conversionFactor" = 1 THEN m."baseUnit"
    WHEN m."baseUnit" = 'g' AND m."conversionFactor" = 1000 THEN 'kg'
    WHEN m."baseUnit" = 'ml' AND m."conversionFactor" = 1000 THEN 'l'
  END
WHERE m."unit" IS NULL
  AND m."baseUnit" IS NOT NULL
  AND m."conversionFactor" IS NOT NULL;
