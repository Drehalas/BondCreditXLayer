import { NextFunction, Request, Response, Router } from 'express';
import { Prisma, TradeActorType, TradeExecutionStatus, TradeSide } from '@prisma/client';
import { isAddress } from 'ethers';
import { getDbClient } from '../db/client.js';
import { getTradeExecutor } from '../services/tradeExecutor.js';
import { getChainCatalog, getStaticTradeTokens } from '../services/tokenCatalog.js';
import {
  buildDexSwapTransaction,
  type BuiltTradeTransaction,
  executeDexTradeWithBackendSigner,
  fetchDexQuote,
  resolveTradeToken,
  type TradeQuoteResult,
} from '../services/okxDexTradeService.js';
import { verifyTradeTransaction } from '../services/tradeTransactionVerification.js';
import { getPrice } from '../services/priceService.js';
import { calculateProfit } from '../services/profitService.js';
import { updateScoreTx } from '../services/scoreService.js';

const router = Router();

const ALLOWED_SIDES = new Set<TradeSide>([
  TradeSide.BUY,
  TradeSide.SELL,
  TradeSide.LONG,
  TradeSide.SHORT,
  TradeSide.DEPOSIT,
]);

const demoRuns = new Map<string, unknown>();
const executeTradeRuns = new Map<string, Promise<unknown>>();

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;

function resolveActiveNetwork(): string {
  return (process.env.BONDCREDIT_NETWORK ?? 'xlayer-mainnet').trim().toLowerCase();
}

function resolveRpcUrlForNetwork(network: string): string {
  if (network === 'xlayer-mainnet') {
    return process.env.XLAYER_MAINNET_RPC_URL || 'https://rpc.xlayer.tech';
  }
  return process.env.XLAYER_TESTNET_RPC_URL || 'https://testrpc.xlayer.tech';
}

function parseTradeStatus(status: string | undefined): TradeExecutionStatus {
  if (typeof status === 'string' && status.trim().toUpperCase() === TradeExecutionStatus.FAILED) {
    return TradeExecutionStatus.FAILED;
  }
  return TradeExecutionStatus.SUCCESS;
}

function parseHistoryStatusFilter(status: unknown): TradeExecutionStatus | null {
  if (typeof status !== 'string' || !status.trim()) return null;
  const normalized = status.trim().toUpperCase();
  if (normalized === TradeExecutionStatus.SUCCESS) return TradeExecutionStatus.SUCCESS;
  if (normalized === TradeExecutionStatus.FAILED) return TradeExecutionStatus.FAILED;
  return null;
}

function parsePageNumber(value: unknown): number {
  if (typeof value !== 'string') return 1;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.trunc(parsed));
}

function parsePageSize(value: unknown): number {
  if (typeof value !== 'string') return 20;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(100, Math.trunc(parsed)));
}

function validateRecordTradeInput(input: {
  pair?: string;
  side?: string;
  amount?: number;
  txHash?: string;
}): { pair: string; side: TradeSide; amount: number; txHash: string } | null {
  if (typeof input.pair !== 'string' || input.pair.trim().length < 3) return null;
  if (typeof input.side !== 'string') return null;

  const normalizedSide = input.side.trim().toUpperCase() as TradeSide;
  if (!ALLOWED_SIDES.has(normalizedSide)) return null;
  if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount <= 0) return null;
  if (typeof input.txHash !== 'string' || !TX_HASH_REGEX.test(input.txHash)) return null;

  return {
    pair: input.pair,
    side: normalizedSide,
    amount: input.amount,
    txHash: input.txHash,
  };
}

function parseAgentId(input: number | string | undefined | null): number | null {
  if (input === undefined || input === null) return null;
  const numeric = typeof input === 'string' ? Number(input) : input;
  if (!Number.isFinite(numeric) || numeric < 1) return null;
  return numeric;
}

function parseTradeAmount(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input) && input > 0) return input;
  if (typeof input === 'string' && input.trim()) {
    const parsed = Number(input);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function parsePairSymbol(input: string | undefined): { tokenIn: string; tokenOut: string } | null {
  if (!input || typeof input !== 'string') return null;
  const [rawTokenIn, rawTokenOut] = input.split('/');
  if (!rawTokenIn || !rawTokenOut) return null;
  const tokenIn = rawTokenIn.trim();
  const tokenOut = rawTokenOut.trim();
  if (!tokenIn || !tokenOut) return null;
  return { tokenIn, tokenOut };
}

function getRequestedTradePair(input: {
  tokenIn?: string;
  tokenOut?: string;
  pair?: string;
}): { tokenIn: string; tokenOut: string } | null {
  if (typeof input.tokenIn === 'string' && typeof input.tokenOut === 'string') {
    return { tokenIn: input.tokenIn.trim(), tokenOut: input.tokenOut.trim() };
  }

  return parsePairSymbol(input.pair);
}

function parseTxHash(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  return TX_HASH_REGEX.test(trimmed) ? trimmed : null;
}

function getExecutionIdempotencyKey(input: Record<string, unknown>): string | null {
  const raw = input.idempotencyKey;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim();
}

function normalizeStoreRequestMetadata(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== 'object') return undefined;
  return input as Record<string, unknown>;
}

function toJsonValue<T>(input: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue;
}

function readExpectedTradeValues(metadata: Record<string, unknown> | undefined): {
  expectedToAddress?: string;
  expectedValueWei?: bigint;
  expectedData?: string;
} {
  if (!metadata) return {};

  const expectedToAddress = typeof metadata.expectedToAddress === 'string' && metadata.expectedToAddress.trim()
    ? metadata.expectedToAddress.trim()
    : typeof metadata.to === 'string' && metadata.to.trim()
      ? metadata.to.trim()
      : typeof metadata.routerAddress === 'string' && metadata.routerAddress.trim()
        ? metadata.routerAddress.trim()
        : undefined;

  const expectedValueSource = metadata.expectedValueWei ?? metadata.value;
  const expectedValueWei = (() => {
    if (typeof expectedValueSource === 'bigint') return expectedValueSource;
    if (typeof expectedValueSource === 'number' && Number.isFinite(expectedValueSource)) return BigInt(Math.trunc(expectedValueSource));
    if (typeof expectedValueSource === 'string' && expectedValueSource.trim()) {
      try {
        return BigInt(expectedValueSource.trim());
      } catch {
        return undefined;
      }
    }
    return undefined;
  })();

  const expectedData = typeof metadata.expectedData === 'string' && metadata.expectedData.trim()
    ? metadata.expectedData.trim()
    : typeof metadata.data === 'string' && metadata.data.trim()
      ? metadata.data.trim()
      : undefined;

  return {
    expectedToAddress,
    expectedValueWei,
    expectedData,
  };
}

function readNumericCandidate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readAmountOutFromMetadata(metadata: Record<string, unknown> | undefined): number | null {
  if (!metadata) return null;
  const candidates = [
    metadata.amountOut,
    metadata.expectedOutput,
    metadata.toTokenAmount,
    metadata.outAmount,
    metadata.outputAmount,
  ];

  for (const candidate of candidates) {
    const parsed = readNumericCandidate(candidate);
    if (parsed !== null && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

function buildQuoteDiagnostics(quote: TradeQuoteResult): {
  hasRoute: boolean;
  priceImpactAvailable: boolean;
  expectedOutputPresent: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const hasRoute = quote.route !== undefined && quote.route !== null;
  const priceImpactAvailable = quote.priceImpact !== 'unavailable';
  const expectedOutputPresent = Boolean(quote.expectedOutput);

  if (!hasRoute) {
    warnings.push('No route details were returned by upstream quote payload.');
  }
  if (!priceImpactAvailable) {
    warnings.push('Price impact metadata is unavailable for this quote.');
  }
  if (!expectedOutputPresent) {
    warnings.push('Expected output amount is missing from quote response.');
  }

  return {
    hasRoute,
    priceImpactAvailable,
    expectedOutputPresent,
    warnings,
  };
}

function buildTxDiagnostics(transaction: BuiltTradeTransaction): {
  hasRoute: boolean;
  hasToAddress: boolean;
  hasDataPayload: boolean;
  txDataBytes: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const hasRoute = transaction.route !== undefined && transaction.route !== null;
  const hasToAddress = Boolean(transaction.to);
  const hasDataPayload = Boolean(transaction.data && transaction.data.length > 2);
  const hexBodyLength = transaction.data?.startsWith('0x') ? transaction.data.length - 2 : transaction.data?.length ?? 0;
  const txDataBytes = Math.max(0, Math.floor(hexBodyLength / 2));

  if (!hasRoute) {
    warnings.push('No route details were returned by upstream build payload.');
  }
  if (!hasToAddress) {
    warnings.push('Swap transaction target address is missing.');
  }
  if (!hasDataPayload) {
    warnings.push('Swap transaction calldata is missing or empty.');
  }

  return {
    hasRoute,
    hasToAddress,
    hasDataPayload,
    txDataBytes,
    warnings,
  };
}

function validateBuiltSwapTransactionForResponse(transaction: BuiltTradeTransaction): void {
  if (!isAddress(transaction.to)) {
    throw new Error(`Build transaction returned invalid destination address: ${transaction.to}`);
  }

  const data = transaction.data;
  const hasValidHex = /^0x[0-9a-fA-F]+$/.test(data);
  const hasSelector = data.length >= 10;
  const hasEvenLength = (data.length - 2) % 2 === 0;
  if (!hasValidHex || !hasSelector || !hasEvenLength) {
    throw new Error('Build transaction returned invalid calldata (expected hex data with function selector).');
  }
}

function ensureSupportedTokenSymbol(tokenSymbol: string): string {
  const token = resolveTradeToken(tokenSymbol, process.env.BONDCREDIT_TOKEN_LIST_SCOPE);
  if (!token) {
    throw new Error(`Unsupported token: ${tokenSymbol}`);
  }
  return token.symbol;
}

async function evaluateTradeProfit(input: {
  status: TradeExecutionStatus;
  amountIn: number;
  amountOut: number | null;
  tokenOutSymbol: string;
}): Promise<{
  amountOut: number | null;
  evaluatedPrice: number | null;
  evaluatedAt: Date | null;
  profit: number | null;
  isProfit: boolean;
}> {
  if (input.status !== TradeExecutionStatus.SUCCESS) {
    return {
      amountOut: input.amountOut,
      evaluatedPrice: null,
      evaluatedAt: new Date(),
      profit: null,
      isProfit: false,
    };
  }

  if (input.amountOut === null) {
    throw new Error('amountOut is required for profit evaluation on successful trades');
  }

  const supportedTokenOut = ensureSupportedTokenSymbol(input.tokenOutSymbol);
  const price = await getPrice(supportedTokenOut);
  const result = calculateProfit(input.amountIn, input.amountOut, price);

  return {
    amountOut: input.amountOut,
    evaluatedPrice: price,
    evaluatedAt: new Date(),
    profit: result.profit,
    isProfit: result.isProfit,
  };
}

async function resolveAgentForExecution(input: {
  db: ReturnType<typeof getDbClient>;
  agentId?: number | string;
  walletAddress?: string;
}): Promise<{
  agent: { id: number; walletAddress: string; agenticWalletRegistered: boolean } | null;
  error?: string;
  status?: number;
}> {
  const numericAgentId = parseAgentId(input.agentId);
  const rawWallet = typeof input.walletAddress === 'string' ? input.walletAddress.trim() : '';
  const normalizedWalletAddress = rawWallet.length > 0 ? rawWallet.toLowerCase() : null;

  if (numericAgentId === null && normalizedWalletAddress === null) {
    return { agent: null, error: 'Either agentId or walletAddress is required', status: 400 };
  }

  if (normalizedWalletAddress !== null && !isAddress(normalizedWalletAddress)) {
    return { agent: null, error: 'walletAddress must be a valid EVM address', status: 400 };
  }

  if (numericAgentId !== null && normalizedWalletAddress !== null) {
    const agent = await input.db.agent.findUnique({
      where: { id: numericAgentId },
      select: {
        id: true,
        walletAddress: true,
        agenticWalletRegistered: true,
      },
    });

    if (agent?.walletAddress?.toLowerCase() !== normalizedWalletAddress) {
      return { agent: null, error: 'agentId and walletAddress do not belong to the same agent', status: 400 };
    }
    return { agent };
  }

  if (numericAgentId !== null) {
    const agent = await input.db.agent.findUnique({
      where: { id: numericAgentId },
      select: {
        id: true,
        walletAddress: true,
        agenticWalletRegistered: true,
      },
    });
    return { agent };
  }

  if (normalizedWalletAddress === null) {
    return { agent: null, error: 'walletAddress is required when agentId is not provided', status: 400 };
  }

  const agent = await input.db.agent.findUnique({
    where: { walletAddress: normalizedWalletAddress },
    select: {
      id: true,
      walletAddress: true,
      agenticWalletRegistered: true,
    },
  });
  return { agent };
}

async function handleTokens(_req: Request, res: Response, next: NextFunction) {
  try {
    const network = process.env.BONDCREDIT_NETWORK ?? 'xlayer-mainnet';
    const tokenScope = (process.env.BONDCREDIT_TOKEN_LIST_SCOPE ?? 'mainnet').trim().toLowerCase();
    const executionMode = (process.env.BONDCREDIT_TRADE_EXECUTOR_MODE ?? 'simulated').trim().toLowerCase();
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
      executionMode,
      tokenSource: 'static',
      count: tokens.length,
      tokens,
      tradablePairs: pairs,
      warnings: tokens.length === 0 ? ['Static token list returned no tokens for selected scope.'] : [],
      chainCatalogCount: chainCatalog.length,
      chainCatalogPreview: chainCatalog.slice(0, 10),
    });
  } catch (error) {
    next(error);
  }
}

router.get('/trade/tokens', handleTokens);
router.get('/tokens', handleTokens);

router.get('/quote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokenInput = getRequestedTradePair({
      tokenIn: typeof req.query.tokenIn === 'string' ? req.query.tokenIn : undefined,
      tokenOut: typeof req.query.tokenOut === 'string' ? req.query.tokenOut : undefined,
      pair: typeof req.query.pair === 'string' ? req.query.pair : undefined,
    });
    const amount = parseTradeAmount(req.query.amount);
    if (!tokenInput) {
      res.status(400).json({ error: 'tokenIn and tokenOut (or pair) are required' });
      return;
    }
    if (amount === null) {
      res.status(400).json({ error: 'amount must be a positive number' });
      return;
    }

    console.log('[tradeRoute] /quote inbound', {
      tokenIn: tokenInput.tokenIn,
      tokenOut: tokenInput.tokenOut,
      amount,
      userAddress: typeof req.query.userAddress === 'string' ? req.query.userAddress : undefined,
      slippageBps: typeof req.query.slippageBps === 'string' ? Number(req.query.slippageBps) : undefined,
      chainId: typeof req.query.chainId === 'string' ? Number(req.query.chainId) : undefined,
    });

    const quote = await fetchDexQuote({
      tokenIn: tokenInput.tokenIn,
      tokenOut: tokenInput.tokenOut,
      amount,
      userAddress: typeof req.query.userAddress === 'string' ? req.query.userAddress : undefined,
      slippageBps: typeof req.query.slippageBps === 'string' ? Number(req.query.slippageBps) : undefined,
      chainId: typeof req.query.chainId === 'string' ? Number(req.query.chainId) : undefined,
    });

    res.json({
      pair: `${quote.tokenIn.symbol}/${quote.tokenOut.symbol}`,
      tokenIn: quote.tokenIn.symbol,
      tokenOut: quote.tokenOut.symbol,
      amount,
      expectedOutput: quote.expectedOutput,
      priceImpact: quote.priceImpact,
      route: quote.route,
      diagnostics: buildQuoteDiagnostics(quote),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/build-tx', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokenInput = getRequestedTradePair({
      tokenIn: typeof req.query.tokenIn === 'string' ? req.query.tokenIn : undefined,
      tokenOut: typeof req.query.tokenOut === 'string' ? req.query.tokenOut : undefined,
      pair: typeof req.query.pair === 'string' ? req.query.pair : undefined,
    });
    const amount = parseTradeAmount(req.query.amount);
    const userAddress = typeof req.query.userAddress === 'string' ? req.query.userAddress.trim() : '';

    if (!tokenInput) {
      res.status(400).json({ error: 'tokenIn and tokenOut (or pair) are required' });
      return;
    }
    if (amount === null) {
      res.status(400).json({ error: 'amount must be a positive number' });
      return;
    }
    if (!isAddress(userAddress)) {
      res.status(400).json({ error: 'userAddress must be a valid EVM address' });
      return;
    }

    console.log('[tradeRoute] /build-tx inbound', {
      tokenIn: tokenInput.tokenIn,
      tokenOut: tokenInput.tokenOut,
      amount,
      userAddress,
      slippageBps: typeof req.query.slippageBps === 'string' ? Number(req.query.slippageBps) : undefined,
      chainId: typeof req.query.chainId === 'string' ? Number(req.query.chainId) : undefined,
    });

    const transaction = await buildDexSwapTransaction({
      tokenIn: tokenInput.tokenIn,
      tokenOut: tokenInput.tokenOut,
      amount,
      userAddress,
      slippageBps: typeof req.query.slippageBps === 'string' ? Number(req.query.slippageBps) : undefined,
      chainId: typeof req.query.chainId === 'string' ? Number(req.query.chainId) : undefined,
    });
    validateBuiltSwapTransactionForResponse(transaction);

    res.json({
      pair: `${transaction.tokenIn.symbol}/${transaction.tokenOut.symbol}`,
      tokenIn: transaction.tokenIn.symbol,
      tokenOut: transaction.tokenOut.symbol,
      amount,
      to: transaction.to,
      data: transaction.data,
      value: transaction.value,
      gasLimit: transaction.gasLimit,
      gasPrice: transaction.gasPrice,
      maxFeePerGas: transaction.maxFeePerGas,
      maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
      expectedOutput: transaction.expectedOutput,
      priceImpact: transaction.priceImpact,
      route: transaction.route,
      diagnostics: buildTxDiagnostics(transaction),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/execute-trade', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      agentId,
      walletAddress,
      pair,
      tokenIn,
      tokenOut,
      amount,
      slippageBps,
      idempotencyKey,
    } = req.body as {
      agentId?: number | string;
      walletAddress?: string;
      pair?: string;
      tokenIn?: string;
      tokenOut?: string;
      amount?: number;
      slippageBps?: number;
      idempotencyKey?: string;
    };

    const dedupeKey = getExecutionIdempotencyKey({
      idempotencyKey,
      agentId,
      walletAddress,
      pair,
      tokenIn,
      tokenOut,
      amount,
      slippageBps,
    } as Record<string, unknown>);
    if (dedupeKey) {
      const cached = executeTradeRuns.get(dedupeKey);
      if (cached) {
        const replay = await cached;
        res.json({ ...(replay as Record<string, unknown>), idempotentReplay: true });
        return;
      }
    }

    const promise = (async () => {
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        throw new Error('amount must be a positive number');
      }

      const db = getDbClient();
      const resolved = await resolveAgentForExecution({ db, agentId, walletAddress });
      if (resolved.error) {
        const error = new Error(resolved.error);
        (error as Error & { status?: number }).status = resolved.status ?? 400;
        throw error;
      }

      const agent = resolved.agent;
      if (!agent) {
        const error = new Error('Agent not found for provided identity');
        (error as Error & { status?: number }).status = 404;
        throw error;
      }
      if (!isAddress(agent.walletAddress)) {
        throw new Error('Agent walletAddress must be a valid EVM address');
      }
      if (!agent.agenticWalletRegistered) {
        throw new Error('Agentic wallet is not registered for this agent. Complete registration first.');
      }

      const requestedPair = getRequestedTradePair({ tokenIn, tokenOut, pair });
      if (!requestedPair) {
        throw new Error('tokenIn and tokenOut (or pair) are required');
      }

      const result = await executeDexTradeWithBackendSigner({
        actorWalletAddress: agent.walletAddress,
        userAddress: agent.walletAddress,
        tokenIn: requestedPair.tokenIn,
        tokenOut: requestedPair.tokenOut,
        amount,
        slippageBps,
      });

      let verified: Awaited<ReturnType<typeof verifyTradeTransaction>> | null = null;
      let verificationError: string | null = null;
      try {
        const rpcUrl = resolveRpcUrlForNetwork(resolveActiveNetwork());
        verified = await verifyTradeTransaction({
          rpcUrl,
          txHash: result.txHash,
          expectedFromAddress: result.broadcasterAddress,
          expectedToAddress: result.builtTx.to,
          expectedValueWei: BigInt(result.builtTx.value),
          expectedData: result.builtTx.data,
        });
      } catch (error) {
        verificationError = error instanceof Error ? error.message : 'Trade verification failed';
      }

      const tradeStatus = verified ? TradeExecutionStatus.SUCCESS : TradeExecutionStatus.FAILED;
      const tokenInSymbol = result.quote.tokenIn.symbol;
      const tokenOutSymbol = result.quote.tokenOut.symbol;
      const amountIn = amount;
      const amountOut = readNumericCandidate(result.quote.expectedOutput);
      const evaluation = await evaluateTradeProfit({
        status: tradeStatus,
        amountIn,
        amountOut,
        tokenOutSymbol,
      });

      const outcome = await db.$transaction(async tx => {
        const existing = await tx.tradeExecution.findFirst({
          where: { agentId: agent.id, txHash: result.txHash },
          select: {
            id: true,
            pair: true,
            side: true,
            amount: true,
            amountIn: true,
            amountOut: true,
            tokenIn: true,
            tokenOut: true,
            status: true,
            txHash: true,
            pnlDelta: true,
            profit: true,
            isProfit: true,
            errorMessage: true,
            evaluatedPrice: true,
            evaluatedAt: true,
            executedAt: true,
          },
        });
        if (existing) {
          const existingScore = await tx.creditScoreEvent.findFirst({
            where: { tradeExecutionId: existing.id },
            select: { id: true },
          });
          return { trade: existing, score: null, scoreAlreadyApplied: !!existingScore, idempotentReplay: true };
        }

        const trade = await tx.tradeExecution.create({
          data: {
            agentId: agent.id,
            actorType: TradeActorType.AGENT,
            actorId: String(agent.id),
            pair: `${result.quote.tokenIn.symbol}/${result.quote.tokenOut.symbol}`,
            tokenIn: tokenInSymbol,
            tokenOut: tokenOutSymbol,
            side: TradeSide.BUY,
            amount,
            amountIn,
            amountOut: evaluation.amountOut,
            status: tradeStatus,
            txHash: result.txHash,
            pnlDelta: evaluation.profit,
            profit: evaluation.profit,
            isProfit: evaluation.isProfit,
            evaluatedPrice: evaluation.evaluatedPrice,
            evaluatedAt: evaluation.evaluatedAt,
            errorMessage: verificationError,
            metadata: toJsonValue({
              executionVenue: 'okx-dex',
              broadcasterAddress: result.broadcasterAddress,
              quote: result.quote,
              builtTx: result.builtTx,
              verified,
              verificationError,
            }),
          },
        });

        const score = await updateScoreTx(tx, {
          actorType: TradeActorType.AGENT,
          actorId: String(agent.id),
          tradeExecutionId: trade.id,
          isProfit: evaluation.isProfit,
          reason: trade.status === TradeExecutionStatus.SUCCESS
            ? (evaluation.isProfit ? 'OKX trade profitable' : 'OKX trade not profitable')
            : (verificationError ?? 'OKX trade failed on-chain'),
        });

        return { trade, score, scoreAlreadyApplied: false, idempotentReplay: false };
      });

      return {
        executed: true,
        venue: 'okx-dex',
        idempotentReplay: outcome.idempotentReplay,
        trade: {
          id: outcome.trade.id,
          pair: outcome.trade.pair,
          side: outcome.trade.side,
          amount: outcome.trade.amount,
          amountIn: outcome.trade.amountIn,
          amountOut: outcome.trade.amountOut,
          tokenIn: outcome.trade.tokenIn,
          tokenOut: outcome.trade.tokenOut,
          status: outcome.trade.status,
          txHash: outcome.trade.txHash,
          pnlDelta: outcome.trade.pnlDelta,
          profit: outcome.trade.profit,
          isProfit: outcome.trade.isProfit,
          evaluatedPrice: outcome.trade.evaluatedPrice,
          evaluatedAt: outcome.trade.evaluatedAt,
          errorMessage: outcome.trade.errorMessage,
          executedAt: outcome.trade.executedAt,
        },
        score: outcome.score
          ? {
              before: outcome.score.scoreBefore,
              after: outcome.score.scoreAfter,
              delta: outcome.score.delta,
              successfulTrades: outcome.score.successfulTrades,
              failedTrades: outcome.score.failedTrades,
            }
          : null,
        unlocks: outcome.score
          ? {
              creditLineUnlocked: outcome.score.creditLineUnlocked,
              bonusUsd100Unlocked: outcome.score.bonusUsd100Unlocked,
              newlyUnlocked: outcome.score.unlocksCreated,
            }
          : null,
        scoreAlreadyApplied: outcome.scoreAlreadyApplied,
      };
    })();

    const trackedPromise = promise.finally(() => {
      if (dedupeKey) executeTradeRuns.delete(dedupeKey);
    });
    if (dedupeKey) executeTradeRuns.set(dedupeKey, trackedPromise);

    const result = await trackedPromise;
    res.json(result);
  } catch (error) {
    next(error);
  }
});

async function persistStoredTransaction(req: Request, res: Response) {
  const {
    pair,
    side,
    amount,
    txHash,
    status,
    pnlDelta,
    errorMessage,
    walletAddress,
    signerAddress,
    userId,
    metadata,
  } = req.body as {
    pair?: string;
    side?: string;
    amount?: number;
    txHash?: string;
    status?: string;
    pnlDelta?: number;
    errorMessage?: string;
    walletAddress?: string;
    signerAddress?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  };

  const parsed = validateRecordTradeInput({ pair, side, amount, txHash });
  if (!parsed) {
    res.status(400).json({ error: 'Invalid request payload for trade recording' });
    return;
  }

  const identityWallet = walletAddress ?? signerAddress ?? userId;
  if (!identityWallet || !isAddress(identityWallet)) {
    res.status(400).json({ error: 'walletAddress, signerAddress, or userId must be provided and valid' });
    return;
  }

  const db = getDbClient();
  const agent = await db.agent.findUnique({
    where: { walletAddress: identityWallet.toLowerCase() },
    select: {
      id: true,
      walletAddress: true,
      agenticWalletRegistered: true,
    },
  });

  if (!agent) {
    res.status(404).json({ error: 'Agent not found; walletAddress must match an enrolled agent' });
    return;
  }
  if (!agent.agenticWalletRegistered) {
    res.status(400).json({ error: 'Agentic wallet is not registered for this agent. Complete registration first.' });
    return;
  }

  let verification: Awaited<ReturnType<typeof verifyTradeTransaction>> | null = null;
  let verificationError: string | null = null;
  try {
    const rpcUrl = resolveRpcUrlForNetwork(resolveActiveNetwork());
    verification = await verifyTradeTransaction({
      rpcUrl,
      txHash: parsed.txHash,
      expectedFromAddress: typeof metadata?.expectedFromAddress === 'string' ? metadata.expectedFromAddress : identityWallet,
      ...readExpectedTradeValues(normalizeStoreRequestMetadata(metadata)),
    });
  } catch (error) {
    verificationError = error instanceof Error ? error.message : 'Trade verification failed';
  }

  const normalizedStatus = verification ? TradeExecutionStatus.SUCCESS : TradeExecutionStatus.FAILED;

  const outcome = await db.$transaction(async tx => {
    const existing = await tx.tradeExecution.findFirst({
      where: { agentId: agent.id, txHash: parsed.txHash },
      select: {
        id: true,
        pair: true,
        side: true,
        amount: true,
        amountIn: true,
        amountOut: true,
        tokenIn: true,
        tokenOut: true,
        status: true,
        txHash: true,
        pnlDelta: true,
        profit: true,
        isProfit: true,
        evaluatedPrice: true,
        evaluatedAt: true,
        errorMessage: true,
        executedAt: true,
      },
    });
    if (existing) {
      const existingScore = await tx.creditScoreEvent.findFirst({
        where: { tradeExecutionId: existing.id },
        select: { id: true },
      });
      return { trade: existing, score: null, scoreAlreadyApplied: !!existingScore };
    }

    const pairTokens = parsePairSymbol(parsed.pair);
    if (!pairTokens) {
      throw new Error('pair must be formatted as TOKEN_IN/TOKEN_OUT');
    }
    ensureSupportedTokenSymbol(pairTokens.tokenIn);
    ensureSupportedTokenSymbol(pairTokens.tokenOut);

    const amountIn = parsed.amount;
    const amountOutFromRequest = readNumericCandidate(pnlDelta) ?? readAmountOutFromMetadata(normalizeStoreRequestMetadata(metadata));
    const evaluation = await evaluateTradeProfit({
      status: normalizedStatus,
      amountIn,
      amountOut: amountOutFromRequest,
      tokenOutSymbol: pairTokens.tokenOut,
    });

    const trade = await tx.tradeExecution.create({
      data: {
        agentId: agent.id,
        actorType: TradeActorType.USER,
        actorId: String(agent.id),
        pair: parsed.pair.trim().toUpperCase(),
        tokenIn: pairTokens.tokenIn.toUpperCase(),
        tokenOut: pairTokens.tokenOut.toUpperCase(),
        side: parsed.side,
        amount: parsed.amount,
        amountIn,
        amountOut: evaluation.amountOut,
        status: normalizedStatus,
        txHash: parsed.txHash,
        pnlDelta: evaluation.profit,
        profit: evaluation.profit,
        isProfit: evaluation.isProfit,
        evaluatedPrice: evaluation.evaluatedPrice,
        evaluatedAt: evaluation.evaluatedAt,
        errorMessage: verificationError ?? (typeof errorMessage === 'string' ? errorMessage : null),
        metadata: toJsonValue({
          executionVenue: 'uniswap-user-signed',
          verification,
          verificationError,
          ...metadata,
        }),
      },
    });

    const score = await updateScoreTx(tx, {
      actorType: TradeActorType.USER,
      actorId: String(agent.id),
      tradeExecutionId: trade.id,
      isProfit: evaluation.isProfit,
      reason: trade.status === TradeExecutionStatus.SUCCESS
        ? (evaluation.isProfit ? 'User-signed trade profitable' : 'User-signed trade not profitable')
        : 'User-signed trade failed on-chain',
    });

    return { trade, score, scoreAlreadyApplied: false };
  });

  if (!outcome.score && outcome.scoreAlreadyApplied) {
    res.json({ recorded: true, duplicate: true, scoreAlreadyApplied: true, txHash: parsed.txHash });
    return;
  }

  res.json({
    recorded: true,
    trade: {
      id: outcome.trade.id,
      pair: outcome.trade.pair,
      side: outcome.trade.side,
      amount: outcome.trade.amount,
      amountIn: outcome.trade.amountIn,
      amountOut: outcome.trade.amountOut,
      tokenIn: outcome.trade.tokenIn,
      tokenOut: outcome.trade.tokenOut,
      status: outcome.trade.status,
      txHash: outcome.trade.txHash,
      pnlDelta: outcome.trade.pnlDelta,
      profit: outcome.trade.profit,
      isProfit: outcome.trade.isProfit,
      evaluatedPrice: outcome.trade.evaluatedPrice,
      evaluatedAt: outcome.trade.evaluatedAt,
      errorMessage: outcome.trade.errorMessage,
      executedAt: outcome.trade.executedAt,
    },
    score: outcome.score
      ? {
          before: outcome.score.scoreBefore,
          after: outcome.score.scoreAfter,
          delta: outcome.score.delta,
          successfulTrades: outcome.score.successfulTrades,
          failedTrades: outcome.score.failedTrades,
        }
      : null,
    unlocks: outcome.score
      ? {
          creditLineUnlocked: outcome.score.creditLineUnlocked,
          bonusUsd100Unlocked: outcome.score.bonusUsd100Unlocked,
          newlyUnlocked: outcome.score.unlocksCreated,
        }
      : null,
  });
}

router.post('/store-transaction', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await persistStoredTransaction(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/trade/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      agentId,
      walletAddress,
      pair,
      side,
      amount,
      slippageBps,
      tokenIn,
      tokenOut,
    } = req.body as {
      agentId?: number | string;
      walletAddress?: string;
      pair?: string;
      side?: string;
      amount?: number;
      slippageBps?: number;
      tokenIn?: string;
      tokenOut?: string;
    };

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
    const resolved = await resolveAgentForExecution({ db, agentId, walletAddress });
    if (resolved.error) {
      res.status(resolved.status ?? 400).json({ error: resolved.error });
      return;
    }

    const agent = resolved.agent;
    if (!agent) {
      res.status(404).json({ error: 'Agent not found for provided identity' });
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

    const normalizedPair = pair.trim().toUpperCase();
    const pairTokens = parsePairSymbol(normalizedPair);
    if (!pairTokens) {
      res.status(400).json({ error: 'pair must be formatted as TOKEN_IN/TOKEN_OUT' });
      return;
    }
    ensureSupportedTokenSymbol(pairTokens.tokenIn);
    ensureSupportedTokenSymbol(pairTokens.tokenOut);

    const amountIn = amount;
    const amountOut = readNumericCandidate(tradeResult.metadata.amountOut);
    const evaluation = await evaluateTradeProfit({
      status: tradeResult.status,
      amountIn,
      amountOut,
      tokenOutSymbol: tradeResult.metadata.tokenOutSymbol ?? pairTokens.tokenOut,
    });

    const outcome = await db.$transaction(async tx => {
      const trade = await tx.tradeExecution.create({
        data: {
          agentId: agent.id,
          actorType: TradeActorType.AGENT,
          actorId: String(agent.id),
          pair: normalizedPair,
          tokenIn: (tradeResult.metadata.tokenInSymbol ?? pairTokens.tokenIn).toUpperCase(),
          tokenOut: (tradeResult.metadata.tokenOutSymbol ?? pairTokens.tokenOut).toUpperCase(),
          side: normalizedSide,
          amount,
          amountIn,
          amountOut: evaluation.amountOut,
          status: tradeResult.status,
          txHash: tradeResult.txHash,
          pnlDelta: evaluation.profit,
          profit: evaluation.profit,
          isProfit: evaluation.isProfit,
          evaluatedPrice: evaluation.evaluatedPrice,
          evaluatedAt: evaluation.evaluatedAt,
          errorMessage: tradeResult.errorMessage,
          metadata: tradeResult.metadata,
        },
      });

      const score = await updateScoreTx(tx, {
        actorType: TradeActorType.AGENT,
        actorId: String(agent.id),
        tradeExecutionId: trade.id,
        isProfit: evaluation.isProfit,
        reason: trade.status === TradeExecutionStatus.SUCCESS
          ? (evaluation.isProfit ? 'Uniswap trade profitable' : 'Uniswap trade not profitable')
          : 'Uniswap trade failed on-chain',
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
        amountIn: outcome.trade.amountIn,
        amountOut: outcome.trade.amountOut,
        tokenIn: outcome.trade.tokenIn,
        tokenOut: outcome.trade.tokenOut,
        status: outcome.trade.status,
        txHash: outcome.trade.txHash,
        pnlDelta: outcome.trade.pnlDelta,
        profit: outcome.trade.profit,
        isProfit: outcome.trade.isProfit,
        evaluatedPrice: outcome.trade.evaluatedPrice,
        evaluatedAt: outcome.trade.evaluatedAt,
        errorMessage: outcome.trade.errorMessage,
        executedAt: outcome.trade.executedAt,
      },
      score: outcome.score
        ? {
            before: outcome.score.scoreBefore,
            after: outcome.score.scoreAfter,
            delta: outcome.score.delta,
            successfulTrades: outcome.score.successfulTrades,
            failedTrades: outcome.score.failedTrades,
          }
        : null,
      unlocks: outcome.score
        ? {
            creditLineUnlocked: outcome.score.creditLineUnlocked,
            bonusUsd100Unlocked: outcome.score.bonusUsd100Unlocked,
            newlyUnlocked: outcome.score.unlocksCreated,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/trade/record', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await persistStoredTransaction(req, res);
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

router.get('/score/status/wallet/:walletAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress } = req.params;
    if (!isAddress(walletAddress)) {
      res.status(400).json({ error: 'walletAddress must be a valid EVM address' });
      return;
    }

    const db = getDbClient();
    const agent = await db.agent.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
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
      res.status(404).json({ error: 'Agent not found for the provided wallet address' });
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
    const parsedLimit = typeof limitRaw === 'string' ? Number(limitRaw) : undefined;
    const pageSize = Number.isFinite(parsedLimit ?? NaN)
      ? Math.max(1, Math.min(100, Math.trunc(parsedLimit as number)))
      : parsePageSize(req.query.pageSize);
    const page = parsePageNumber(req.query.page);
    const statusFilter = parseHistoryStatusFilter(req.query.status);

    const db = getDbClient();
    const agent = await db.agent.findUnique({
      where: { id: numericAgentId },
      select: { id: true },
    });
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const where: Prisma.TradeExecutionWhereInput = {
      agentId: numericAgentId,
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    const total = await db.tradeExecution.count({ where });
    const skip = (page - 1) * pageSize;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const trades = await db.tradeExecution.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        pair: true,
        tokenIn: true,
        tokenOut: true,
        side: true,
        amount: true,
        amountIn: true,
        amountOut: true,
        status: true,
        txHash: true,
        pnlDelta: true,
        profit: true,
        isProfit: true,
        evaluatedPrice: true,
        evaluatedAt: true,
        errorMessage: true,
        executedAt: true,
        createdAt: true,
      },
    });

    res.json({
      agentId: numericAgentId,
      count: trades.length,
      total,
      page,
      pageSize,
      totalPages,
      status: statusFilter ?? 'ALL',
      trades,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/trades/history/wallet/:walletAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress } = req.params;
    if (!isAddress(walletAddress)) {
      res.status(400).json({ error: 'walletAddress must be a valid EVM address' });
      return;
    }

    const limitRaw = req.query.limit;
    const parsedLimit = typeof limitRaw === 'string' ? Number(limitRaw) : undefined;
    const pageSize = Number.isFinite(parsedLimit ?? NaN)
      ? Math.max(1, Math.min(100, Math.trunc(parsedLimit as number)))
      : parsePageSize(req.query.pageSize);
    const page = parsePageNumber(req.query.page);
    const statusFilter = parseHistoryStatusFilter(req.query.status);

    const db = getDbClient();
    const agent = await db.agent.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
      select: { id: true, walletAddress: true },
    });
    if (!agent) {
      res.status(404).json({ error: 'Agent not found for the provided wallet address' });
      return;
    }

    const where: Prisma.TradeExecutionWhereInput = {
      agentId: agent.id,
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    const total = await db.tradeExecution.count({ where });
    const skip = (page - 1) * pageSize;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const trades = await db.tradeExecution.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        pair: true,
        tokenIn: true,
        tokenOut: true,
        side: true,
        amount: true,
        amountIn: true,
        amountOut: true,
        status: true,
        txHash: true,
        pnlDelta: true,
        profit: true,
        isProfit: true,
        evaluatedPrice: true,
        evaluatedAt: true,
        errorMessage: true,
        executedAt: true,
        createdAt: true,
      },
    });

    res.json({
      agentId: agent.id,
      walletAddress: agent.walletAddress,
      count: trades.length,
      total,
      page,
      pageSize,
      totalPages,
      status: statusFilter ?? 'ALL',
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

        const score = await updateScoreTx(tx, {
          actorType: TradeActorType.AGENT,
          actorId: String(agent.id),
          tradeExecutionId: trade.id,
          isProfit: trade.status === TradeExecutionStatus.SUCCESS,
          reason: `Demo run 3-trades: ${item.label}`,
        });

        return { trade, score };
      });

      if (!outcome.score) {
        throw new Error('Demo score update skipped unexpectedly for newly created trade');
      }

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
