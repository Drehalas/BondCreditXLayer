import { createHmac } from 'node:crypto';
import { JsonRpcProvider, Wallet, isAddress, parseUnits } from 'ethers';
import { getStaticTradeTokens, type TradeToken } from './tokenCatalog.js';

export interface SupportedTradePair {
  pair: string;
  tokenIn: TradeToken;
  tokenOut: TradeToken;
}

export interface QuoteTradeInput {
  tokenIn: string;
  tokenOut: string;
  amount: number;
  userAddress?: string;
  slippageBps?: number;
  chainId?: number;
}

export interface TradeQuoteResult {
  tokenIn: TradeToken;
  tokenOut: TradeToken;
  amountIn: string;
  expectedOutput: string;
  priceImpact: string;
  route?: unknown;
  raw: unknown;
}

export interface BuildTradeTxInput extends QuoteTradeInput {
  userAddress: string;
}

export interface BuiltTradeTransaction {
  tokenIn: TradeToken;
  tokenOut: TradeToken;
  amountIn: string;
  expectedOutput?: string;
  priceImpact?: string;
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  route?: unknown;
  raw: unknown;
}

export interface ExecuteTradeInput extends BuildTradeTxInput {
  actorWalletAddress: string;
}

export interface ExecuteTradeResult {
  txHash: string;
  receiptStatus: number | null;
  builtTx: BuiltTradeTransaction;
  quote: TradeQuoteResult;
  broadcasterAddress: string;
}

function normalizeTokenIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function resolveTokenCatalog(scope?: string): TradeToken[] {
  const tokenScope = (scope ?? process.env.BONDCREDIT_TOKEN_LIST_SCOPE ?? 'mainnet').trim().toLowerCase();
  return getStaticTradeTokens(tokenScope);
}

export function getSupportedTradePairs(scope?: string): SupportedTradePair[] {
  const tokens = resolveTokenCatalog(scope);
  return tokens.flatMap(tokenIn =>
    tokens
      .filter(tokenOut => tokenOut.symbol !== tokenIn.symbol)
      .map(tokenOut => ({
        pair: `${tokenIn.symbol}/${tokenOut.symbol}`,
        tokenIn,
        tokenOut,
      })),
  );
}

export function resolveTradeToken(identifier: string, scope?: string): TradeToken | null {
  const tokens = resolveTokenCatalog(scope);
  const normalized = normalizeTokenIdentifier(identifier);
  if (!normalized) return null;

  const bySymbol = tokens.find(token => token.symbol.toLowerCase() === normalized);
  if (bySymbol) return bySymbol;

  if (isAddress(identifier)) {
    const lower = identifier.toLowerCase();
    return tokens.find(token => token.address.toLowerCase() === lower) ?? null;
  }

  return null;
}

export function resolveTradePair(tokenIn: string, tokenOut: string, scope?: string): SupportedTradePair | null {
  const resolvedIn = resolveTradeToken(tokenIn, scope);
  const resolvedOut = resolveTradeToken(tokenOut, scope);
  if (!resolvedIn || !resolvedOut) return null;
  if (resolvedIn.address.toLowerCase() === resolvedOut.address.toLowerCase()) return null;

  return {
    pair: `${resolvedIn.symbol}/${resolvedOut.symbol}`,
    tokenIn: resolvedIn,
    tokenOut: resolvedOut,
  };
}

function firstObjectWithKeys(root: unknown, requiredKeys: string[]): Record<string, unknown> | null {
  const queue: unknown[] = [root];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const record = current as Record<string, unknown>;
    if (requiredKeys.every(key => key in record)) return record;

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') queue.push(value);
    }
  }

  return null;
}

function readStringCandidate(root: unknown, keys: string[]): string | null {
  const queue: unknown[] = [root];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const record = current as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
      if (typeof value === 'bigint') return value.toString();
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') queue.push(value);
    }
  }

  return null;
}

function readNestedObject(root: unknown, keys: string[]): Record<string, unknown> | null {
  const record = firstObjectWithKeys(root, keys);
  return record;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isHexDataWithSelector(value: string): boolean {
  if (!/^0x[0-9a-fA-F]+$/.test(value)) return false;
  if ((value.length - 2) % 2 !== 0) return false;
  // 4-byte function selector => 8 hex chars + 0x prefix.
  return value.length >= 10;
}

function resolveDefaultChainId(): number {
  const network = (process.env.BONDCREDIT_NETWORK ?? 'xlayer-mainnet').trim().toLowerCase();
  return network === 'xlayer-mainnet' ? 196 : 1952;
}

function resolveEffectiveChainId(inputChainId?: number): number {
  if (typeof inputChainId === 'number' && Number.isFinite(inputChainId) && inputChainId > 0) {
    return Math.trunc(inputChainId);
  }
  return parseEnvInteger(process.env.BONDCREDIT_CHAIN_ID) ?? resolveDefaultChainId();
}

function extractTxObjectFromKnownShapes(raw: unknown): Record<string, unknown> | null {
  const root = asRecord(raw);
  if (!root) return null;

  const directCandidates: Array<Record<string, unknown> | null> = [
    asRecord(root.tx),
    asRecord(root.transaction),
    asRecord(root.txData),
    root,
  ];

  const dataCandidate = root.data;
  if (Array.isArray(dataCandidate) && dataCandidate.length > 0) {
    const first = asRecord(dataCandidate[0]);
    directCandidates.push(first);
    if (first) {
      directCandidates.push(asRecord(first.tx));
      directCandidates.push(asRecord(first.transaction));
      directCandidates.push(asRecord(first.txData));
    }
  } else {
    const dataRecord = asRecord(dataCandidate);
    directCandidates.push(dataRecord);
    if (dataRecord) {
      directCandidates.push(asRecord(dataRecord.tx));
      directCandidates.push(asRecord(dataRecord.transaction));
      directCandidates.push(asRecord(dataRecord.txData));
    }
  }

  for (const candidate of directCandidates) {
    if (!candidate) continue;
    if ('to' in candidate && 'data' in candidate) {
      return candidate;
    }
  }

  return null;
}

function normalizeTxValue(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) return trimmed;
    try {
      return BigInt(trimmed).toString();
    } catch {
      throw new Error(`Invalid transaction value string: ${trimmed}`);
    }
  }

  if (typeof value === 'bigint') {
    if (value < 0n) throw new Error('Transaction value cannot be negative');
    return value.toString();
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      throw new Error('Transaction value must be a non-negative integer');
    }
    return String(value);
  }

  return '0';
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parseEnvInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.trunc(parsed);
}

function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 6) return '*'.repeat(value.length);
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function normalizeOkxRequestPath(url: string): string {
  const urlObj = new URL(url);
  const requestPath = `${urlObj.pathname}${urlObj.search}`;
  if (!requestPath.startsWith('/')) {
    throw new Error(`Invalid OKX requestPath "${requestPath}"; expected a leading "/".`);
  }
  if (requestPath.includes('://')) {
    throw new Error(`Invalid OKX requestPath "${requestPath}"; protocol/host must not be included in prehash.`);
  }
  return requestPath;
}

function buildOkxPrehash(timestamp: string, method: string, requestPath: string, body: string): string {
  if (!timestamp || !method || !requestPath) {
    throw new Error('Invalid OKX signature input; timestamp, method, and requestPath are required.');
  }
  return `${timestamp}${method}${requestPath}${body}`;
}

let okxSignatureSelfCheckCompleted = false;

function runOkxSignatureSelfCheckIfEnabled(): void {
  if (okxSignatureSelfCheckCompleted) return;
  if (!isTruthyEnv(process.env.BONDCREDIT_OKX_AUTH_DEBUG)) return;

  const fixtureTimestamp = '2026-01-01T00:00:00.000Z';
  const fixtureMethod = 'GET';
  const fixturePath = '/api/v5/dex/aggregator/supported/chain?chainId=196';
  const fixtureKey = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
  const fixtureExpected = 'MhylypPx/xpEBPrW2SZMBuKQMuM4yMFg3XYJc8wc93Y=';
  const fixturePrehash = buildOkxPrehash(fixtureTimestamp, fixtureMethod, fixturePath, '');
  const fixtureActual = createHmac('sha256', fixtureKey).update(fixturePrehash, 'utf8').digest('base64');

  if (fixtureActual !== fixtureExpected) {
    throw new Error(
      `OKX signature self-check failed. Expected ${fixtureExpected} but got ${fixtureActual}.`,
    );
  }

  okxSignatureSelfCheckCompleted = true;
}

function buildOkxUrl(baseUrl: string, path: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function buildOkxSignedHeaders(url: string, method: string = 'GET'): {
  headers: Record<string, string>;
  debug: {
    timestamp: string;
    requestPath: string;
    prehash: string;
    signature: string;
    method: string;
    projectIncluded: boolean;
    keyPreview: string;
  };
} {
  runOkxSignatureSelfCheckIfEnabled();

  const apiKey = (process.env.BONDCREDIT_OKX_API_KEY ?? '').trim();
  const secretKey = (process.env.BONDCREDIT_OKX_SECRET_KEY ?? '').trim();
  const passphrase = (process.env.BONDCREDIT_OKX_API_PASSPHRASE ?? '').trim();
  const projectId = (process.env.BONDCREDIT_OKX_PROJECT_ID ?? '').trim();

  if (!apiKey || !secretKey || !passphrase) {
    throw new Error(
      'OKX credentials are incomplete. BONDCREDIT_OKX_API_KEY, BONDCREDIT_OKX_SECRET_KEY, and BONDCREDIT_OKX_API_PASSPHRASE are required.',
    );
  }

  const requestPath = normalizeOkxRequestPath(url);
  const normalizedMethod = method.toUpperCase();
  const timestamp = new Date().toISOString();
  const body = '';

  const signaturePayload = buildOkxPrehash(timestamp, normalizedMethod, requestPath, body);
  const signature = createHmac('sha256', secretKey).update(signaturePayload, 'utf8').digest('base64');

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'OK-ACCESS-KEY': apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': passphrase,
  };

  if (projectId) {
    headers['OK-ACCESS-PROJECT'] = projectId;
  }

  return {
    headers,
    debug: {
      timestamp,
      requestPath,
      prehash: signaturePayload,
      signature,
      method: normalizedMethod,
      projectIncluded: Boolean(projectId),
      keyPreview: maskSecret(apiKey),
    },
  };
}

async function requestOkxJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    const signed = buildOkxSignedHeaders(url, 'GET');
    const okxHeaders = signed.headers;
    const authDebugEnabled = isTruthyEnv(process.env.BONDCREDIT_OKX_AUTH_DEBUG);

    if (authDebugEnabled) {
      const headerTimestamp = okxHeaders['OK-ACCESS-TIMESTAMP'];
      if (headerTimestamp !== signed.debug.timestamp) {
        throw new Error(
          `Timestamp integrity violation. Header timestamp ${headerTimestamp} did not match prehash timestamp ${signed.debug.timestamp}.`,
        );
      }
      if (signed.debug.requestPath.includes('://')) {
        throw new Error(`Prehash requestPath is invalid: ${signed.debug.requestPath}`);
      }
      console.log('[okxDexTradeService] TIMESTAMP:', signed.debug.timestamp);
      console.log('[okxDexTradeService] REQUEST PATH:', signed.debug.requestPath);
      console.log('[okxDexTradeService] PREHASH:', signed.debug.prehash);
      console.log('[okxDexTradeService] SIGNATURE:', signed.debug.signature);
    }

    console.log('[okxDexTradeService] Outbound OKX request', {
      url,
      method: signed.debug.method,
      auth: {
        keyPreview: signed.debug.keyPreview,
        projectIncluded: signed.debug.projectIncluded,
        timestamp: signed.debug.timestamp,
        requestPath: signed.debug.requestPath,
      },
    });

    response = await fetch(url, {
      method: 'GET',
      headers: okxHeaders,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Network error reaching OKX DEX endpoint (${url}): ${reason}`);
  }

  const text = await response.text();
  if (!response.ok) {
    let errorDetails = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed.code && parsed.msg) {
        errorDetails = `OKX error code ${parsed.code}: ${parsed.msg}`;
      }
    } catch {
      // Keep original text if not JSON
    }
    const authHint =
      response.status === 401 || response.status === 403
        ? ' Ensure BONDCREDIT_OKX_API_KEY, BONDCREDIT_OKX_SECRET_KEY, BONDCREDIT_OKX_API_PASSPHRASE, and optional BONDCREDIT_OKX_PROJECT_ID are configured correctly for OKX Web3 DEX.'
        : '';
    throw new Error(`OKX request failed with status ${response.status}: ${errorDetails.slice(0, 320)}${authHint}`);
  }

  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getDexConfig() {
  const baseUrl = process.env.BONDCREDIT_OKX_DEX_BASE_URL ?? 'https://web3.okx.com';
  return {
    baseUrl,
    quotePath: process.env.BONDCREDIT_OKX_DEX_QUOTE_PATH ?? '/api/v6/dex/aggregator/quote',
    swapPath: process.env.BONDCREDIT_OKX_DEX_SWAP_PATH ?? '/api/v6/dex/aggregator/swap',
    mockEnabled: isTruthyEnv(process.env.BONDCREDIT_OKX_DEX_MOCK_ENABLED),
  };
}

function buildMockQuote(input: QuoteTradeInput, pair: SupportedTradePair): TradeQuoteResult {
  const amountIn = parseUnits(String(input.amount), pair.tokenIn.decimals).toString();
  const baseFactor = 0.9925;
  const output = (Number(input.amount) * baseFactor).toFixed(Math.min(8, pair.tokenOut.decimals));
  return {
    tokenIn: pair.tokenIn,
    tokenOut: pair.tokenOut,
    amountIn,
    expectedOutput: output,
    priceImpact: '0.75%',
    route: { mode: 'mock', path: [pair.tokenIn.address, pair.tokenOut.address] },
    raw: { mock: true },
  };
}

function buildMockTx(input: BuildTradeTxInput, pair: SupportedTradePair): BuiltTradeTransaction {
  const amountIn = parseUnits(String(input.amount), pair.tokenIn.decimals).toString();
  const mockRouter = (process.env.BONDCREDIT_OKX_DEX_MOCK_ROUTER ?? '').trim();
  const mockData = (process.env.BONDCREDIT_OKX_DEX_MOCK_DATA ?? '0x12345678').trim();
  if (!isAddress(mockRouter)) {
    throw new Error(
      'Mock swap mode requires BONDCREDIT_OKX_DEX_MOCK_ROUTER to be a valid EVM address.',
    );
  }
  if (!isHexDataWithSelector(mockData)) {
    throw new Error(
      'Mock swap mode requires BONDCREDIT_OKX_DEX_MOCK_DATA to be hex calldata with function selector.',
    );
  }
  return {
    tokenIn: pair.tokenIn,
    tokenOut: pair.tokenOut,
    amountIn,
    expectedOutput: String(Number(input.amount) * 0.99),
    priceImpact: '1.0%',
    to: mockRouter,
    // Non-empty selector-shaped hex keeps format checks deterministic in mock mode.
    data: mockData,
    value: '0',
    gasLimit: '0x5208',
    route: { mode: 'mock', path: [pair.tokenIn.address, pair.tokenOut.address] },
    raw: { mock: true },
  };
}

export async function fetchDexQuote(input: QuoteTradeInput): Promise<TradeQuoteResult> {
  const pair = resolveTradePair(input.tokenIn, input.tokenOut, process.env.BONDCREDIT_TOKEN_LIST_SCOPE);
  if (!pair) {
    throw new Error('Unsupported token pair');
  }
  if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('amount must be a positive number');
  }

  const { baseUrl, quotePath, mockEnabled } = getDexConfig();
  if (mockEnabled) return buildMockQuote(input, pair);

  const amountIn = parseUnits(String(input.amount), pair.tokenIn.decimals).toString();
  const effectiveChainId = resolveEffectiveChainId(input.chainId);
  const slippagePercentage = input.slippageBps ? input.slippageBps / 100 : 0.5;
  const quoteRequest = {
    chainIndex: effectiveChainId,
    fromTokenAddress: pair.tokenIn.address,
    toTokenAddress: pair.tokenOut.address,
    amount: amountIn,
    userWalletAddress: input.userAddress,
    slippagePercent: slippagePercentage,
  };
  const url = buildOkxUrl(baseUrl, quotePath, {
    chainIndex: quoteRequest.chainIndex,
    fromTokenAddress: quoteRequest.fromTokenAddress,
    toTokenAddress: quoteRequest.toTokenAddress,
    amount: quoteRequest.amount,
    userWalletAddress: quoteRequest.userWalletAddress,
    slippagePercent: quoteRequest.slippagePercent,
  });

  console.log('[okxDexTradeService] Quote outbound payload', {
    request: quoteRequest,
    url,
  });

  const raw = await requestOkxJson(url);
  console.log('[okxDexTradeService] Raw OKX quote response:', JSON.stringify(raw, null, 2));
  const quoteRoot = firstObjectWithKeys(raw, ['expectedOutput']) ?? firstObjectWithKeys(raw, ['data']) ?? raw;
  const expectedOutput = readStringCandidate(
    quoteRoot,
    ['expectedOutput', 'toTokenAmount', 'amountOut', 'outAmount', 'outputAmount'],
  );
  if (!expectedOutput) {
    const compactRaw = JSON.stringify(raw).slice(0, 500);
    throw new Error(
      `OKX quote response missing output amount fields (expectedOutput/toTokenAmount/amountOut/outAmount). Raw: ${compactRaw}`,
    );
  }

  const priceImpact = readStringCandidate(quoteRoot, ['priceImpact', 'priceImpactPct', 'priceImpactRate']) ?? 'unavailable';
  const route = readNestedObject(quoteRoot, ['route'])?.route ?? readNestedObject(quoteRoot, ['path'])?.path;

  return {
    tokenIn: pair.tokenIn,
    tokenOut: pair.tokenOut,
    amountIn,
    expectedOutput,
    priceImpact,
    route,
    raw,
  };
}

export async function buildDexSwapTransaction(input: BuildTradeTxInput): Promise<BuiltTradeTransaction> {
  const pair = resolveTradePair(input.tokenIn, input.tokenOut, process.env.BONDCREDIT_TOKEN_LIST_SCOPE);
  if (!pair) {
    throw new Error('Unsupported token pair');
  }
  if (!input.userAddress || !isAddress(input.userAddress)) {
    throw new Error('userAddress must be a valid EVM address');
  }
  if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('amount must be a positive number');
  }

  const { baseUrl, swapPath, mockEnabled } = getDexConfig();
  if (mockEnabled) return buildMockTx(input, pair);

  const amountIn = parseUnits(String(input.amount), pair.tokenIn.decimals).toString();
  const effectiveChainId = resolveEffectiveChainId(input.chainId);
  const slippagePercentage = input.slippageBps ? input.slippageBps / 100 : 0.5;
  const swapRequest = {
    chainIndex: effectiveChainId,
    fromTokenAddress: pair.tokenIn.address,
    toTokenAddress: pair.tokenOut.address,
    amount: amountIn,
    userWalletAddress: input.userAddress,
    slippagePercent: slippagePercentage,
  };
  const url = buildOkxUrl(baseUrl, swapPath, {
    chainIndex: swapRequest.chainIndex,
    fromTokenAddress: swapRequest.fromTokenAddress,
    toTokenAddress: swapRequest.toTokenAddress,
    amount: swapRequest.amount,
    userWalletAddress: swapRequest.userWalletAddress,
    slippagePercent: swapRequest.slippagePercent,
  });

  console.log('[okxDexTradeService] Build-tx outbound payload', {
    request: swapRequest,
    url,
  });

  const raw = await requestOkxJson(url);

  // Log raw response for debugging
  console.log('[okxDexTradeService] Raw OKX swap response:', JSON.stringify(raw, null, 2));

  const txObject = extractTxObjectFromKnownShapes(raw);

  if (!txObject) {
    const responseKeys = typeof raw === 'object' && raw !== null ? Object.keys(raw) : 'N/A';
    console.error('[okxDexTradeService] Failed to find tx data. Response structure:', responseKeys);
    throw new Error(
      `OKX swap response did not include transaction data in known fields. Response keys: [${responseKeys}]. Full response: ${JSON.stringify(raw).slice(0, 500)}`,
    );
  }

  const to = readStringCandidate(txObject, ['to']);
  const data = readStringCandidate(txObject, ['data']);
  const value = normalizeTxValue(txObject.value);
  if (!to || !data) {
    console.error('[okxDexTradeService] Missing to/data in txObject:', txObject);
    throw new Error('OKX swap response missing to/data fields');
  }
  if (!isAddress(to)) {
    throw new Error(`OKX swap response contains invalid destination address: ${to}`);
  }
  if (!isHexDataWithSelector(data)) {
    throw new Error('OKX swap response contains invalid calldata: expected hex with function selector');
  }

  return {
    tokenIn: pair.tokenIn,
    tokenOut: pair.tokenOut,
    amountIn,
    expectedOutput: readStringCandidate(raw, ['expectedOutput', 'toTokenAmount', 'amountOut', 'outAmount']) ?? undefined,
    priceImpact: readStringCandidate(raw, ['priceImpact', 'priceImpactPct', 'priceImpactRate']) ?? undefined,
    to,
    data,
    value,
    gasLimit: readStringCandidate(txObject, ['gas', 'gasLimit', 'gasEstimate']) ?? undefined,
    gasPrice: readStringCandidate(txObject, ['gasPrice']) ?? undefined,
    maxFeePerGas: readStringCandidate(txObject, ['maxFeePerGas']) ?? undefined,
    maxPriorityFeePerGas: readStringCandidate(txObject, ['maxPriorityFeePerGas']) ?? undefined,
    route: readNestedObject(raw, ['route'])?.route ?? readNestedObject(raw, ['path'])?.path,
    raw,
  };
}

export async function executeDexTradeWithBackendSigner(input: ExecuteTradeInput): Promise<ExecuteTradeResult> {
  const network = (process.env.BONDCREDIT_NETWORK ?? 'xlayer-mainnet').trim().toLowerCase();
  const rpcUrl = network === 'xlayer-mainnet'
    ? (process.env.XLAYER_MAINNET_RPC_URL ?? 'https://rpc.xlayer.tech')
    : (process.env.XLAYER_TESTNET_RPC_URL ?? 'https://testrpc.xlayer.tech');
  const provider = new JsonRpcProvider(rpcUrl);
  const backendPrivateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.VITE_DEPLOYER_PRIVATE_KEY;
  if (!backendPrivateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY is required for backend trade execution');
  }

  const wallet = new Wallet(backendPrivateKey, provider);
  const quote = await fetchDexQuote(input);
  const builtTx = await buildDexSwapTransaction(input);
  const txResponse = await wallet.sendTransaction({
    to: builtTx.to,
    data: builtTx.data,
    value: BigInt(builtTx.value),
    gasLimit: builtTx.gasLimit ? BigInt(builtTx.gasLimit) : undefined,
    gasPrice: builtTx.gasPrice ? BigInt(builtTx.gasPrice) : undefined,
    maxFeePerGas: builtTx.maxFeePerGas ? BigInt(builtTx.maxFeePerGas) : undefined,
    maxPriorityFeePerGas: builtTx.maxPriorityFeePerGas ? BigInt(builtTx.maxPriorityFeePerGas) : undefined,
  });

  const receipt = await txResponse.wait();
  return {
    txHash: receipt?.hash ?? txResponse.hash,
    receiptStatus: receipt?.status ?? null,
    builtTx,
    quote,
    broadcasterAddress: await wallet.getAddress(),
  };
}
