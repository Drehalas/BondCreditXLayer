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

export function getStaticTradeTokens(scope: string): TradeToken[] {
  const key = scope.trim().toLowerCase();
  const cached = cachedByScope.get(key);
  if (cached) return cached;

  const raw = readFileSync(tokenListPath, 'utf8');
  const parsed = JSON.parse(raw) as UniswapTokenList | ChainCatalog;
  if (Array.isArray(parsed)) {
    cachedByScope.set(key, []);
    return [];
  }
  const list = Array.isArray(parsed.tokens) ? parsed.tokens : [];

  const dedup = new Map<string, TradeToken>();
  const targetChainId = resolveTargetChainId(scope);
  for (const token of list) {
    const chainId = Number(token.chainId ?? -1);
    const address = String(token.address ?? '').trim();
    const symbol = String(token.symbol ?? '').trim().toUpperCase();
    const name = String(token.name ?? '').trim();
    const decimals = Number(token.decimals ?? 18);

    if (chainId !== targetChainId) continue;
    if (!isAddress(address)) continue;
    if (!symbol || !name) continue;
    if (!Number.isFinite(decimals) || decimals < 0 || decimals > 36) continue;

    const key = `${symbol}:${address.toLowerCase()}`;
    if (dedup.has(key)) continue;

    dedup.set(key, {
      symbol,
      name,
      address,
      decimals,
      isStable: STABLE_SYMBOLS.has(symbol),
      enabled: true,
    });
  }

  const tokens = [...dedup.values()];
  cachedByScope.set(key, tokens);
  return tokens;
}

export function getChainCatalog(): ChainCatalogItem[] {
  if (cachedChainCatalog) return cachedChainCatalog;

  const raw = readFileSync(tokenListPath, 'utf8');
  const parsed = JSON.parse(raw) as UniswapTokenList | ChainCatalog;
  if (!Array.isArray(parsed)) {
    cachedChainCatalog = [];
    return cachedChainCatalog;
  }

  cachedChainCatalog = parsed
    .map(item => ({
      chain: String(item.chain ?? '').trim(),
      fullName: String(item.fullName ?? '').trim(),
      shortName: String(item.shortName ?? '').trim(),
      belong: typeof item.belong === 'string' ? item.belong : undefined,
      walletUrl: typeof item.walletUrl === 'string' ? item.walletUrl : undefined,
    }))
    .filter(item => item.chain.length > 0 && item.fullName.length > 0);

  return cachedChainCatalog;
}
