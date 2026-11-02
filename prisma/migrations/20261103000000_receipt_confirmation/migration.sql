-- Confirmação de recepção do cliente (anti-burla): quando o motoboy
-- marca a entrega como concluída, o cliente é notificado para CONFIRMAR
-- que recebeu a mercadoria — ou reclamar que não recebeu.
ALTER TABLE "Order"
  ADD COLUMN "receiptStatus" TEXT,
  ADD COLUMN "receiptConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "receiptDisputedAt" TIMESTAMP(3),
  ADD COLUMN "disputeReason" TEXT,
  ADD COLUMN "disputeResolution" TEXT,
  ADD COLUMN "disputeResolvedAt" TIMESTAMP(3);
