-- Aprovação de cadastro de clientes (anti-malfeitor / anti-brincadeira):
-- todo o registo NOVO entra com status "pendente" e só fica ACTIVO quando
-- o ADMINISTRADOR PRINCIPAL o aprova na Central; se for recusado, fica
-- "rejeitado" com a mensagem do motivo (rejectReason) que o cliente vê
-- ao tentar entrar.
--
-- O default 'aprovado' garante que os clientes JÁ existentes na produção
-- continuam activos — ninguém perde o acesso com esta migração.

ALTER TABLE "Customer" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'aprovado';
ALTER TABLE "Customer" ADD COLUMN "rejectReason" TEXT;
ALTER TABLE "Customer" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN "reviewedByName" TEXT;
