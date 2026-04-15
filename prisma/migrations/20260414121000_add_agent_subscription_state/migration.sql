-- Add agent subscription state tracking for backend-managed OKX subscriptions.
CREATE TYPE "AgentSubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "Agent"
ADD COLUMN "subscriptionStatus" "AgentSubscriptionStatus",
ADD COLUMN "subscriptionTxHash" TEXT;
