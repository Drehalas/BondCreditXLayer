import { NextFunction, Request, Response, Router } from 'express';
import { TradeExecutionStatus, TradeSide } from '@prisma/client';
import { isAddress } from 'ethers';
import { getDbClient } from '../db/client.js';
import { getTradeExecutor } from '../services/tradeExecutor.js';
import { applyTradeScoreAndUnlocksTx } from '../services/creditScoreEngine.js';
import { getChainCatalog, getStaticTradeTokens } from '../services/tokenCatalog.js';

const router = Router();

const ALLOWED_SIDES = new Set<TradeSide>([
  TradeSide.BUY,
  TradeSide.SELL,
  TradeSide.LONG,
  TradeSide.SHORT,
  TradeSide.DEPOSIT,
]);

const demoRuns = new Map<string, unknown>();

function parseAgentId(input: number | string | undefined | null): number | null {
  if (input === undefined || input === null) return null;
  const numeric = typeof input === 'string' ? Number(input) : input;
  if (!Number.isFinite(numeric) || numeric < 1) return null;
  return numeric;
}

router.get('/trade/tokens', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const network = process.env.BONDCREDIT_NETWORK ?? 'xlayer-testnet';
    const tokenScope = (process.env.BONDCREDIT_TOKEN_LIST_SCOPE ?? 'mainnet').trim().toLowerCase();
    const tokens = getStaticTradeTokens(tokenScope);
    const chainCatalog = getChainCatalog();

    const pairs = tokens.flatMap(tokenIn =>
      tokens
        .filter(tokenOut => tokenOut.symbol !== tokenIn.symbol)
        .map(tokenOut => ({
          pair: `${tokenIn.symbol}/${tokenOut.symbol}`,
          tokenIn: {
            symbol: tokenIn.symbol,
            address: tokenIn.address,
            decimals: tokenIn.decimals,
          },
          tokenOut: {
            symbol: tokenOut.symbol,
            address: tokenOut.address,
            decimals: tokenOut.decimals,
          },
        })),
    );

    res.json({
      network,
      tokenScope,
      count: tokens.length,
      tokens,
      tradablePairs: pairs,
      warnings: tokens.length === 0 ? [
        'No token contracts found in static token list for selected scope.',
        'Current file looks like chain metadata catalog, not token-contract list.',
      ] : [],
      chainCatalogCount: chainCatalog.length,
      chainCatalogPreview: chainCatalog.slice(0, 10),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/trade/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      agentId,
      pair,
      side,
      amount,
      slippageBps,
      tokenIn,
      tokenOut,
    } = req.body as {
      agentId?: number | string;
      pair?: string;
      side?: string;
      amount?: number;
      slippageBps?: number;
      tokenIn?: string;
      tokenOut?: string;
    };

    if (agentId === undefined || agentId === null) {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }
    const numericAgentId = parseAgentId(agentId);
    if (numericAgentId === null) {
      res.status(400).json({ error: 'agentId must be a positive number' });
      return;
    }

    if (typeof pair !== 'string' || pair.trim().length < 3) {
      res.status(400).json({ error: 'pair is required (example: OKB/USDT)' });
      return;
    }

    if (typeof side !== 'string') {
      res.status(400).json({ error: 'side is required' });
      return;
    }
    const normalizedSide = side.trim().toUpperCase() as TradeSide;
    if (!ALLOWED_SIDES.has(normalizedSide)) {
      res.status(400).json({ error: 'side must be one of BUY, SELL, LONG, SHORT, DEPOSIT' });
      return;
    }

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'amount must be a positive number' });
      return;
    }

    const db = getDbClient();
    const agent = await db.agent.findUnique({
      where: { id: numericAgentId },
      select: {
        id: true,
        walletAddress: true,
        agenticWalletRegistered: true,
      },
    });
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    if (!isAddress(agent.walletAddress)) {
      res.status(500).json({ error: 'Agent walletAddress must be a valid EVM address' });
      return;
    }
    if (!agent.agenticWalletRegistered) {
      res.status(400).json({
        error: 'Agentic wallet is not registered for this agent. Complete registration first.',
      });
      return;
    }

    const executor = getTradeExecutor();
    const tradeResult = await executor.execute({
      walletAddress: agent.walletAddress,
      pair: pair.trim(),
      side: normalizedSide,
      amount,
      slippageBps,
      tokenIn,
      tokenOut,
    });

    const outcome = await db.$transaction(async tx => {
      const trade = await tx.tradeExecution.create({
        data: {
          agentId: agent.id,
          pair: pair.trim().toUpperCase(),
          side: normalizedSide,
          amount,
          status: tradeResult.status,
          txHash: tradeResult.txHash,
          pnlDelta: tradeResult.pnlDelta,
          errorMessage: tradeResult.errorMessage,
          metadata: tradeResult.metadata,
        },
      });

      const score = await applyTradeScoreAndUnlocksTx(tx, {
        agentId: agent.id,
        tradeExecutionId: trade.id,
        status: trade.status,
        reason:
          trade.status === TradeExecutionStatus.SUCCESS
            ? 'Uniswap trade success'
            : 'Uniswap trade failure',
      });

      return { trade, score };
    });

    res.json({
      executed: true,
      venue: tradeResult.executionVenue,
      trade: {
        id: outcome.trade.id,
        pair: outcome.trade.pair,
        side: outcome.trade.side,
        amount: outcome.trade.amount,
        status: outcome.trade.status,
        txHash: outcome.trade.txHash,
        pnlDelta: outcome.trade.pnlDelta,
        errorMessage: outcome.trade.errorMessage,
        executedAt: outcome.trade.executedAt,
      },
      score: {
        before: outcome.score.scoreBefore,
        after: outcome.score.scoreAfter,
        delta: outcome.score.delta,
        successfulTrades: outcome.score.successfulTrades,
        failedTrades: outcome.score.failedTrades,
      },
      unlocks: {
        creditLineUnlocked: outcome.score.creditLineUnlocked,
        bonusUsd100Unlocked: outcome.score.bonusUsd100Unlocked,
        newlyUnlocked: outcome.score.unlocksCreated,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/score/status/:agentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const numericAgentId = parseAgentId(req.params.agentId);
    if (numericAgentId === null) {
      res.status(400).json({ error: 'agentId must be a positive number' });
      return;
    }

    const db = getDbClient();
    const agent = await db.agent.findUnique({
      where: { id: numericAgentId },
      select: {
        id: true,
        walletAddress: true,
        creditScore: true,
        successfulTrades: true,
        failedTrades: true,
        creditLineUnlocked: true,
        bonusUsd100Unlocked: true,
        updatedAt: true,
      },
    });
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    res.json({
      agentId: agent.id,
      walletAddress: agent.walletAddress,
      score: agent.creditScore,
      successfulTrades: agent.successfulTrades,
      failedTrades: agent.failedTrades,
      unlocks: {
        creditLineUnlocked: agent.creditLineUnlocked,
        bonusUsd100Unlocked: agent.bonusUsd100Unlocked,
      },
      updatedAt: agent.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/trades/history/:agentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const numericAgentId = parseAgentId(req.params.agentId);
    if (numericAgentId === null) {
      res.status(400).json({ error: 'agentId must be a positive number' });
      return;
    }

    const limitRaw = req.query.limit;
    const parsedLimit = typeof limitRaw === 'string' ? Number(limitRaw) : 20;
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, Math.trunc(parsedLimit))) : 20;

    const db = getDbClient();
    const agent = await db.agent.findUnique({
      where: { id: numericAgentId },
      select: { id: true },
    });
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const trades = await db.tradeExecution.findMany({
      where: { agentId: numericAgentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        pair: true,
        side: true,
        amount: true,
        status: true,
        txHash: true,
        pnlDelta: true,
        errorMessage: true,
        executedAt: true,
        createdAt: true,
      },
    });

    res.json({
      agentId: numericAgentId,
      count: trades.length,
      trades,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/unlocks/:agentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const numericAgentId = parseAgentId(req.params.agentId);
    if (numericAgentId === null) {
      res.status(400).json({ error: 'agentId must be a positive number' });
      return;
    }

    const db = getDbClient();
    const agent = await db.agent.findUnique({
      where: { id: numericAgentId },
      select: { id: true },
    });
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const unlockEvents = await db.creditUnlockEvent.findMany({
      where: { agentId: numericAgentId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        type: true,
        threshold: true,
        scoreAtUnlock: true,
        successfulTradesAtUnlock: true,
        details: true,
        createdAt: true,
      },
    });

    res.json({
      agentId: numericAgentId,
      unlockCount: unlockEvents.length,
      unlocks: unlockEvents,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/demo/run-3-trades', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      agentId,
      idempotencyKey,
    } = req.body as {
      agentId?: number | string;
      idempotencyKey?: string;
    };

    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      res.status(400).json({ error: 'idempotencyKey is required' });
      return;
    }
    const normalizedKey = idempotencyKey.trim();
    const cached = demoRuns.get(normalizedKey);
    if (cached) {
      res.json({
        ...(cached as Record<string, unknown>),
        idempotentReplay: true,
      });
      return;
    }

    const numericAgentId = parseAgentId(agentId);
    if (numericAgentId === null) {
      res.status(400).json({ error: 'agentId must be a positive number' });
      return;
    }

    const db = getDbClient();
    const agent = await db.agent.findUnique({
      where: { id: numericAgentId },
      select: {
        id: true,
        walletAddress: true,
        agenticWalletRegistered: true,
      },
    });
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    if (!isAddress(agent.walletAddress)) {
      res.status(500).json({ error: 'Agent walletAddress must be a valid EVM address' });
      return;
    }
    if (!agent.agenticWalletRegistered) {
      res.status(400).json({
        error: 'Agentic wallet is not registered for this agent. Complete registration first.',
      });
      return;
    }

    const plan: Array<{ pair: string; side: TradeSide; amount: number; label: string }> = [
      { pair: 'OKB/USDT', side: TradeSide.BUY, amount: 10, label: 'trade-1-success' },
      { pair: 'OKB/USDT', side: TradeSide.SELL, amount: 1, label: 'trade-2-failure' },
      { pair: 'ETH/USDT', side: TradeSide.BUY, amount: 7, label: 'trade-3-success' },
    ];

    const executor = getTradeExecutor();
    const evidence: Array<Record<string, unknown>> = [];

    for (const item of plan) {
      const tradeResult = await executor.execute({
        walletAddress: agent.walletAddress,
        pair: item.pair,
        side: item.side,
        amount: item.amount,
        slippageBps: 50,
      });

      const outcome = await db.$transaction(async tx => {
        const trade = await tx.tradeExecution.create({
          data: {
            agentId: agent.id,
            pair: item.pair,
            side: item.side,
            amount: item.amount,
            status: tradeResult.status,
            txHash: tradeResult.txHash,
            pnlDelta: tradeResult.pnlDelta,
            errorMessage: tradeResult.errorMessage,
            metadata: {
              ...tradeResult.metadata,
              demoRun: true,
              demoLabel: item.label,
              demoIdempotencyKey: normalizedKey,
            },
          },
        });

        const score = await applyTradeScoreAndUnlocksTx(tx, {
          agentId: agent.id,
          tradeExecutionId: trade.id,
          status: trade.status,
          reason: `Demo run 3-trades: ${item.label}`,
        });

        return { trade, score };
      });

      evidence.push({
        label: item.label,
        tradeId: outcome.trade.id,
        pair: outcome.trade.pair,
        side: outcome.trade.side,
        amount: outcome.trade.amount,
        status: outcome.trade.status,
        txHash: outcome.trade.txHash,
        scoreBefore: outcome.score.scoreBefore,
        scoreAfter: outcome.score.scoreAfter,
        delta: outcome.score.delta,
        newlyUnlocked: outcome.score.unlocksCreated,
      });
    }

    const latestScore = await db.agent.findUnique({
      where: { id: agent.id },
      select: {
        creditScore: true,
        successfulTrades: true,
        failedTrades: true,
        creditLineUnlocked: true,
        bonusUsd100Unlocked: true,
      },
    });
    if (!latestScore) {
      res.status(500).json({ error: 'Agent score snapshot not found after demo run' });
      return;
    }

    const unlockEvents = await db.creditUnlockEvent.findMany({
      where: { agentId: agent.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        type: true,
        threshold: true,
        scoreAtUnlock: true,
        successfulTradesAtUnlock: true,
        createdAt: true,
      },
    });

    const payload = {
      demoRun: true,
      idempotencyKey: normalizedKey,
      idempotentReplay: false,
      executedTrades: evidence.length,
      evidence,
      score: latestScore,
      unlockEvents,
    };
    demoRuns.set(normalizedKey, payload);

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

export default router;
