import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, BarChart3, Repeat, Shield, ArrowDownLeft, ArrowUpRight, Star } from 'lucide-react';
import { AbiCoder, BrowserProvider, Contract, isAddress, parseUnits } from 'ethers';
import { useBondCredit } from '../context/BondCreditContext';

/* ═══════════════════════════════════════════════════════════════
   MOCK DATA — will be replaced with live API data later
   ═══════════════════════════════════════════════════════════════ */

const API_BASE_URL = import.meta.env.VITE_BONDCREDIT_API_BASE_URL ?? 'http://localhost:3000';
const EXPECTED_CHAIN_ID = BigInt(import.meta.env.VITE_BONDCREDIT_CHAIN_ID ?? '196');

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

const UNISWAP_V2_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
] as const;

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
] as const;

type TradeTab = 'buy' | 'sell' | 'long' | 'short' | 'deposit';

interface TradeToken {
  symbol: string;
  address: string;
  decimals: number;
}

interface TradablePair {
  pair: string;
  tokenIn: TradeToken;
  tokenOut: TradeToken;
}

interface TradeHistoryItem {
  id: number;
  pair: string;
  side: string;
  amount: number;
  status: string;
  txHash?: string | null;
  pnlDelta?: number | null;
  errorMessage?: string | null;
  executedAt: string;
}

interface ScoreStatus {
  score: number;
  successfulTrades: number;
  failedTrades: number;
  updatedAt?: string;
}

const WALLET_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', amount: '2.847', usd: '$5,694.00', change: '+3.2%', positive: true, sparkline: [40,42,38,45,43,48,52,50,55,53,58] },
  { symbol: 'USDC', name: 'USD Coin', amount: '4,250.00', usd: '$4,250.00', change: '+0.01%', positive: true, sparkline: [50,50,50,50,50,50,50,50,50,50,50] },
  { symbol: 'OKB', name: 'OKB Token', amount: '185.50', usd: '$9,275.00', change: '-1.4%', positive: false, sparkline: [60,58,55,57,52,50,48,45,47,44,42] },
  { symbol: 'BTC', name: 'Bitcoin', amount: '0.0312', usd: '$2,934.80', change: '+5.1%', positive: true, sparkline: [30,32,35,33,38,42,40,45,48,52,55] },
];

const MARKET_ICONS: Record<string, React.ReactNode> = {
  'OKX DEX': <Zap size={18} color="#ffb066" />,
  'OKX Market': <BarChart3 size={18} color="#7aa7ff" />,
  'Uniswap V3': <Repeat size={18} color="#ff79c6" />,
  'Aave V3': <Shield size={18} color="#bced62" />,
};

const MARKETS = [
  { name: 'OKX DEX', pairs: '280+', volume: '$2.4B', status: 'Active' },
  { name: 'OKX Market', pairs: '150+', volume: '$890M', status: 'Active' },
  { name: 'Uniswap V3', pairs: '500+', volume: '$1.8B', status: 'Active' },
  { name: 'Aave V3', pairs: '45+', volume: '$340M', status: 'Active' },
];

const TX_HISTORY = [
  { type: 'receive', label: 'Funds received', asset: '0.0124 BTC', time: '2 min ago' },
  { type: 'send', label: 'Withdraw funds', asset: '-$300.00', time: '18 min ago' },
  { type: 'fee', label: 'Transaction Fee', asset: '-$0.50', time: '45 min ago' },
  { type: 'receive', label: 'Funds received', asset: '0.0124 ETH', time: '1 hr ago' },
  { type: 'send', label: 'Withdraw funds', asset: '-$150.00', time: '3 hrs ago' },
  { type: 'credit', label: 'Credit Score +3', asset: '+3 pts', time: '5 hrs ago' },
];

function toTradeSide(tab: TradeTab): 'BUY' | 'SELL' | 'LONG' | 'SHORT' | 'DEPOSIT' {
  if (tab === 'sell') return 'SELL';
  if (tab === 'long') return 'LONG';
  if (tab === 'short') return 'SHORT';
  if (tab === 'deposit') return 'DEPOSIT';
  return 'BUY';
}

function formatRelativeTime(iso: string): string {
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  if (deltaSeconds < 3600) return `${Math.floor(deltaSeconds / 60)} min ago`;
  if (deltaSeconds < 86400) return `${Math.floor(deltaSeconds / 3600)} hrs ago`;
  return `${Math.floor(deltaSeconds / 86400)}d ago`;
}

function sideLabel(side: string): 'Buy' | 'Sell' | 'Long' | 'Short' | 'Deposit' {
  const normalized = side.trim().toUpperCase();
  if (normalized === 'SELL') return 'Sell';
  if (normalized === 'LONG') return 'Long';
  if (normalized === 'SHORT') return 'Short';
  if (normalized === 'DEPOSIT') return 'Deposit';
  return 'Buy';
}

function sanitizeGradientId(input: string): string {
  return input
    .replaceAll('-', '')
    .replaceAll('#', '')
    .replaceAll('(', '')
    .replaceAll(')', '')
    .replaceAll(',', '')
    .replaceAll(' ', '');
}

async function ensureWalletOnExpectedChain(provider: BrowserProvider, injected: Eip1193Provider): Promise<void> {
  const current = await provider.getNetwork();
  if (current.chainId === EXPECTED_CHAIN_ID) return;

  const expectedHex = `0x${EXPECTED_CHAIN_ID.toString(16)}`;
  await injected.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: expectedHex }],
  });
}

async function createProviderAfterChainSync(injected: Eip1193Provider): Promise<BrowserProvider> {
  const initialProvider = new BrowserProvider(injected);
  await ensureWalletOnExpectedChain(initialProvider, injected);
  // Recreate provider after potential chain change event to avoid stale-network errors.
  await injected.request({ method: 'eth_chainId' });
  return new BrowserProvider(injected);
}

async function validateManualTradePreflight(provider: BrowserProvider, tokenAddress: string): Promise<void> {
  const network = await provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(
      `Wrong network connected. Expected chain ${EXPECTED_CHAIN_ID.toString()}, got ${network.chainId.toString()}. Switch network and retry.`,
    );
  }

  const code = await provider.getCode(tokenAddress);
  if (!code || code === '0x') {
    throw new Error(
      `Token contract ${tokenAddress} is not deployed on chain ${network.chainId.toString()}. Check network and selected token pair.`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════
   Mini SVG Sparkline
   ═══════════════════════════════════════════════════════════════ */
const Sparkline: React.FC<{ data: number[]; color: string; width?: number; height?: number }> = ({
  data, color, width = 80, height = 32
}) => {
  const gradientId = `spark-${sanitizeGradientId(color)}`;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Portfolio Area Chart (mock)
   ═══════════════════════════════════════════════════════════════ */
const PortfolioChart: React.FC = () => {
  const data = [12, 15, 11, 18, 14, 22, 19, 25, 21, 28, 24, 20, 26, 23, 27, 30, 28, 32, 29, 35, 33, 31, 36, 34, 38];
  const width = 600;
  const height = 180;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const padding = 4;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--bondcredit-green)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--bondcredit-green)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#chartGrad)" />
      <polyline points={points} fill="none" stroke="var(--bondcredit-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Credit Score Gauge
   ═══════════════════════════════════════════════════════════════ */
const ScoreGauge: React.FC<{ score: number }> = ({ score }) => {
  const radius = 70;
  const stroke = 10;
  const circumference = Math.PI * radius; // half-circle
  const pct = (score - 300) / 550;
  const offset = circumference * (1 - pct);

  const getColor = (s: number) => {
    if (s >= 750) return 'var(--bondcredit-green)';
    if (s >= 700) return 'var(--bondcredit-lime)';
    if (s >= 600) return '#ffb066';
    return '#ff4d6d';
  };

  const getLabel = (s: number) => {
    if (s >= 750) return 'Excellent';
    if (s >= 700) return 'Good';
    if (s >= 600) return 'Fair';
    return 'Building';
  };

  return (
    <div className="dash-gauge">
      <svg width="160" height="96" viewBox="0 0 160 96">
        <path
          d="M 10 90 A 70 70 0 0 1 150 90"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <motion.path
          d="M 10 90 A 70 70 0 0 1 150 90"
          fill="none"
          stroke={getColor(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="dash-gauge__value">
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{ fontSize: '2rem', fontWeight: 900, color: getColor(score) }}
        >
          {score}
        </motion.span>
        <span className="dash-gauge__label" style={{ color: getColor(score) }}>{getLabel(score)}</span>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Main Dashboard Component
   ═══════════════════════════════════════════════════════════════ */

/**
 * Validate that router contract is deployed at the given address
 */
async function validateRouterContract(
  provider: BrowserProvider,
  routerAddress: string,
): Promise<{ valid: boolean; message?: string }> {
  if (!isAddress(routerAddress)) {
    return { valid: false, message: `Invalid router address format: ${routerAddress}` };
  }

  const code = await provider.getCode(routerAddress);
  if (!code || code === '0x') {
    return {
      valid: false,
      message: `Router contract not deployed at ${routerAddress}. Check spender address from /build-tx response.`,
    };
  }

  return { valid: true };
}

/**
 * Encode ERC20 approve() function call for manual transaction building
 */
function encodeERC20Approve(spenderAddress: string, amount: bigint): string {
  try {
    // ERC20 approve(address spender, uint256 amount)
    const encoded = AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256'],
      [spenderAddress, amount],
    );
    // Function selector for approve(address,uint256) = 0x095ea7b3
    return '0x095ea7b3' + encoded.slice(2);
  } catch (error) {
    throw new Error(`Failed to encode approve() call: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Pre-estimate gas for approval transaction before sending to MetaMask
 */
async function preEstimateApprovalGas(
  provider: BrowserProvider,
  tokenAddress: string,
  spenderAddress: string,
  amount: bigint,
  signer: Awaited<ReturnType<BrowserProvider['getSigner']>>,
): Promise<{ gasEstimate: bigint; success: boolean; error?: string }> {
  try {
    console.log('[TradingDashboardPage] Pre-estimating gas for approval...', {
      tokenAddress,
      spenderAddress,
      amount: amount.toString(),
    });

    const gasEstimate = await provider.estimateGas({
      from: await signer.getAddress(),
      to: tokenAddress,
      data: encodeERC20Approve(spenderAddress, amount),
      value: 0n,
    });

    console.log('[TradingDashboardPage] Gas estimate successful:', gasEstimate.toString());
    return { gasEstimate, success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[TradingDashboardPage] Gas estimation failed:', errorMsg);
    return { gasEstimate: 100000n, success: false, error: errorMsg };
  }
}

function extractRpcErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Unknown RPC error';
  }

  const candidate = error as {
    shortMessage?: string;
    reason?: string;
    message?: string;
    error?: { message?: string; reason?: string };
    info?: { error?: { message?: string } };
  };

  return (
    candidate.shortMessage
    || candidate.reason
    || candidate.error?.reason
    || candidate.error?.message
    || candidate.info?.error?.message
    || candidate.message
    || 'Unknown RPC error'
  );
}

function validateTradeAmountInput(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter a valid positive trade amount.');
  }
  if (amount < 1e-8) {
    throw new Error('Trade amount is too small. Use decimal token units (for example, 0.01), not wei integers.');
  }
  if (amount > 1e9) {
    throw new Error('Trade amount is too large for a safe manual swap. Check token decimals/units and try again.');
  }
}

function isValidCalldataHex(data: string): boolean {
  if (!/^0x[0-9a-fA-F]+$/.test(data)) return false;
  if ((data.length - 2) % 2 !== 0) return false;
  return data.length >= 10;
}

function parseWeiValue(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0) {
    return BigInt(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) return BigInt(trimmed);
    return BigInt(trimmed);
  }
  if (value === undefined || value === null || value === '') return 0n;
  throw new Error('Swap builder returned invalid value field; expected wei as decimal/hex integer string.');
}

const TradingDashboardPage: React.FC = () => {
  const { appendLog } = useBondCredit();
  const [tradeTab, setTradeTab] = useState<TradeTab>('buy');
  const [selectedPair, setSelectedPair] = useState('ETH/USDC');
  const [tradeAmount, setTradeAmount] = useState('');
  const [chartPeriod, setChartPeriod] = useState<'1W' | '1M' | '3M' | '1Y'>('1M');
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [networkLabel, setNetworkLabel] = useState('XLayer Mainnet');
  const [tradablePairs, setTradablePairs] = useState<TradablePair[]>([]);
  const [loadingPairs, setLoadingPairs] = useState(false);
  const [tradeError, setTradeError] = useState('');
  const [tradeStatus, setTradeStatus] = useState('');
  const [isExecutingTrade, setIsExecutingTrade] = useState(false);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false);
  const [liveTradeHistory, setLiveTradeHistory] = useState<TradeHistoryItem[]>([]);
  const [liveScore, setLiveScore] = useState<ScoreStatus | null>(null);

  const totalUsd = WALLET_TOKENS.reduce((sum, t) => sum + Number.parseFloat(t.usd.replaceAll('$', '').replaceAll(',', '')), 0);

  const sideColors: Record<string, string> = {
    Buy: '#3bf7d2',
    Sell: '#ff4d6d',
    Long: '#bced62',
    Short: '#ff8c42',
    Deposit: '#7aa7ff',
  };

  const pairOptions = useMemo(
    () => tradablePairs.map(item => item.pair),
    [tradablePairs],
  );

  const displayedScore = liveScore?.score ?? 0;

  const displayedTrades = useMemo(() => {
    return liveTradeHistory.map(item => {
      const label = sideLabel(item.side);
      let pnl: string;
      if (item.pnlDelta == null) {
        pnl = item.status === 'SUCCESS' ? '+$0.00' : '-$0.00';
      } else {
        const sign = item.pnlDelta >= 0 ? '+' : '-';
        pnl = `${sign}$${Math.abs(item.pnlDelta).toFixed(4)}`;
      }

      return {
        pair: item.pair,
        side: label,
        type: 'Swap',
        amount: `${item.amount}`,
        price: item.txHash ? `${item.txHash.slice(0, 10)}...` : 'N/A',
        time: formatRelativeTime(item.executedAt),
        status: item.status === 'SUCCESS' ? 'Filled' : 'Failed',
        pnl,
      };
    });
  }, [liveTradeHistory]);

  const loadTradeTokens = async () => {
    setLoadingPairs(true);
    setTradeError('');
    try {
      const response = await fetch(`${API_BASE_URL}/trade/tokens`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : `Failed to load pairs (${response.status})`);
      }

      const pairs = Array.isArray(payload?.tradablePairs) ? payload.tradablePairs as TradablePair[] : [];
      setTradablePairs(pairs);
      if (typeof payload?.network === 'string') {
        setNetworkLabel(payload.network === 'xlayer-mainnet' ? 'XLayer Mainnet' : 'XLayer Testnet');
      }
      if (pairs.length > 0) {
        setSelectedPair(pairs[0]?.pair ?? 'ETH/USDC');
      }

      appendLog(`trade.tokens(): loaded ${pairs.length} pairs`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load token pairs';
      setTradeError(message);
      appendLog(`trade.tokens.error(): ${message}`);
    } finally {
      setLoadingPairs(false);
    }
  };

  const loadWalletTradeSnapshot = async (walletAddress: string) => {
    setIsSnapshotLoading(true);
    try {
      const [historyResponse, scoreResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/trades/history/wallet/${walletAddress}?limit=20`),
        fetch(`${API_BASE_URL}/score/status/wallet/${walletAddress}`),
      ]);

      if (historyResponse.ok) {
        const historyPayload = await historyResponse.json().catch(() => null);
        if (Array.isArray(historyPayload?.trades)) {
          setLiveTradeHistory(historyPayload.trades as TradeHistoryItem[]);
        }
      }

      if (scoreResponse.ok) {
        const scorePayload = await scoreResponse.json().catch(() => null);
        if (typeof scorePayload?.score === 'number') {
          setLiveScore({
            score: scorePayload.score,
            successfulTrades: Number(scorePayload.successfulTrades ?? 0),
            failedTrades: Number(scorePayload.failedTrades ?? 0),
            updatedAt: typeof scorePayload.updatedAt === 'string' ? scorePayload.updatedAt : undefined,
          });
        }
      }
    } catch {
      // Keep the dashboard resilient; users can still execute a trade.
    } finally {
      setIsSnapshotLoading(false);
    }
  };

  useEffect(() => {
    void loadTradeTokens();
  }, []);

  useEffect(() => {
    const injected = (globalThis as typeof globalThis & { ethereum?: Eip1193Provider }).ethereum;
    if (!injected) return;

    const syncWallet = async () => {
      try {
        const accounts = await injected.request({ method: 'eth_accounts' });
        const primary = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null;
        if (primary && isAddress(primary)) {
          setConnectedWallet(primary);
          return;
        }
      } catch {
        // Ignore provider read errors and keep dashboard usable.
      }

      setConnectedWallet(null);
      setLiveTradeHistory([]);
      setLiveScore(null);
    };

    const onAccountsChanged = (accounts: unknown) => {
      const primary = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null;
      if (primary && isAddress(primary)) {
        setConnectedWallet(primary);
        return;
      }
      setConnectedWallet(null);
      setLiveTradeHistory([]);
      setLiveScore(null);
    };

    void syncWallet();
    injected.on?.('accountsChanged', onAccountsChanged);
    return () => {
      injected.removeListener?.('accountsChanged', onAccountsChanged);
    };
  }, []);

  useEffect(() => {
    if (!connectedWallet || !isAddress(connectedWallet)) {
      setLiveTradeHistory([]);
      setLiveScore(null);
      return;
    }

    void loadWalletTradeSnapshot(connectedWallet);
  }, [connectedWallet]);

  const executeUserSignedTrade = async (input: {
    signer: Awaited<ReturnType<BrowserProvider['getSigner']>>;
    signerAddress: string;
    amount: number;
    selectedPairMeta: TradablePair;
  }) => {
    const provider = input.signer.provider;
    if (!provider || !(provider instanceof BrowserProvider)) {
      throw new Error('Unable to access wallet provider for trade validation.');
    }
    await validateManualTradePreflight(provider, input.selectedPairMeta.tokenIn.address);

    const tokenInContract = new Contract(input.selectedPairMeta.tokenIn.address, ERC20_ABI, input.signer);

    const tokenDecimals = Number(await tokenInContract.decimals());
    const amountIn = parseUnits(String(input.amount), tokenDecimals);

    setTradeStatus('Fetching swap quote...');
    const quoteResponse = await fetch(
      `${API_BASE_URL}/quote?tokenIn=${encodeURIComponent(input.selectedPairMeta.tokenIn.address)}&tokenOut=${encodeURIComponent(input.selectedPairMeta.tokenOut.address)}&amount=${encodeURIComponent(String(input.amount))}&userAddress=${encodeURIComponent(input.signerAddress)}`,
      { method: 'GET' },
    );
    const quotePayload = await quoteResponse.json().catch(() => null);
    if (!quoteResponse.ok) {
      throw new Error(
        typeof quotePayload?.error === 'string'
          ? quotePayload.error
          : `Could not fetch quote (${quoteResponse.status})`,
      );
    }

    setTradeStatus('Building swap transaction...');
    const buildResponse = await fetch(
      `${API_BASE_URL}/build-tx?tokenIn=${encodeURIComponent(input.selectedPairMeta.tokenIn.address)}&tokenOut=${encodeURIComponent(input.selectedPairMeta.tokenOut.address)}&amount=${encodeURIComponent(String(input.amount))}&userAddress=${encodeURIComponent(input.signerAddress)}`,
      { method: 'GET' },
    );
    const buildPayload = await buildResponse.json().catch(() => null);
    if (!buildResponse.ok) {
      throw new Error(
        typeof buildPayload?.error === 'string'
          ? buildPayload.error
          : `Could not build swap transaction (${buildResponse.status})`,
      );
    }
    if (!isAddress(String(buildPayload?.to ?? ''))) {
      throw new Error('Swap builder returned invalid destination address.');
    }
    if (!isValidCalldataHex(String(buildPayload?.data ?? ''))) {
      throw new Error('Swap builder returned invalid calldata (missing/invalid function selector).');
    }

    const buildDiagnostics = typeof buildPayload?.diagnostics === 'object' && buildPayload.diagnostics !== null
      ? buildPayload.diagnostics as Record<string, unknown>
      : null;
    if (buildDiagnostics?.hasToAddress === false || buildDiagnostics?.hasDataPayload === false) {
      throw new Error('Swap builder diagnostics flagged non-executable payload. Retry with another pair/amount.');
    }

    setTradeStatus('Checking token allowance...');
    const spender = String(buildPayload.to);

    // === APPROVAL DIAGNOSTICS ===
    console.group('[TradingDashboardPage] Approval Transaction Diagnostics');
    console.log('Token Contract:', input.selectedPairMeta.tokenIn.address);
    console.log('Spender (Router):', spender);
    console.log('Signer Address:', input.signerAddress);
    console.log('Amount (Wei):', amountIn.toString());
    const networkDash = await provider.getNetwork();
    console.log('Chain ID:', networkDash.chainId);

    // Validate router contract exists
    const routerValidation = await validateRouterContract(provider, spender);
    console.log('Router Validation:', routerValidation);
    if (!routerValidation.valid) {
      throw new Error(`Router validation failed: ${routerValidation.message}`);
    }
    console.groupEnd();
    // === END DIAGNOSTICS ===

    const allowance = (await tokenInContract.allowance(input.signerAddress, spender)) as bigint;
    console.log('[TradingDashboardPage] Current allowance:', allowance.toString());

    if (allowance < amountIn) {
      setTradeStatus('Pre-validating approval transaction...');

      // Pre-estimate gas to catch simulation errors early
      const gasResult = await preEstimateApprovalGas(
        provider,
        input.selectedPairMeta.tokenIn.address,
        spender,
        amountIn,
        input.signer,
      );

      if (!gasResult.success) {
        console.error('[TradingDashboardPage] Gas pre-estimation failed:', gasResult.error);
        throw new Error(`Approval failed pre-validation: ${gasResult.error}`);
      }

      setTradeStatus('Waiting for token approval confirmation...');
      console.log('[TradingDashboardPage] Sending approval transaction via ethers.js Contract.approve()...');

      try {
        const approveTx = await tokenInContract.approve(spender, amountIn);
        console.log('[TradingDashboardPage] Approval tx sent:', approveTx.hash);
        await approveTx.wait();
        console.log('[TradingDashboardPage] Approval confirmed');
      } catch (approveError) {
        const errorMsg = approveError instanceof Error ? approveError.message : 'Unknown error';
        console.error('[TradingDashboardPage] Contract.approve() failed:', errorMsg);

        // Fallback: Try manual approval encoding
        console.warn('[TradingDashboardPage] Attempting manual approval encoding fallback...');
        try {
          const manualApproveData = encodeERC20Approve(spender, amountIn);
          console.log('[TradingDashboardPage] Manual encoded approve data:', manualApproveData);

          const manualApproveTx = await input.signer.sendTransaction({
            to: input.selectedPairMeta.tokenIn.address,
            data: manualApproveData,
            value: 0n,
          });

          console.log('[TradingDashboardPage] Manual approval tx sent:', manualApproveTx.hash);
          await manualApproveTx.wait();
          console.log('[TradingDashboardPage] Manual approval confirmed');
        } catch (manualError) {
          const manualErrorMsg = manualError instanceof Error ? manualError.message : 'Unknown error';
          console.error('[TradingDashboardPage] Manual approval fallback also failed:', manualErrorMsg);
          throw new Error(`Approval failed: ${errorMsg}. Manual fallback also failed: ${manualErrorMsg}`);
        }
      }
    }

    const swapRequest = {
      to: buildPayload?.to,
      data: buildPayload?.data,
      value: parseWeiValue(buildPayload?.value),
      gasLimit: buildPayload?.gasLimit ? BigInt(buildPayload.gasLimit) : undefined,
      gasPrice: buildPayload?.gasPrice ? BigInt(buildPayload.gasPrice) : undefined,
      maxFeePerGas: buildPayload?.maxFeePerGas ? BigInt(buildPayload.maxFeePerGas) : undefined,
      maxPriorityFeePerGas: buildPayload?.maxPriorityFeePerGas ? BigInt(buildPayload.maxPriorityFeePerGas) : undefined,
    };

    console.group('[TradingDashboardPage] Swap Preflight Diagnostics');
    console.log('Build Diagnostics:', buildDiagnostics);
    console.log('Swap To:', swapRequest.to);
    console.log('Swap Data Length:', swapRequest.data?.length ?? 0);
    console.log('Swap Value (wei):', swapRequest.value.toString());
    console.log('Chain ID:', (await provider.getNetwork()).chainId.toString());
    console.groupEnd();

    setTradeStatus('Validating swap transaction...');
    try {
      await provider.estimateGas({
        ...swapRequest,
        from: input.signerAddress,
      });
    } catch (swapPreflightError) {
      const reason = extractRpcErrorMessage(swapPreflightError);
      const extraHint = reason.toLowerCase().includes('missing revert data')
        ? ' Confirm router deployment on current chain, allowance >= amountIn, wallet token balance, and build diagnostics.hasDataPayload.'
        : '';
      throw new Error(
        `Swap simulation failed before wallet signature: ${reason}. Verify token balance, allowance, and route availability for this pair.${extraHint}`,
      );
    }

    setTradeStatus('Awaiting wallet signature for swap...');
    const swapTx = await input.signer.sendTransaction(swapRequest);

    setTradeStatus('Swap transaction pending...');
    const receipt = await swapTx.wait();
    const txStatus = receipt?.status === 1 ? 'SUCCESS' : 'FAILED';
    const txHash = receipt?.hash ?? swapTx.hash;

    const recordResponse = await fetch(`${API_BASE_URL}/store-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: input.signerAddress,
        userId: input.signerAddress,
        pair: selectedPair,
        side: toTradeSide(tradeTab),
        amount: input.amount,
        txHash,
        status: txStatus,
        metadata: {
          tokenIn: input.selectedPairMeta.tokenIn.address,
          tokenOut: input.selectedPairMeta.tokenOut.address,
          amountInWei: amountIn.toString(),
          expectedToAddress: buildPayload?.to,
          expectedValueWei: buildPayload?.value ?? '0',
          expectedData: buildPayload?.data,
          quote: quotePayload,
          builtTx: buildPayload,
          manualUserSigned: true,
        },
      }),
    });

    const recordPayload = await recordResponse.json().catch(() => null);
    if (!recordResponse.ok) {
      throw new Error(
        typeof recordPayload?.error === 'string'
          ? recordPayload.error
          : `Could not record signed trade (${recordResponse.status})`,
      );
    }

    setTradeStatus(`User-signed trade recorded. Tx: ${txHash}`);
    appendLog(`trade.userSigned.record(): ${JSON.stringify(recordPayload, null, 2)}`);
    await loadWalletTradeSnapshot(input.signerAddress);
    setTradeAmount('');
  };

  const handleExecuteTrade = async () => {
    setTradeError('');
    setTradeStatus('');

    const amount = Number(tradeAmount);
    try {
      validateTradeAmountInput(amount);
    } catch (amountError) {
      setTradeError(amountError instanceof Error ? amountError.message : 'Invalid trade amount.');
      return;
    }

    const selectedPairMeta = tradablePairs.find(item => item.pair === selectedPair);
    if (!selectedPairMeta) {
      setTradeError('Selected pair is unavailable in current token catalog.');
      return;
    }
    if (!isAddress(selectedPairMeta.tokenIn.address) || !isAddress(selectedPairMeta.tokenOut.address)) {
      setTradeError('Token address metadata is invalid for selected pair.');
      return;
    }

    setIsExecutingTrade(true);
    try {
      const injected = (globalThis as typeof globalThis & { ethereum?: Eip1193Provider }).ethereum;
      if (!injected) {
        throw new Error('No injected wallet found. Install MetaMask or another EVM wallet extension.');
      }

      setTradeStatus('Connecting wallet...');
      await injected.request({ method: 'eth_requestAccounts' });
      const provider = await createProviderAfterChainSync(injected);

      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();

      setConnectedWallet(signerAddress);

      await executeUserSignedTrade({
        signer,
        signerAddress,
        amount,
        selectedPairMeta,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Trade execution failed';
      setTradeError(message);
      appendLog(`trade.execute.error(): ${message}`);
    } finally {
      setIsExecutingTrade(false);
    }
  };

  return (
    <main className="dash-page" style={{ marginTop: '64px' }}>
      {/* ═══ Top Bar ═══ */}
      <div className="dash-topbar">
        <div>
          <h1 className="dash-topbar__title">Dashboard</h1>
          <p className="dash-topbar__sub">Market Access & Agentic Trading on X Layer</p>
        </div>
        <div className="dash-topbar__right">
          <div className="dash-topbar__status">
            <div className="dash-topbar__dot" />
            {networkLabel}
          </div>
        </div>
      </div>

      <div className="dash-layout">
        {/* ═══════════════════════════════════════════════
            LEFT COLUMN
           ═══════════════════════════════════════════════ */}
        <div className="dash-main">

          {/* ── Row 1: Token Price Cards (Critso-inspired) ── */}
          <div className="dash-token-row">
            {WALLET_TOKENS.map((t, i) => (
              <motion.div
                key={t.symbol}
                className={`dash-token-card ${i === 0 ? 'dash-token-card--accent' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="dash-token-card__top">
                  <div className="dash-token-card__icon">{t.symbol.charAt(0)}</div>
                  <Sparkline data={t.sparkline} color={t.positive ? '#3bf7d2' : '#ff4d6d'} />
                </div>
                <div className="dash-token-card__price">{t.usd}</div>
                <div className="dash-token-card__meta">
                  <span className="dash-token-card__sym">{t.symbol}</span>
                  <span className={`dash-token-card__change ${t.positive ? 'up' : 'down'}`}>{t.change}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Row 2: Portfolio Chart + Credit Score ── */}
          <div className="dash-chart-row">
            {/* Portfolio Value Chart */}
            <motion.div
              className="dash-card dash-portfolio"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <div className="dash-card__header">
                <div>
                  <h3 className="dash-card__title">Portfolio Value</h3>
                  <div className="dash-portfolio__val">
                    <span className="dash-portfolio__amount">${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span className="dash-portfolio__change">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3bf7d2" strokeWidth="3"><polyline points="18 15 12 9 6 15" /></svg>
                      +2.8%
                    </span>
                  </div>
                </div>
                <div className="dash-portfolio__periods">
                  {(['1W', '1M', '3M', '1Y'] as const).map(p => (
                    <button
                      key={p}
                      className={`dash-portfolio__period ${chartPeriod === p ? 'active' : ''}`}
                      onClick={() => setChartPeriod(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="dash-portfolio__chart">
                <PortfolioChart />
              </div>
              <div className="dash-portfolio__labels">
                <span>Feb 13</span><span>Feb 17</span><span>Feb 21</span><span>Feb 25</span><span>Mar '26</span>
              </div>
            </motion.div>

            {/* Credit Score */}
            <motion.div
              className="dash-card dash-credit"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="dash-card__header">
                <h3 className="dash-card__title">Credit Score</h3>
                <div className="dash-credit__badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3bf7d2" strokeWidth="3"><polyline points="18 15 12 9 6 15" /></svg>
                  {liveScore ? 'Live score' : 'Waiting for wallet'}
                </div>
              </div>
              {connectedWallet && isSnapshotLoading && (
                <div className="dash-trade__hint" style={{ marginBottom: '10px' }}>
                  Loading credit score from trade history...
                </div>
              )}
              <ScoreGauge score={displayedScore} />
              <div className="dash-trade__hint" style={{ marginBottom: '10px' }}>
                {liveScore
                  ? `Generated from trades: ${liveScore.successfulTrades} successful, ${liveScore.failedTrades} failed`
                  : 'Connect wallet to load trade-derived credit score.'}
              </div>
              <div className="dash-credit__factors">
                {[
                  { label: 'Trade Consistency', val: liveScore ? Math.min(100, 50 + (liveScore.successfulTrades * 5)) : 85 },
                  { label: 'Settlement History', val: liveScore ? Math.min(100, 50 + (liveScore.successfulTrades * 6)) : 92 },
                  { label: 'Risk Management', val: 68 },
                  { label: 'Portfolio Diversity', val: 74 },
                ].map(f => (
                  <div key={f.label} className="dash-credit__factor">
                    <div className="dash-credit__factor-top">
                      <span>{f.label}</span>
                      <span>{f.val}%</span>
                    </div>
                    <div className="dash-credit__factor-track">
                      <motion.div
                        className="dash-credit__factor-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${f.val}%` }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ── Row 3: Market Access + Trade Panel ── */}
          <div className="dash-trade-row">
            {/* Market Access */}
            <motion.div
              className="dash-card dash-markets"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <h3 className="dash-card__title">Market Access</h3>
              <div className="dash-markets__grid">
                {MARKETS.map(m => (
                  <div key={m.name} className="dash-markets__item">
                    <div className="dash-markets__item-top">
                      <span className="dash-markets__icon">{MARKET_ICONS[m.name]}</span>
                      <div className="dash-markets__status"><div className="dash-markets__dot" />{m.status}</div>
                    </div>
                    <div className="dash-markets__name">{m.name}</div>
                    <div className="dash-markets__info">
                      <span>{m.pairs} pairs</span>
                      <span className="dash-markets__vol">{m.volume}</span>
                    </div>
                    <button className="dash-markets__btn">Trade →</button>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Trade Panel */}
            <motion.div
              className="dash-card dash-trade"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
            >
              <h3 className="dash-card__title">Quick Trade</h3>
              <div className="dash-trade__tabs">
                {(['buy', 'sell', 'long', 'short', 'deposit'] as const).map(tab => (
                  <button
                    key={tab}
                    className={`dash-trade__tab ${tradeTab === tab ? 'active' : ''} ${tab === 'buy' || tab === 'long' ? 'green' : ''} ${tab === 'sell' || tab === 'short' ? 'red' : ''}`}
                    onClick={() => setTradeTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              <div className="dash-trade__form">
                <label className="dash-trade__label">
                  <span>Pair</span>
                  <select value={selectedPair} onChange={e => setSelectedPair(e.target.value)} className="dash-trade__select" disabled={loadingPairs}>
                    {pairOptions.length === 0 && <option value="">No tradable pairs available</option>}
                    {pairOptions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>

                <label className="dash-trade__label">
                  <span>Amount</span>
                  <div className="dash-trade__input-wrap">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={tradeAmount}
                      onChange={e => setTradeAmount(e.target.value)}
                      className="dash-trade__input"
                    />
                    <span className="dash-trade__suffix">{selectedPair.split('/')[0]}</span>
                  </div>
                </label>

                {(tradeTab === 'long' || tradeTab === 'short') && (
                  <label className="dash-trade__label">
                    <span>Leverage</span>
                    <select className="dash-trade__select" defaultValue="5">
                      <option value="2">2x</option><option value="5">5x</option><option value="10">10x</option><option value="20">20x</option>
                    </select>
                  </label>
                )}

                {tradeTab === 'deposit' ? (
                  <button
                    className="dash-trade__exec dash-trade__exec--green"
                    onClick={handleExecuteTrade}
                    disabled={isExecutingTrade || loadingPairs}
                  >
                    Deposit {tradeAmount || ''} {tradeAmount ? selectedPair.split('/')[0] : ''}
                  </button>
                ) : (
                  <button
                    className={`dash-trade__exec ${tradeTab === 'buy' || tradeTab === 'long' ? 'dash-trade__exec--green' : 'dash-trade__exec--red'}`}
                    onClick={handleExecuteTrade}
                    disabled={isExecutingTrade || loadingPairs}
                  >
                    {tradeTab === 'buy' && `Buy ${selectedPair.split('/')[0]}`}
                    {tradeTab === 'sell' && `Sell ${selectedPair.split('/')[0]}`}
                    {tradeTab === 'long' && `Long ${selectedPair.split('/')[0]}`}
                    {tradeTab === 'short' && `Short ${selectedPair.split('/')[0]}`}
                  </button>
                )}

                {loadingPairs && <div className="dash-trade__hint">Loading tradable pairs...</div>}
                {!loadingPairs && pairOptions.length === 0 && (
                  <div className="dash-trade__hint" style={{ color: '#ffb066' }}>
                    No tradable pairs were loaded from backend token catalog. Check BONDCREDIT_TOKEN_LIST_SCOPE and chain IDs.
                  </div>
                )}
                {tradeStatus && <div className="dash-trade__hint" style={{ color: '#3bf7d2' }}>{tradeStatus}</div>}
                {tradeError && <div className="dash-trade__hint" style={{ color: '#ff4d6d' }}>{tradeError}</div>}

                <div className="dash-trade__hint">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3bf7d2" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                  Each trade builds your credit score
                </div>
              </div>
            </motion.div>
          </div>

          {/* ── Row 4: Active Orders Table (CoinEx-inspired) ── */}
          <motion.div
            className="dash-card dash-orders"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="dash-orders__header">
              <div className="dash-orders__tabs">
                <button className="dash-orders__tab active">My Trades</button>
              </div>
              <span className="dash-orders__count">{displayedTrades.length} trades</span>
            </div>
            <div className="dash-orders__table">
              <div className="dash-orders__thead">
                <span>Pair</span><span>Side</span><span>Type</span><span>Amount</span><span>Price</span><span>Time</span><span>Status</span><span>P&L</span>
              </div>
              {displayedTrades.length === 0 && (
                <div className="dash-orders__row">
                  <span className="dash-orders__pair">No trades yet</span>
                  <span>-</span><span>-</span><span>-</span><span>-</span><span>-</span><span>-</span><span>-</span>
                </div>
              )}
              {displayedTrades.map((t, i) => (
                <motion.div
                  key={`${t.pair}-${t.time}-${i}`}
                  className="dash-orders__row"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.08 }}
                >
                  <span className="dash-orders__pair">{t.pair}</span>
                  <span style={{ color: sideColors[t.side] || '#fff', fontWeight: 600 }}>{t.side}</span>
                  <span>{t.type}</span>
                  <span>{t.amount}</span>
                  <span>{t.price}</span>
                  <span className="dash-orders__time">{t.time}</span>
                  <span className="dash-orders__status">{t.status}</span>
                  <span style={{ color: t.pnl.startsWith('+') ? '#3bf7d2' : '#ff4d6d', fontWeight: 600 }}>{t.pnl}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ── CTA ── */}
          <motion.div
            className="dash-card dash-cta"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
          >
            <div className="dash-cta__inner">
              <div className="dash-cta__icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3bf7d2" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <h3 className="dash-cta__title">Agentic Trading Builds Credit</h3>
                <p className="dash-cta__desc">Every trade you execute on OKX DEX and supported venues builds your on-chain credit score. Higher scores unlock larger credit lines, better rates, and increased trading capacity.</p>
                <p className="dash-cta__vision">In the future, agents will use the Wallet API for complete on-chain asset querying and autonomous transaction execution — the foundation of autonomous agentic credit on X&nbsp;Layer.</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ═══════════════════════════════════════════════
            RIGHT SIDEBAR — Transaction History (CoinEx-inspired)
           ═══════════════════════════════════════════════ */}
        <motion.aside
          className="dash-sidebar"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.45 }}
        >
          <div className="dash-card dash-txhist">
            <h3 className="dash-card__title" style={{ color: 'var(--bondcredit-green)' }}>Transaction History</h3>
            <div className="dash-txhist__list">
              {TX_HISTORY.map((tx, i) => (
                <motion.div
                  key={`${tx.label}-${i}`}
                  className="dash-txhist__item"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                >
                  <div className={`dash-txhist__icon dash-txhist__icon--${tx.type}`}>
                    {tx.type === 'receive' && <ArrowDownLeft size={14} />}
                    {tx.type === 'send' && <ArrowUpRight size={14} />}
                    {tx.type === 'fee' && <Zap size={14} />}
                    {tx.type === 'credit' && <Star size={14} />}
                  </div>
                  <div className="dash-txhist__info">
                    <div className="dash-txhist__label">{tx.label}</div>
                    <div className="dash-txhist__time">{tx.time}</div>
                  </div>
                  <div className={`dash-txhist__amount ${tx.type === 'receive' || tx.type === 'credit' ? 'positive' : 'negative'}`}>
                    {tx.asset}
                  </div>
                </motion.div>
              ))}
            </div>
            <button className="dash-txhist__see-all">See All →</button>
          </div>

          {/* Wallet Summary */}
          <div className="dash-card dash-wallet-mini">
            <h3 className="dash-card__title">Wallet</h3>
            <div className="dash-wallet-mini__total">${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div className="dash-wallet-mini__sub">Expected: ${(totalUsd * 1.028).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div className="dash-wallet-mini__tokens">
              {WALLET_TOKENS.map(t => (
                <div key={t.symbol} className="dash-wallet-mini__token">
                  <div className="dash-wallet-mini__token-icon">{t.symbol.charAt(0)}</div>
                  <span className="dash-wallet-mini__token-sym">{t.symbol}</span>
                  <span className="dash-wallet-mini__token-amt">{t.amount}</span>
                  <span className={`dash-wallet-mini__token-chg ${t.positive ? 'up' : 'down'}`}>{t.change}</span>
                </div>
              ))}
            </div>
            <div className="dash-wallet-mini__actions">
              <button className="dash-wallet-mini__btn dash-wallet-mini__btn--primary">Deposit</button>
              <button className="dash-wallet-mini__btn">Withdraw</button>
            </div>
          </div>
        </motion.aside>
      </div>
    </main>
  );
};

export default TradingDashboardPage;
