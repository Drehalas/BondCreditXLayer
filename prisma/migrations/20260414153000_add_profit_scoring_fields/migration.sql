-- Unified immediate profit-scoring fields for both manual users and agents.
CREATE TYPE "TradeActorType" AS ENUM ('USER', 'AGENT');

ALTER TABLE "TradeExecution"
ADD COLUMN "actorType" "TradeActorType" NOT NULL DEFAULT 'AGENT',
ADD COLUMN "actorId" TEXT,
ADD COLUMN "tokenIn" TEXT,
ADD COLUMN "tokenOut" TEXT,
ADD COLUMN "amountIn" DOUBLE PRECISION,
ADD COLUMN "amountOut" DOUBLE PRECISION,
ADD COLUMN "profit" DOUBLE PRECISION,
ADD COLUMN "isProfit" BOOLEAN,
ADD COLUMN "evaluatedPrice" DOUBLE PRECISION,
ADD COLUMN "evaluatedAt" TIMESTAMP(3);

-- Backfill actorId from existing agent relation for compatibility.
UPDATE "TradeExecution"
SET "actorId" = CAST("agentId" AS TEXT)
WHERE "actorId" IS NULL;
