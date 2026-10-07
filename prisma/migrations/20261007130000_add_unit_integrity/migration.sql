CREATE TYPE "UnitDimension" AS ENUM ('COUNT', 'MASS', 'VOLUME');

CREATE TYPE "UnitConversionStatus" AS ENUM ('CONFIGURED', 'NEEDS_REVIEW');

ALTER TABLE "LogisticsItem"
ADD COLUMN "baseUnit" TEXT NOT NULL DEFAULT 'pcs',
ADD COLUMN "unitDimension" "UnitDimension" NOT NULL DEFAULT 'COUNT',
ADD COLUMN "conversionFactor" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "conversionStatus" "UnitConversionStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
ADD COLUMN "conversionNote" TEXT,
ADD COLUMN "quantityBase" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reservedQuantityBase" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "damagedQuantityBase" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "minimumQuantityBase" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "LogisticsRequest"
ADD COLUMN "requestedQuantity" INTEGER,
ADD COLUMN "requestedUnit" TEXT,
ADD COLUMN "baseQuantity" INTEGER,
ADD COLUMN "baseUnit" TEXT,
ADD COLUMN "unitDimension" "UnitDimension",
ADD COLUMN "conversionFactor" INTEGER,
ADD COLUMN "conversionStatus" "UnitConversionStatus";

ALTER TABLE "Distribution"
ADD COLUMN "requestedQuantity" INTEGER,
ADD COLUMN "requestedUnit" TEXT,
ADD COLUMN "baseQuantity" INTEGER,
ADD COLUMN "baseUnit" TEXT,
ADD COLUMN "unitDimension" "UnitDimension",
ADD COLUMN "conversionFactor" INTEGER,
ADD COLUMN "conversionStatus" "UnitConversionStatus";

ALTER TABLE "InventoryMovement"
ADD COLUMN "baseQuantity" INTEGER,
ADD COLUMN "baseUnit" TEXT,
ADD COLUMN "unitDimension" "UnitDimension",
ADD COLUMN "conversionFactor" INTEGER;

UPDATE "LogisticsItem"
SET
  "unit" = CASE
    WHEN lower(trim("unit")) IN ('pc', 'pcs', 'buah') THEN 'pcs'
    WHEN lower(trim("unit")) IN ('unit') THEN 'unit'
    WHEN lower(trim("unit")) IN ('gram', 'gr', 'g') THEN 'g'
    WHEN lower(trim("unit")) IN ('kilogram', 'kg') THEN 'kg'
    WHEN lower(trim("unit")) IN ('liter', 'ltr', 'l') THEN 'l'
    WHEN lower(trim("unit")) IN ('mililiter', 'milliliter', 'ml') THEN 'ml'
    ELSE lower(trim("unit"))
  END,
  "baseUnit" = CASE
    WHEN lower(trim("unit")) IN ('gram', 'gr', 'g', 'kilogram', 'kg') THEN 'g'
    WHEN lower(trim("unit")) IN ('liter', 'ltr', 'l', 'mililiter', 'milliliter', 'ml') THEN 'ml'
    WHEN lower(trim("unit")) IN ('pc', 'pcs', 'buah') THEN 'pcs'
    WHEN lower(trim("unit")) IN ('unit') THEN 'unit'
    ELSE lower(trim("unit"))
  END,
  "unitDimension" = CASE
    WHEN lower(trim("unit")) IN ('kg', 'kilogram', 'gram', 'gr', 'g') THEN 'MASS'::"UnitDimension"
    WHEN lower(trim("unit")) IN ('l', 'liter', 'ltr', 'ml', 'mililiter', 'milliliter') THEN 'VOLUME'::"UnitDimension"
    ELSE 'COUNT'::"UnitDimension"
  END,
  "conversionFactor" = CASE
    WHEN lower(trim("unit")) IN ('kg', 'kilogram', 'l', 'liter', 'ltr') THEN 1000
    ELSE 1
  END,
  "conversionStatus" = CASE
    WHEN lower(trim("unit")) IN ('pc', 'pcs', 'buah', 'unit', 'kg', 'kilogram', 'gram', 'gr', 'g', 'l', 'liter', 'ltr', 'ml', 'mililiter', 'milliliter') THEN 'CONFIGURED'::"UnitConversionStatus"
    ELSE 'NEEDS_REVIEW'::"UnitConversionStatus"
  END,
  "conversionNote" = CASE
    WHEN lower(trim("unit")) IN ('dus', 'box', 'paket', 'karton') THEN 'Isi kemasan belum didefinisikan; konversi lintas unit diblokir.'
    ELSE 'Migrasi unit lama; verifikasi definisi sebelum konversi lintas unit.'
  END;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "LogisticsItem"
    WHERE "quantity"::BIGINT * "conversionFactor"::BIGINT > 2147483647
       OR "reservedQuantity"::BIGINT * "conversionFactor"::BIGINT > 2147483647
       OR "damagedQuantity"::BIGINT * "conversionFactor"::BIGINT > 2147483647
       OR "minimumQuantity"::BIGINT * "conversionFactor"::BIGINT > 2147483647
       OR "quantity" < 0
       OR "reservedQuantity" < 0
       OR "damagedQuantity" < 0
       OR "minimumQuantity" < 0
  ) THEN
    RAISE EXCEPTION 'Unit integrity migration would overflow INTEGER base balances or encounter negative legacy balances';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "LogisticsRequest"
    WHERE "quantity" < 0
       OR "quantity"::BIGINT * CASE
         WHEN lower(trim("unit")) IN ('kg', 'kilogram', 'l', 'liter', 'ltr') THEN 1000::BIGINT
         ELSE 1::BIGINT
       END > 2147483647
  )
  OR EXISTS (
    SELECT 1
    FROM "Distribution"
    WHERE "quantity" < 0
       OR "quantity"::BIGINT * CASE
         WHEN lower(trim("unit")) IN ('kg', 'kilogram', 'l', 'liter', 'ltr') THEN 1000::BIGINT
         ELSE 1::BIGINT
       END > 2147483647
  )
  OR EXISTS (
    SELECT 1
    FROM "InventoryMovement" AS movement
    JOIN "LogisticsItem" AS item ON item."id" = movement."logisticsItemId"
    WHERE movement."quantity" < 0
       OR movement."quantity"::BIGINT * item."conversionFactor"::BIGINT > 2147483647
  ) THEN
    RAISE EXCEPTION 'Unit integrity migration would overflow historical INTEGER base quantities or encounter negative legacy quantities';
  END IF;
END
$$;

UPDATE "LogisticsItem"
SET
  "quantityBase" = "quantity" * "conversionFactor",
  "reservedQuantityBase" = "reservedQuantity" * "conversionFactor",
  "damagedQuantityBase" = "damagedQuantity" * "conversionFactor",
  "minimumQuantityBase" = "minimumQuantity" * "conversionFactor";

UPDATE "LogisticsRequest"
SET
  "requestedQuantity" = "quantity",
  "requestedUnit" = lower(trim("unit")),
  "baseQuantity" = "quantity" * CASE
    WHEN lower(trim("unit")) IN ('kg', 'kilogram', 'l', 'liter', 'ltr') THEN 1000
    ELSE 1
  END,
  "baseUnit" = CASE
    WHEN lower(trim("unit")) IN ('kg', 'kilogram', 'gram', 'gr', 'g') THEN 'g'
    WHEN lower(trim("unit")) IN ('l', 'liter', 'ltr', 'ml', 'mililiter', 'milliliter') THEN 'ml'
    WHEN lower(trim("unit")) IN ('pc', 'pcs', 'buah') THEN 'pcs'
    ELSE lower(trim("unit"))
  END,
  "unitDimension" = CASE
    WHEN lower(trim("unit")) IN ('kg', 'kilogram', 'gram', 'gr', 'g') THEN 'MASS'::"UnitDimension"
    WHEN lower(trim("unit")) IN ('l', 'liter', 'ltr', 'ml', 'mililiter', 'milliliter') THEN 'VOLUME'::"UnitDimension"
    ELSE 'COUNT'::"UnitDimension"
  END,
  "conversionFactor" = CASE
    WHEN lower(trim("unit")) IN ('kg', 'kilogram', 'l', 'liter', 'ltr') THEN 1000
    ELSE 1
  END,
  "conversionStatus" = CASE
    WHEN lower(trim("unit")) IN ('pc', 'pcs', 'buah', 'unit', 'kg', 'kilogram', 'gram', 'gr', 'g', 'l', 'liter', 'ltr', 'ml', 'mililiter', 'milliliter') THEN 'CONFIGURED'::"UnitConversionStatus"
    ELSE 'NEEDS_REVIEW'::"UnitConversionStatus"
  END
WHERE "baseQuantity" IS NULL;

UPDATE "Distribution"
SET
  "requestedQuantity" = "quantity",
  "requestedUnit" = lower(trim("unit")),
  "baseQuantity" = "quantity" * CASE
    WHEN lower(trim("unit")) IN ('kg', 'kilogram', 'l', 'liter', 'ltr') THEN 1000
    ELSE 1
  END,
  "baseUnit" = CASE
    WHEN lower(trim("unit")) IN ('kg', 'kilogram', 'gram', 'gr', 'g') THEN 'g'
    WHEN lower(trim("unit")) IN ('l', 'liter', 'ltr', 'ml', 'mililiter', 'milliliter') THEN 'ml'
    WHEN lower(trim("unit")) IN ('pc', 'pcs', 'buah') THEN 'pcs'
    ELSE lower(trim("unit"))
  END,
  "unitDimension" = CASE
    WHEN lower(trim("unit")) IN ('kg', 'kilogram', 'gram', 'gr', 'g') THEN 'MASS'::"UnitDimension"
    WHEN lower(trim("unit")) IN ('l', 'liter', 'ltr', 'ml', 'mililiter', 'milliliter') THEN 'VOLUME'::"UnitDimension"
    ELSE 'COUNT'::"UnitDimension"
  END,
  "conversionFactor" = CASE
    WHEN lower(trim("unit")) IN ('kg', 'kilogram', 'l', 'liter', 'ltr') THEN 1000
    ELSE 1
  END,
  "conversionStatus" = CASE
    WHEN lower(trim("unit")) IN ('pc', 'pcs', 'buah', 'unit', 'kg', 'kilogram', 'gram', 'gr', 'g', 'l', 'liter', 'ltr', 'ml', 'mililiter', 'milliliter') THEN 'CONFIGURED'::"UnitConversionStatus"
    ELSE 'NEEDS_REVIEW'::"UnitConversionStatus"
  END
WHERE "baseQuantity" IS NULL;

UPDATE "InventoryMovement" AS movement
SET
  "baseQuantity" = movement."quantity" * item."conversionFactor",
  "baseUnit" = item."baseUnit",
  "unitDimension" = item."unitDimension",
  "conversionFactor" = item."conversionFactor"
FROM "LogisticsItem" AS item
WHERE movement."logisticsItemId" = item."id"
  AND movement."baseQuantity" IS NULL;
