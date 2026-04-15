import { Prisma } from '@prisma/client';
import { applyTradeScoreAndUnlocksTx, type ApplyTradeScoreResult } from './creditScoreEngine.js';

export type ActorType = 'USER' | 'AGENT';

export interface UpdateScoreInput {
  actorType: ActorType;
  actorId: string;
  tradeExecutionId: number;
  isProfit: boolean;
  reason?: string;
}

export async function updateScoreTx(
  tx: Prisma.TransactionClient,
  input: UpdateScoreInput,
): Promise<ApplyTradeScoreResult | null> {
  if (input.actorType !== 'USER' && input.actorType !== 'AGENT') {
    throw new Error('actorType must be USER or AGENT');
  }

  const parsedActorId = Number(input.actorId);
  if (!Number.isFinite(parsedActorId) || parsedActorId < 1) {
    throw new Error('actorId must be a positive numeric identifier');
  }

  const existingScoreEvent = await tx.creditScoreEvent.findFirst({
    where: { tradeExecutionId: input.tradeExecutionId },
    select: { id: true },
  });
  if (existingScoreEvent) {
    return null;
  }

  return applyTradeScoreAndUnlocksTx(tx, {
    agentId: Math.trunc(parsedActorId),
    tradeExecutionId: input.tradeExecutionId,
    isProfit: input.isProfit,
    reason: input.reason,
  });
}
