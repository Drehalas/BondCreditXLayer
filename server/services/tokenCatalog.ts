import { createHmac } from 'node:crypto';
import { isAddress } from 'ethers';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type TradeToken = {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  isStable: boolean;
  enabled: boolean;
};

export type ChainCatalogItem = {
  chain: string;
  fullName: string;
  shortName: string;
  belong?: string;
  walletUrl?: string;
};

type UniswapTokenListToken = {
  chainId?: number;
  address?: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  logoURI?: string;
};

type UniswapTokenList = {
  tokens?: UniswapTokenListToken[];
};
type ChainCatalog = Array<Record<string, unknown>>;

const STABLE_SYMBOLS = new Set(['USDT', 'USDC', 'DAI', 'USDE', 'FDUSD', 'TUSD', 'USDP']);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const tokenListPath = join(__dirname, '../data/uniswap-token-list.json');

const cachedByScope = new Map<string, TradeToken[]>();
const cachedOkxByScope = new Map<string, TradeToken[]>();
let cachedChainCatalog: ChainCatalogItem[] | null = null;

function parseEnvInteger(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function resolveTargetChainId(scope: string): number {
  const normalized = scope.trim().toLowerCase();
  const explicitChainId = parseEnvInteger(process.env.BONDCREDIT_CHAIN_ID);
  if (normalized === 'testnet') {
    return parseEnvInteger(process.env.BONDCREDIT_TOKEN_LIST_TESTNET_CHAIN_ID) ?? explicitChainId ?? 1952;
  }
  return parseEnvInteger(process.env.BONDCREDIT_TOKEN_LIST_MAINNET_CHAIN_ID) ?? explicitChainId ?? 196;
}

function isValidToken(token: UniswapTokenListToken, targetChainId: number): boolean {
  const chainId = Number(token.chainId ?? -1);
  const address = typeof token.address === 'string' ? token.address.trim() : '';
  const symbol = typeof token.symbol === 'string' ? token.symbol.trim().toUpperCase() : '';
  const name = typeof token.name === 'string' ? token.name.trim() : '';
  const decimals = Number(token.decimals ?? 18);

  if (chainId !== targetChainId) return false;
  if (!isAddress(address)) return false;
  if (!symbol || !name) return false;
  if (!Number.isFinite(decimals) || decimals < 0 || decimals > 36) return false;
  return true;
}

function tokenToTradeToken(token: UniswapTokenListToken): TradeToken {
  const symbol = typeof token.symbol === 'string' ? token.symbol.trim().toUpperCase() : '';
  const name = typeof token.name === 'string' ? token.name.trim() : '';
  const address = typeof token.address === 'string' ? token.address.trim() : '';
  const logoURI = typeof token.logoURI === 'string' && token.logoURI.trim() ? token.logoURI.trim() : undefined;

  return {
    symbol,
    name,
    address,
    decimals: Number(token.decimals ?? 18),
    logoURI,
    isStable: STABLE_SYMBOLS.has(symbol),
    enabled: true,
  };
}

type OkxTokenCandidate = Record<string, unknown>;

function getOkxTokenListBaseUrl(): string {
  return (process.env.BONDCREDIT_OKX_DEX_BASE_URL ?? 'https://web3.okx.com').trim();
}

function getOkxTokenListPaths(): string[] {
  const configured = (process.env.BONDCREDIT_OKX_TOKEN_LIST_PATHS ?? '').trim();
  if (configured) {
    return configured
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  return ['/api/v6/dex/aggregator/all-tokens'];
}

function summarizeResponseText(text: string, maxLength: number = 1200): string {
  const compact = text.replaceAll(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength)}...`;
}

function normalizeOkxRequestPath(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

function buildOkxSignedHeaders(url: string): Record<string, string> {
  const apiKey = (process.env.BONDCREDIT_OKX_API_KEY ?? '').trim();
  const secretKey = (process.env.BONDCREDIT_OKX_SECRET_KEY ?? '').trim();
  const passphrase = (process.env.BONDCREDIT_OKX_API_PASSPHRASE ?? '').trim();
  const projectId = (process.env.BONDCREDIT_OKX_PROJECT_ID ?? '').trim();

  if (!apiKey || !secretKey || !passphrase) {
    throw new Error(
      'OKX credentials are incomplete. BONDCREDIT_OKX_API_KEY, BONDCREDIT_OKX_SECRET_KEY, and BONDCREDIT_OKX_API_PASSPHRASE are required.',
    );
  }

  const timestamp = new Date().toISOString();
  const requestPath = normalizeOkxRequestPath(url);
  const prehash = `${timestamp}GET${requestPath}`;
  const signature = createHmac('sha256', secretKey).update(prehash, 'utf8').digest('base64');

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

  return headers;
}

function readStringCandidate(item: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

function readNumberCandidate(item: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return Math.trunc(parsed);
      }
    }
  }
  return undefined;
}

function getNestedTokenCandidate(item: Record<string, unknown>): Record<string, unknown> | null {
  const nestedKeys = ['token', 'data', 'item', 'info', 'details', 'contract'];
  for (const key of nestedKeys) {
    const nested = item[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }
  return null;
}

function extractOkxTokenArray(raw: unknown): OkxTokenCandidate[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is OkxTokenCandidate => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
  }

  if (!raw || typeof raw !== 'object') {
    return [];
  }

  const obj = raw as Record<string, unknown>;
  const candidateKeys = ['tokens', 'data', 'result', 'list', 'items', 'rows'];

  for (const key of candidateKeys) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is OkxTokenCandidate => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
    }
  }

  return [];
}

function normalizeOkxTokenCandidate(candidate: OkxTokenCandidate, targetChainId: number): TradeToken | null {
  const sources = [candidate, getNestedTokenCandidate(candidate)].filter((item): item is Record<string, unknown> => Boolean(item));

  for (const source of sources) {
    const chainId = readNumberCandidate(source, ['chainId', 'chain_id', 'chainIndex', 'chain', 'chainID']);
    if (chainId !== undefined && chainId !== targetChainId) {
      continue;
    }

    const address = readStringCandidate(source, [
      'address',
      'contractAddress',
      'tokenContractAddress',
      'tokenAddress',
      'token_address',
    ]);
    const symbol = readStringCandidate(source, ['symbol', 'tokenSymbol', 'baseSymbol', 'displaySymbol']);
    const name = readStringCandidate(source, ['name', 'tokenName', 'displayName']);
    const logoURI = readStringCandidate(source, ['logoURI', 'tokenLogoUrl', 'logo', 'icon']);
    const decimals = readNumberCandidate(source, ['decimals', 'decimal', 'tokenDecimals']) ?? 18;

    if (!address || !isAddress(address)) continue;
    if (!symbol || !name) continue;
    if (!Number.isFinite(decimals) || decimals < 0 || decimals > 36) continue;

    const normalizedSymbol = symbol.trim().toUpperCase();
    const normalizedName = name.trim();
    const normalizedAddress = address.trim();

    return {
      symbol: normalizedSymbol,
      name: normalizedName,
      address: normalizedAddress,
      decimals: Math.trunc(decimals),
      logoURI,
      isStable: STABLE_SYMBOLS.has(normalizedSymbol),
      enabled: true,
    };
  }

  return null;
}

function normalizeOkxTokenList(raw: unknown, targetChainId: number): TradeToken[] {
  const candidates = extractOkxTokenArray(raw);
  const dedup = new Map<string, TradeToken>();

  for (const candidate of candidates) {
    const token = normalizeOkxTokenCandidate(candidate, targetChainId);
    if (!token) continue;
    const dedupeKey = `${token.symbol}:${token.address.toLowerCase()}`;
    if (!dedup.has(dedupeKey)) {
      dedup.set(dedupeKey, token);
    }
  }

  return [...dedup.values()].sort((left, right) => left.symbol.localeCompare(right.symbol));
}

async function fetchOkxTokenListForPath(
  scope: string,
  targetChainId: number,
  path: string,
): Promise<TradeToken[] | null> {
  const baseUrl = getOkxTokenListBaseUrl();
  const url = new URL(path, baseUrl);
  url.searchParams.set('chainIndex', String(targetChainId));
  const requestUrl = url.toString();

  try {
    console.log('[tokenCatalog] OKX token list request', {
      scope,
      targetChainId,
      path,
      url: requestUrl,
      baseUrl,
    });

    const response = await fetch(requestUrl, { method: 'GET', headers: buildOkxSignedHeaders(requestUrl) });
    const text = await response.text();

    console.log('[tokenCatalog] OKX token list response', {
      scope,
      targetChainId,
      path,
      url: requestUrl,
      status: response.status,
      ok: response.ok,
      bodyPreview: summarizeResponseText(text),
    });

    if (!response.ok) {
      throw new Error(`OKX token list request failed with status ${response.status}: ${text.slice(0, 240)}`);
    }

    const raw = text.trim() ? JSON.parse(text) as unknown : {};
    const tokens = normalizeOkxTokenList(raw, targetChainId);
    if (tokens.length > 0) {
      console.log('[tokenCatalog] OKX token list loaded', {
        scope,
        targetChainId,
        count: tokens.length,
        path,
      });
      return tokens;
    }

    console.warn('[tokenCatalog] OKX token list response had no usable tokens', {
      scope,
      targetChainId,
      path,
    });
    return null;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.warn('[tokenCatalog] OKX token list fetch failed', {
      scope,
      targetChainId,
      path,
      error: err.message,
    });
    return null;
  }
}

async function fetchOkxTokenCandidates(scope: string): Promise<TradeToken[]> {
  const targetChainId = resolveTargetChainId(scope);
  for (const path of getOkxTokenListPaths()) {
    const tokens = await fetchOkxTokenListForPath(scope, targetChainId, path);
    if (tokens && tokens.length > 0) {
      return tokens;
    }
  }

  throw new Error(`Unable to load OKX token list for scope ${scope}.`);
}

export async function getOkxTradeTokens(scope: string): Promise<TradeToken[]> {
  const key = scope.trim().toLowerCase();
  const cached = cachedOkxByScope.get(key);
  if (cached) return cached;

  try {
    const tokens = await fetchOkxTokenCandidates(scope);
    cachedOkxByScope.set(key, tokens);
    return tokens;
  } catch (error) {
    const fallbackTokens = getStaticTradeTokens(scope);
    const err = error instanceof Error ? error : new Error(String(error));
    console.warn('[tokenCatalog] Falling back to static token list', {
      scope: key,
      fallbackCount: fallbackTokens.length,
      error: err.message,
    });

    cachedOkxByScope.set(key, fallbackTokens);
    return fallbackTokens;
  }
}

export function getStaticTradeTokens(scope: string): TradeToken[] {
  const key = scope.trim().toLowerCase();
  const cached = cachedByScope.get(key);
  if (cached) return cached;

  const raw = readFileSync(tokenListPath, 'utf8');
  const parsed = JSON.parse(raw) as UniswapTokenList | ChainCatalog;

  let list: UniswapTokenListToken[] = [];

  // Check if this is a hybrid format with both tokens and chainCatalog
  if (typeof parsed === 'object' && !Array.isArray(parsed) && 'tokens' in parsed) {
    list = Array.isArray(parsed.tokens) ? parsed.tokens : [];
  } else if (Array.isArray(parsed)) {
    // Old format - chain catalog only, no tokens
    cachedByScope.set(key, []);
    return [];
  }

  const dedup = new Map<string, TradeToken>();
  const targetChainId = resolveTargetChainId(scope);

  for (const token of list) {
    if (!isValidToken(token, targetChainId)) continue;

    const tradeToken = tokenToTradeToken(token);
    const dedupeKey = `${tradeToken.symbol}:${tradeToken.address.toLowerCase()}`;
    if (dedup.has(dedupeKey)) continue;

    dedup.set(dedupeKey, tradeToken);
  }

  const tokens = [...dedup.values()];
  cachedByScope.set(key, tokens);
  return tokens;
}

export function getChainCatalog(): ChainCatalogItem[] {
  if (cachedChainCatalog) return cachedChainCatalog;

  const raw = readFileSync(tokenListPath, 'utf8');
  const parsed = JSON.parse(raw) as UniswapTokenList | ChainCatalog;

  if (Array.isArray(parsed)) {
    // Old format - direct array of chain items
    cachedChainCatalog = parsed
      .map(item => toChainCatalogItem(item))
      .filter(item => item.chain.length > 0 && item.fullName.length > 0);
  } else if (typeof parsed === 'object' && 'chainCatalog' in parsed && Array.isArray(parsed.chainCatalog)) {
    // New hybrid format - chainCatalog is nested
    cachedChainCatalog = parsed.chainCatalog
      .map((item: Record<string, unknown>) => toChainCatalogItem(item))
      .filter(item => item.chain.length > 0 && item.fullName.length > 0);
  } else {
    cachedChainCatalog = [];
  }

  return cachedChainCatalog;
}

function toChainCatalogItem(item: Record<string, unknown>): ChainCatalogItem {
  const chain = typeof item.chain === 'string' ? item.chain.trim() : '';
  const fullName = typeof item.fullName === 'string' ? item.fullName.trim() : '';
  const shortName = typeof item.shortName === 'string' ? item.shortName.trim() : '';
  const belong = typeof item.belong === 'string' ? item.belong : undefined;
  const walletUrl = typeof item.walletUrl === 'string' ? item.walletUrl : undefined;

  return {
    chain,
    fullName,
    shortName,
    belong,
    walletUrl,
  };
}
