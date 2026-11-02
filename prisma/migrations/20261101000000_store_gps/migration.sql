-- Localização GPS da base da empresa: o administrador captura o ponto
-- exacto de onde sai a mercadoria; o cliente acompanha a entrega desde aí.
ALTER TABLE "StoreConfig"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "locationAccuracy" DOUBLE PRECISION,
  ADD COLUMN "locationSource" TEXT,
  ADD COLUMN "locationUpdatedAt" TIMESTAMP(3);
