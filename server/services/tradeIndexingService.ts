import { Prisma, PrismaClient, TradeExecutionStatus, TradeSide } from '@prisma/client';

export interface CreateIndexedTradeInput {
  agentId: number;
  pair: string;
  side: TradeSide;
  amount: number;
  status: TradeExecutionStatus;
  txHash?: string;
  pnlDelta?: number;
  errorMessage?: string;
  metadata?: unknown;
}

export async function createIndexedTrade(
  db: PrismaClient,
  input: CreateIndexedTradeInput,
) {
  const normalizedMetadata =
    input.metadata === undefined ? undefined : (input.metadata as Prisma.InputJsonValue);

  return db.tradeExecution.create({
    data: {
      agentId: input.agentId,
      pair: input.pair,
      side: input.side,
      amount: input.amount,
      status: input.status,
      txHash: input.txHash,
      pnlDelta: input.pnlDelta,
      errorMessage: input.errorMessage,
      metadata: normalizedMetadata,
    },
  });
}

export async function getAgentScoreSnapshot(db: PrismaClient, agentId: number) {
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      walletAddress: true,
      creditScore: true,
      successfulTrades: true,
      failedTrades: true,
      creditLineUnlocked: true,
      bonusUsd100Unlocked: true,
    },
  });
  if (!agent) {
    throw new Error('Agent not found');
  }
  return agent;
}
