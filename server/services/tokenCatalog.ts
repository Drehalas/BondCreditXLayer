import { isAddress } from 'ethers';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type TradeToken = {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
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
let cachedChainCatalog: ChainCatalogItem[] | null = null;

function resolveTargetChainId(scope: string): number {
  const normalized = scope.trim().toLowerCase();
  if (normalized === 'testnet') {
    return Number(process.env.BONDCREDIT_TOKEN_LIST_TESTNET_CHAIN_ID ?? 1952);
  }
  return Number(process.env.BONDCREDIT_TOKEN_LIST_MAINNET_CHAIN_ID ?? 1);
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

  return {
    symbol,
    name,
    address,
    decimals: Number(token.decimals ?? 18),
    isStable: STABLE_SYMBOLS.has(symbol),
    enabled: true,
  };
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
