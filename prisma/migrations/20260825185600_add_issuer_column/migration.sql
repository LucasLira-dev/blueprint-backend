-- AlterTable: Add missing issuer column to account table
ALTER TABLE "account" ADD COLUMN "issuer" TEXT NOT NULL DEFAULT '';

-- CreateIndex: Add unique constraint for (issuer, accountId)
CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account"("issuer", "accountId");
