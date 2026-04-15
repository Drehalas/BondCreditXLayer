import { CreditUnlockType, Prisma, PrismaClient, TradeExecutionStatus } from '@prisma/client';

export interface ApplyTradeScoreInput {
  agentId: number;
  tradeExecutionId: number;
  status?: TradeExecutionStatus;
  isProfit?: boolean;
  reason?: string;
}

export interface ApplyTradeScoreResult {
  scoreBefore: number;
  scoreAfter: number;
  delta: number;
  successfulTrades: number;
  failedTrades: number;
  creditLineUnlocked: boolean;
  bonusUsd100Unlocked: boolean;
  unlocksCreated: CreditUnlockType[];
}

const CREDIT_LINE_UNLOCK_THRESHOLD = 10;
const BONUS_100_SUCCESS_TRADES_THRESHOLD = 5;

export async function applyTradeScoreAndUnlocks(
  db: PrismaClient,
  input: ApplyTradeScoreInput,
): Promise<ApplyTradeScoreResult> {
  return db.$transaction(async tx => applyTradeScoreAndUnlocksTx(tx, input));
}

export async function applyTradeScoreAndUnlocksTx(
  tx: Prisma.TransactionClient,
  input: ApplyTradeScoreInput,
): Promise<ApplyTradeScoreResult> {
  const agent = await tx.agent.findUnique({
    where: { id: input.agentId },
    select: {
      id: true,
      creditScore: true,
      successfulTrades: true,
      failedTrades: true,
      creditLineUnlocked: true,
      bonusUsd100Unlocked: true,
    },
  });
  if (!agent) {
    throw new Error('Agent not found for score update');
  }

  const isProfit = typeof input.isProfit === 'boolean'
    ? input.isProfit
    : input.status === TradeExecutionStatus.SUCCESS;
  const delta = isProfit ? 1 : -1;
  const scoreBefore = agent.creditScore;
  const scoreAfter = scoreBefore + delta;

  const successfulTradesAfter = agent.successfulTrades + (delta > 0 ? 1 : 0);
  const failedTradesAfter = agent.failedTrades + (delta < 0 ? 1 : 0);

  const shouldUnlockCreditLine =
    !agent.creditLineUnlocked && scoreAfter >= CREDIT_LINE_UNLOCK_THRESHOLD;
  const shouldUnlockBonus100 =
    !agent.bonusUsd100Unlocked && successfulTradesAfter >= BONUS_100_SUCCESS_TRADES_THRESHOLD;

  const updated = await tx.agent.update({
    where: { id: input.agentId },
    data: {
      creditScore: scoreAfter,
      successfulTrades: successfulTradesAfter,
      failedTrades: failedTradesAfter,
      ...(shouldUnlockCreditLine ? { creditLineUnlocked: true } : {}),
      ...(shouldUnlockBonus100 ? { bonusUsd100Unlocked: true } : {}),
    },
    select: {
      creditScore: true,
      successfulTrades: true,
      failedTrades: true,
      creditLineUnlocked: true,
      bonusUsd100Unlocked: true,
    },
  });

  await tx.creditScoreEvent.create({
    data: {
      agentId: input.agentId,
      tradeExecutionId: input.tradeExecutionId,
      delta,
      reason:
        input.reason ??
        (isProfit ? 'Trade profitable' : 'Trade not profitable'),
      scoreBefore,
      scoreAfter: updated.creditScore,
      successfulTradesAfter: updated.successfulTrades,
      failedTradesAfter: updated.failedTrades,
    },
  });

  const unlocksCreated: CreditUnlockType[] = [];

  if (shouldUnlockCreditLine) {
    await tx.creditUnlockEvent.create({
      data: {
        agentId: input.agentId,
        type: CreditUnlockType.CREDIT_LINE_SCORE_10,
        threshold: CREDIT_LINE_UNLOCK_THRESHOLD,
        scoreAtUnlock: updated.creditScore,
        successfulTradesAtUnlock: updated.successfulTrades,
        details: { message: 'Credit line unlocked at score >= 10' },
      },
    });
    unlocksCreated.push(CreditUnlockType.CREDIT_LINE_SCORE_10);
  }

  if (shouldUnlockBonus100) {
    await tx.creditUnlockEvent.create({
      data: {
        agentId: input.agentId,
        type: CreditUnlockType.BONUS_USD_100_AFTER_5_WINS,
        threshold: BONUS_100_SUCCESS_TRADES_THRESHOLD,
        scoreAtUnlock: updated.creditScore,
        successfulTradesAtUnlock: updated.successfulTrades,
        details: { message: 'Unlocked demo $100 line after 5 successful trades' },
      },
    });
    unlocksCreated.push(CreditUnlockType.BONUS_USD_100_AFTER_5_WINS);
  }

  return {
    scoreBefore,
    scoreAfter: updated.creditScore,
    delta,
    successfulTrades: updated.successfulTrades,
    failedTrades: updated.failedTrades,
    creditLineUnlocked: updated.creditLineUnlocked,
    bonusUsd100Unlocked: updated.bonusUsd100Unlocked,
    unlocksCreated,
  };
}
