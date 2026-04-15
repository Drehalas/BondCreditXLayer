import React, { useEffect, useMemo, useState } from 'react';
import { AbiCoder, BrowserProvider, Contract, isAddress, parseUnits } from 'ethers';

const API_BASE_URL = import.meta.env.VITE_BONDCREDIT_API_BASE_URL ?? 'http://localhost:3000';
const EXPECTED_CHAIN_ID = BigInt(import.meta.env.VITE_BONDCREDIT_CHAIN_ID ?? '196');

type ExecutionMode = 'manual' | 'agent';
type TradeSide = 'BUY' | 'SELL' | 'LONG' | 'SHORT' | 'DEPOSIT';
type HistoryScope = 'wallet' | 'agent';
type StatusFilter = 'ALL' | 'SUCCESS' | 'FAILED';

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

interface TradeToken {
  symbol: string;
  name?: string;
  address: string;
  decimals: number;
  logoURI?: string;
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

interface ScorePayload {
  score: number;
  successfulTrades: number;
  failedTrades: number;
}

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
] as const;

function sideLabel(side: string): string {
  const normalized = side.trim().toUpperCase();
  if (normalized === 'BUY') return 'Buy';
  if (normalized === 'SELL') return 'Sell';
  if (normalized === 'LONG') return 'Long';
  if (normalized === 'SHORT') return 'Short';
  if (normalized === 'DEPOSIT') return 'Deposit';
  return side;
}

function formatRelativeTime(iso: string): string {
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  if (deltaSeconds < 3600) return `${Math.floor(deltaSeconds / 60)}m ago`;
  if (deltaSeconds < 86400) return `${Math.floor(deltaSeconds / 3600)}h ago`;
  return `${Math.floor(deltaSeconds / 86400)}d ago`;
}

function formatTokenDisplay(token: TradeToken): string {
  const trimmedName = token.name?.trim();
  return trimmedName ? `${token.symbol} (${trimmedName})` : token.symbol;
}

function parsePairSymbols(pair: string): { tokenInSymbol: string; tokenOutSymbol: string } | null {
  if (!pair || typeof pair !== 'string') return null;
  const [left, right] = pair.split('/');
  if (!left || !right) return null;
  const tokenInSymbol = left.trim().toUpperCase();
  const tokenOutSymbol = right.trim().toUpperCase();
  if (!tokenInSymbol || !tokenOutSymbol) return null;
  return { tokenInSymbol, tokenOutSymbol };
}

const TokenLogo: React.FC<{ symbol: string; logoURI?: string; size?: number }> = ({ symbol, logoURI, size = 18 }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = symbol.trim().charAt(0).toUpperCase() || '?';

  if (logoURI && !imageFailed) {
    return (
      <img
        src={logoURI}
        alt={`${symbol} logo`}
        width={size}
        height={size}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <span
      aria-label={`${symbol} logo fallback`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${Math.max(10, Math.floor(size * 0.55))}px`,
        fontWeight: 700,
        color: '#0f172a',
        background: 'linear-gradient(135deg, #d1fae5 0%, #93c5fd 100%)',
        flexShrink: 0,
      }}
    >
      {initial}
    </span>
  );
};

function normalizeTradeToken(value: unknown): TradeToken | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const symbol = typeof raw.symbol === 'string' ? raw.symbol.trim().toUpperCase() : '';
  const address = typeof raw.address === 'string' ? raw.address.trim() : '';
  const decimals = Number(raw.decimals);
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const logoURI = typeof raw.logoURI === 'string' && raw.logoURI.trim() ? raw.logoURI.trim() : undefined;

  if (!symbol || !isAddress(address) || !Number.isFinite(decimals)) {
    return null;
  }

  return {
    symbol,
    address,
    decimals,
    name: name || undefined,
    logoURI,
  };
}

function normalizeTradablePair(value: unknown): TradablePair | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const tokenIn = normalizeTradeToken(raw.tokenIn);
  const tokenOut = normalizeTradeToken(raw.tokenOut);
  if (!tokenIn || !tokenOut) return null;

  const pair = typeof raw.pair === 'string' && raw.pair.trim()
    ? raw.pair.trim().toUpperCase()
    : `${tokenIn.symbol}/${tokenOut.symbol}`;

  return {
    pair,
    tokenIn,
    tokenOut,
  };
}

async function ensureWalletOnExpectedChain(provider: BrowserProvider, injected: Eip1193Provider): Promise<void> {
  const current = await provider.getNetwork();
  if (current.chainId === EXPECTED_CHAIN_ID) return;
  await injected.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${EXPECTED_CHAIN_ID.toString(16)}` }] });
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
    console.log('[TradePage] Pre-estimating gas for approval...', {
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

    console.log('[TradePage] Gas estimate successful:', gasEstimate.toString());
    return { gasEstimate, success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[TradePage] Gas estimation failed:', errorMsg);
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
    throw new Error('Trade amount must be a positive number.');
  }
  if (amount < 1e-8) {
    throw new Error('Trade amount is too small. Use decimal token units (e.g. 0.01), not wei integers.');
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

function normalizeBuildPayloadTxSource(payload: unknown): { tx: Record<string, unknown> | null; schema: 'nested' | 'flat' } {
  if (!payload || typeof payload !== 'object') {
    return { tx: null, schema: 'flat' };
  }

  const obj = payload as Record<string, unknown>;

  if (Array.isArray(obj.data) && obj.data.length > 0) {
    const first = obj.data[0];
    if (first && typeof first === 'object' && 'tx' in first) {
      const nestedTx = (first as Record<string, unknown>).tx;
      if (nestedTx && typeof nestedTx === 'object') {
        console.log('[TradePage] Using nested tx from data[0].tx');
        return { tx: nestedTx as Record<string, unknown>, schema: 'nested' };
      }
    }
  }

  if ('to' in obj && 'data' in obj) {
    console.log('[TradePage] Falling back to flat root tx fields');
    return { tx: obj, schema: 'flat' };
  }

  return { tx: null, schema: 'flat' };
}

function decimalOrHexToHex(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '0x0';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
      return trimmed;
    }
    const num = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(num) && num >= 0) {
      return '0x' + num.toString(16);
    }
  }

  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return '0x' + Math.floor(value).toString(16);
  }

  if (typeof value === 'bigint' && value >= 0n) {
    return '0x' + value.toString(16);
  }

  throw new Error(`Cannot convert value to hex: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
}

const TradePage: React.FC = () => {
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('manual');
  const [historyScope, setHistoryScope] = useState<HistoryScope>('wallet');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [pairs, setPairs] = useState<TradablePair[]>([]);
  const [pairSearch, setPairSearch] = useState('');
  const [selectedPair, setSelectedPair] = useState('');
  const [tradeSide, setTradeSide] = useState<TradeSide>('BUY');
  const [tradeAmount, setTradeAmount] = useState('1');

  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [agentWallet, setAgentWallet] = useState('');

  const [history, setHistory] = useState<TradeHistoryItem[]>([]);
  const [totalHistory, setTotalHistory] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [score, setScore] = useState<ScorePayload | null>(null);

  const [loadingPairs, setLoadingPairs] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [submittingAgent, setSubmittingAgent] = useState(false);

  const [manualStatus, setManualStatus] = useState('');
  const [agentStatus, setAgentStatus] = useState('');
  const [error, setError] = useState('');

  const selectedPairMeta = useMemo(
    () => pairs.find(item => item.pair === selectedPair) ?? null,
    [pairs, selectedPair],
  );

  const filteredPairs = useMemo(() => {
    if (!pairSearch.trim()) return pairs;
    const query = pairSearch.trim().toUpperCase();
    return pairs.filter(item => (
      item.pair.toUpperCase().includes(query)
      || item.tokenIn.symbol.toUpperCase().includes(query)
      || (item.tokenIn.name ?? '').toUpperCase().includes(query)
      || item.tokenOut.symbol.toUpperCase().includes(query)
      || (item.tokenOut.name ?? '').toUpperCase().includes(query)
    ));
  }, [pairs, pairSearch]);

  const tokenLogoBySymbol = useMemo(() => {
    const logoMap = new Map<string, string>();
    for (const pair of pairs) {
      if (pair.tokenIn.logoURI && !logoMap.has(pair.tokenIn.symbol)) {
        logoMap.set(pair.tokenIn.symbol, pair.tokenIn.logoURI);
      }
      if (pair.tokenOut.logoURI && !logoMap.has(pair.tokenOut.symbol)) {
        logoMap.set(pair.tokenOut.symbol, pair.tokenOut.logoURI);
      }
    }
    return logoMap;
  }, [pairs]);

  const activeHistoryIdentity = historyScope === 'wallet' ? connectedWallet : agentWallet.trim();

  const loadTokens = async () => {
    setLoadingPairs(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/tokens`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : `Failed to load token pairs (${response.status})`);
      }
      const nextPairs = Array.isArray(payload?.tradablePairs)
        ? payload.tradablePairs
          .map(normalizeTradablePair)
          .filter((pair): pair is TradablePair => pair !== null)
        : [];
      setPairs(nextPairs);
      if (nextPairs.length > 0) {
        setSelectedPair(current => (current && nextPairs.some(item => item.pair === current) ? current : nextPairs[0].pair));
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load tradable pairs');
    } finally {
      setLoadingPairs(false);
    }
  };

  const loadScore = async (walletAddress: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/score/status/wallet/${walletAddress}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) return;
      if (typeof payload?.score === 'number') {
        setScore({
          score: payload.score,
          successfulTrades: Number(payload.successfulTrades ?? 0),
          failedTrades: Number(payload.failedTrades ?? 0),
        });
      }
    } catch {
      // Keep score optional; history stays usable.
    }
  };

  const loadHistory = async () => {
    const identity = activeHistoryIdentity;
    if (!identity || !isAddress(identity)) {
      setHistory([]);
      setTotalHistory(0);
      setTotalPages(1);
      return;
    }

    setLoadingHistory(true);
    setError('');
    try {
      const statusSegment = statusFilter === 'ALL' ? '' : `&status=${statusFilter}`;
      const response = await fetch(
        `${API_BASE_URL}/trades/history/wallet/${identity}?page=${page}&pageSize=${pageSize}${statusSegment}`,
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : `Failed to load trade history (${response.status})`);
      }
      setHistory(Array.isArray(payload?.trades) ? payload.trades as TradeHistoryItem[] : []);
      setTotalHistory(Number(payload?.total ?? 0));
      setTotalPages(Math.max(1, Number(payload?.totalPages ?? 1)));
      await loadScore(identity);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load trade history');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    void loadTokens();
  }, []);

  useEffect(() => {
    const injected = (globalThis as typeof globalThis & { ethereum?: Eip1193Provider }).ethereum;
    if (!injected) return;

    const syncWallet = async () => {
      try {
        const accounts = await injected.request({ method: 'eth_accounts' });
        const primary = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null;
        setConnectedWallet(primary && isAddress(primary) ? primary : null);
      } catch {
        setConnectedWallet(null);
      }
    };

    const onAccountsChanged = (accounts: unknown) => {
      const primary = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null;
      setConnectedWallet(primary && isAddress(primary) ? primary : null);
    };

    void syncWallet();
    injected.on?.('accountsChanged', onAccountsChanged);
    return () => {
      injected.removeListener?.('accountsChanged', onAccountsChanged);
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, pageSize, historyScope, connectedWallet, agentWallet]);

  useEffect(() => {
    void loadHistory();
  }, [page, pageSize, statusFilter, historyScope, connectedWallet, agentWallet]);

  const connectWallet = async () => {
    setError('');
    const injected = (globalThis as typeof globalThis & { ethereum?: Eip1193Provider }).ethereum;
    if (!injected) {
      setError('No injected wallet found. Install MetaMask or another EVM wallet extension.');
      return;
    }

    try {
      const accounts = await injected.request({ method: 'eth_requestAccounts' });
      const primary = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null;
      if (!primary || !isAddress(primary)) {
        throw new Error('Wallet connection returned an invalid address.');
      }
      setConnectedWallet(primary);
      setHistoryScope('wallet');
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Wallet connection failed');
    }
  };

  const executeManualTrade = async () => {
    setError('');
    setManualStatus('');

    if (!connectedWallet || !isAddress(connectedWallet)) {
      setError('Connect your wallet before submitting manual trades.');
      return;
    }
    if (!selectedPairMeta) {
      setError('Select a tradable pair before submitting.');
      return;
    }
    const amountNumber = Number(tradeAmount);
    try {
      validateTradeAmountInput(amountNumber);
    } catch (amountError) {
      setError(amountError instanceof Error ? amountError.message : 'Invalid trade amount.');
      return;
    }

    const injected = (globalThis as typeof globalThis & { ethereum?: Eip1193Provider }).ethereum;
    if (!injected) {
      setError('No injected wallet found. Install MetaMask or another EVM wallet extension.');
      return;
    }

    setSubmittingManual(true);
    try {
      const provider = await createProviderAfterChainSync(injected);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      await validateManualTradePreflight(provider, selectedPairMeta.tokenIn.address);

      setManualStatus('Fetching quote...');
      const quoteResponse = await fetch(
        `${API_BASE_URL}/quote?tokenIn=${encodeURIComponent(selectedPairMeta.tokenIn.address)}&tokenOut=${encodeURIComponent(selectedPairMeta.tokenOut.address)}&amount=${encodeURIComponent(String(amountNumber))}&userAddress=${encodeURIComponent(signerAddress)}`,
      );
      const quotePayload = await quoteResponse.json().catch(() => null);
      if (!quoteResponse.ok) {
        throw new Error(typeof quotePayload?.error === 'string' ? quotePayload.error : `Quote failed (${quoteResponse.status})`);
      }

      setManualStatus('Building transaction...');
      const buildResponse = await fetch(
        `${API_BASE_URL}/build-tx?tokenIn=${encodeURIComponent(selectedPairMeta.tokenIn.address)}&tokenOut=${encodeURIComponent(selectedPairMeta.tokenOut.address)}&amount=${encodeURIComponent(String(amountNumber))}&userAddress=${encodeURIComponent(signerAddress)}`,
      );
      const buildPayload = await buildResponse.json().catch(() => null);
      if (!buildResponse.ok) {
        throw new Error(typeof buildPayload?.error === 'string' ? buildPayload.error : `Build failed (${buildResponse.status})`);
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

      // === NORMALIZE TX SOURCE FIELDS (nested or flat) ===
      const { tx: txSource, schema: txSchema } = normalizeBuildPayloadTxSource(buildPayload);
      if (!txSource) {
        throw new Error(
          'Swap builder response missing both nested (data[0].tx) and flat (root) tx fields. Verify /build-tx response format.'
        );
      }
      console.log('[TradePage] Tx source schema:', txSchema, 'Fields:', {
        to: txSource.to,
        dataLength: typeof txSource.data === 'string' ? txSource.data.length : '?',
        value: txSource.value,
        gas: txSource.gas || txSource.gasLimit,
        gasPrice: txSource.gasPrice,
      });
      // === END TX SOURCE NORMALIZATION ===

      const tokenInContract = new Contract(selectedPairMeta.tokenIn.address, ERC20_ABI, signer);
      const amountIn = parseUnits(String(amountNumber), selectedPairMeta.tokenIn.decimals);
      const spender = String(txSource.to);

      // === APPROVAL DIAGNOSTICS ===
      console.group('[TradePage] Approval Transaction Diagnostics');
      console.log('Token Contract:', selectedPairMeta.tokenIn.address);
      console.log('Spender (Router):', spender);
      console.log('Signer Address:', signerAddress);
      console.log('Amount (Wei):', amountIn.toString());
      console.log('Chain ID:', (await provider.getNetwork()).chainId);

      // Validate router contract exists
      const routerValidation = await validateRouterContract(provider, spender);
      console.log('Router Validation:', routerValidation);
      if (!routerValidation.valid) {
        throw new Error(`Router validation failed: ${routerValidation.message}`);
      }
      console.groupEnd();
      // === END DIAGNOSTICS ===

      setManualStatus('Checking allowance...');
      const allowance = (await tokenInContract.allowance(signerAddress, spender)) as bigint;
      console.log('[TradePage] Current allowance:', allowance.toString());

      if (allowance < amountIn) {
        setManualStatus('Pre-validating approval transaction...');

        // Pre-estimate gas to catch simulation errors early
        const gasResult = await preEstimateApprovalGas(
          provider,
          selectedPairMeta.tokenIn.address,
          spender,
          amountIn,
          signer,
        );

        if (!gasResult.success) {
          console.error('[TradePage] Gas pre-estimation failed:', gasResult.error);
          setError(`Approval validation failed: ${gasResult.error}`);
          throw new Error(`Approval failed pre-validation: ${gasResult.error}`);
        }

        setManualStatus('Awaiting token approval confirmation...');
        console.log('[TradePage] Sending approval transaction via ethers.js Contract.approve()...');

        try {
          const approveTx = await tokenInContract.approve(spender, amountIn);
          console.log('[TradePage] Approval tx sent:', approveTx.hash);
          await approveTx.wait();
          console.log('[TradePage] Approval confirmed');
        } catch (approveError) {
          const errorMsg = approveError instanceof Error ? approveError.message : 'Unknown error';
          console.error('[TradePage] Contract.approve() failed:', errorMsg);

          // Fallback: Try manual approval encoding
          console.warn('[TradePage] Attempting manual approval encoding fallback...');
          try {
            const manualApproveData = encodeERC20Approve(spender, amountIn);
            console.log('[TradePage] Manual encoded approve data:', manualApproveData);

            const manualApproveTx = await signer.sendTransaction({
              to: selectedPairMeta.tokenIn.address,
              data: manualApproveData,
              value: 0n,
            });

            console.log('[TradePage] Manual approval tx sent:', manualApproveTx.hash);
            await manualApproveTx.wait();
            console.log('[TradePage] Manual approval confirmed');
          } catch (manualError) {
            const manualErrorMsg = manualError instanceof Error ? manualError.message : 'Unknown error';
            console.error('[TradePage] Manual approval fallback also failed:', manualErrorMsg);
            throw new Error(`Approval failed: ${errorMsg}. Manual fallback also failed: ${manualErrorMsg}`);
          }
        }
      }

      // === BUILD ETH_SENDTRANSACTION PARAMS ===
      const txTo = typeof txSource.to === 'string' ? txSource.to : String(txSource.to ?? '');
      const txData = typeof txSource.data === 'string' ? txSource.data : String(txSource.data ?? '');
      const txValue = txSource.value ?? '0x0';
      const txGas = txSource.gas ?? txSource.gasLimit;
      const txGasPrice = txSource.gasPrice;

      if (!isAddress(txTo)) {
        throw new Error('Normalized tx.to is not a valid address');
      }
      if (!isValidCalldataHex(txData)) {
        throw new Error('Normalized tx.data is not valid hex calldata');
      }

      // Convert to hex format for wallet RPC
      const ethSendParams = [
        {
          from: signerAddress,
          to: txTo,
          data: txData,
          value: decimalOrHexToHex(txValue),
          gas: txGas ? decimalOrHexToHex(txGas) : undefined,
          gasPrice: txGasPrice ? decimalOrHexToHex(txGasPrice) : undefined,
        } as Record<string, unknown>,
      ];

      // Clean up undefined fields
      const cleanParams = ethSendParams[0];
      if (!cleanParams.gas) delete cleanParams.gas;
      if (!cleanParams.gasPrice) delete cleanParams.gasPrice;

      console.group('[TradePage] Swap eth_sendTransaction Prepared');
      console.log('Tx Source Schema:', txSchema);
      console.log('Final Params:', {
        from: cleanParams.from,
        to: cleanParams.to,
        dataLength: (cleanParams.data as string).length,
        value: cleanParams.value,
        gas: cleanParams.gas ?? 'undefined',
        gasPrice: cleanParams.gasPrice ?? 'undefined',
      });
      console.log('Build Diagnostics:', buildDiagnostics);
      console.log('Chain ID:', (await provider.getNetwork()).chainId.toString());
      console.groupEnd();
      // === END ETH_SENDTRANSACTION PREP ===

      setManualStatus('Awaiting wallet signature for swap...');
      const txHashFromRpc = (await injected.request({
        method: 'eth_sendTransaction',
        params: ethSendParams,
      })) as string;

      if (!txHashFromRpc || typeof txHashFromRpc !== 'string') {
        throw new Error('eth_sendTransaction did not return a valid transaction hash');
      }

      console.log('[TradePage] Swap tx hash from RPC:', txHashFromRpc);
      setManualStatus('Waiting for transaction receipt...');
      const receipt = await provider.waitForTransaction(txHashFromRpc);
      const txStatus = receipt?.status === 1 ? 'SUCCESS' : 'FAILED';
      const txHash = receipt?.hash ?? txHashFromRpc;

      const recordResponse = await fetch(`${API_BASE_URL}/store-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: signerAddress,
          pair: selectedPairMeta.pair,
          side: tradeSide,
          amount: amountNumber,
          txHash,
          status: txStatus,
          metadata: {
            tokenIn: selectedPairMeta.tokenIn.address,
            tokenOut: selectedPairMeta.tokenOut.address,
            amountInWei: amountIn.toString(),
            expectedToAddress: txTo,
            expectedValueWei: txValue,
            expectedData: txData,
            txSchema,
            normalizedTxFields: {
              to: txTo,
              data: txData,
              value: txValue,
              gas: txGas,
              gasPrice: txGasPrice,
            },
            quote: quotePayload,
            builtTx: buildPayload,
            manualUserSigned: true,
          },
        }),
      });

      const recordPayload = await recordResponse.json().catch(() => null);
      if (!recordResponse.ok) {
        throw new Error(typeof recordPayload?.error === 'string' ? recordPayload.error : `Store failed (${recordResponse.status})`);
      }

      setManualStatus(`Manual trade stored: ${txHash}`);
      setTradeAmount('');
      setHistoryScope('wallet');
      await loadHistory();
    } catch (tradeError) {
      setError(tradeError instanceof Error ? tradeError.message : 'Manual trade failed');
    } finally {
      setSubmittingManual(false);
    }
  };

  const executeAgentTrade = async () => {
    setError('');
    setAgentStatus('');

    const walletAddress = agentWallet.trim();
    if (!isAddress(walletAddress)) {
      setError('Agent wallet must be a valid EVM address.');
      return;
    }
    if (!selectedPairMeta) {
      setError('Select a tradable pair before submitting.');
      return;
    }
    const amountNumber = Number(tradeAmount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError('Trade amount must be a positive number.');
      return;
    }

    setSubmittingAgent(true);
    try {
      setAgentStatus('Submitting agent trade...');
      const response = await fetch(`${API_BASE_URL}/execute-trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          pair: selectedPairMeta.pair,
          tokenIn: selectedPairMeta.tokenIn.address,
          tokenOut: selectedPairMeta.tokenOut.address,
          amount: amountNumber,
          side: tradeSide,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : `Agent execution failed (${response.status})`);
      }

      setAgentStatus(`Agent trade executed: ${payload?.trade?.txHash ?? 'tx submitted'}`);
      setHistoryScope('agent');
      await loadHistory();
    } catch (tradeError) {
      setError(tradeError instanceof Error ? tradeError.message : 'Agent trade failed');
    } finally {
      setSubmittingAgent(false);
    }
  };

  const successCount = history.filter(item => item.status === 'SUCCESS').length;
  const failedCount = history.filter(item => item.status === 'FAILED').length;

  return (
    <main className="dash-page" style={{ marginTop: '64px' }}>
      <div className="dash-topbar">
        <div>
          <h1 className="dash-topbar__title">Trade</h1>
          <p className="dash-topbar__sub">Token discovery, manual execution, and agent execution from one tab</p>
        </div>
        <div className="dash-topbar__right" style={{ gap: '8px' }}>
          <button className="dash-portfolio__period" onClick={() => void loadTokens()} disabled={loadingPairs}>
            {loadingPairs ? 'Loading Tokens...' : 'Refresh Tokens'}
          </button>
          <button className="dash-portfolio__period" onClick={() => void loadHistory()} disabled={loadingHistory}>
            {loadingHistory ? 'Loading History...' : 'Refresh History'}
          </button>
        </div>
      </div>

      <div className="dash-layout" style={{ gridTemplateColumns: '1fr 340px' }}>
        <div className="dash-main">
          <section className="dash-card" style={{ marginBottom: '16px' }}>
            <div className="dash-card__header">
              <h3 className="dash-card__title">Token Listing</h3>
              <span className="dash-orders__count">{pairs.length} pairs</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '12px' }}>
              <div>
                <label className="dash-trade__label">
                  Search Pair
                  <input
                    className="dash-trade__input"
                    value={pairSearch}
                    onChange={event => setPairSearch(event.target.value)}
                    placeholder="ETH, USDC, ETH/USDC"
                  />
                </label>
                <label className="dash-trade__label" style={{ marginTop: '12px' }}>
                  Selected Pair
                  <select
                    className="dash-trade__select"
                    value={selectedPair}
                    onChange={event => setSelectedPair(event.target.value)}
                    disabled={filteredPairs.length === 0}
                  >
                    {filteredPairs.length === 0 && <option value="">No pair found</option>}
                    {filteredPairs.map(item => (
                      <option key={item.pair} value={item.pair}>
                        {`${item.pair} - ${item.tokenIn.symbol} -> ${item.tokenOut.symbol}`}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedPairMeta && (
                  <div className="dash-trade__hint" style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TokenLogo symbol={selectedPairMeta.tokenIn.symbol} logoURI={selectedPairMeta.tokenIn.logoURI} size={18} />
                      <span>{`In: ${formatTokenDisplay(selectedPairMeta.tokenIn)}`}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TokenLogo symbol={selectedPairMeta.tokenOut.symbol} logoURI={selectedPairMeta.tokenOut.logoURI} size={18} />
                      <span>{`Out: ${formatTokenDisplay(selectedPairMeta.tokenOut)}`}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="dash-orders__table" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                <div className="trade-history__thead" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr' }}>
                  <span>Pair</span>
                  <span>Token In</span>
                  <span>Token Out</span>
                  <span>Action</span>
                </div>
                {filteredPairs.slice(0, 100).map(item => (
                  <div
                    key={item.pair}
                    className="trade-history__row"
                    style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr', cursor: 'pointer' }}
                  >
                    <span className="dash-orders__pair">{item.pair}</span>
                    <span title={formatTokenDisplay(item.tokenIn)} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <TokenLogo symbol={item.tokenIn.symbol} logoURI={item.tokenIn.logoURI} size={18} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatTokenDisplay(item.tokenIn)}</span>
                    </span>
                    <span title={formatTokenDisplay(item.tokenOut)} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <TokenLogo symbol={item.tokenOut.symbol} logoURI={item.tokenOut.logoURI} size={18} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatTokenDisplay(item.tokenOut)}</span>
                    </span>
                    <button className="dash-orders__tab" onClick={() => setSelectedPair(item.pair)}>Use</button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="dash-card" style={{ marginBottom: '16px' }}>
            <div className="dash-card__header">
              <h3 className="dash-card__title">Execution</h3>
              <div className="dash-orders__tabs">
                <button className={`dash-orders__tab ${executionMode === 'manual' ? 'active' : ''}`} onClick={() => setExecutionMode('manual')}>Manual</button>
                <button className={`dash-orders__tab ${executionMode === 'agent' ? 'active' : ''}`} onClick={() => setExecutionMode('agent')}>Agent</button>
              </div>
            </div>

            <div className="dash-trade__form" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label className="dash-trade__label">
                Side
                <select className="dash-trade__select" value={tradeSide} onChange={event => setTradeSide(event.target.value as TradeSide)}>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                  <option value="LONG">LONG</option>
                  <option value="SHORT">SHORT</option>
                  <option value="DEPOSIT">DEPOSIT</option>
                </select>
              </label>

              <label className="dash-trade__label">
                Amount ({selectedPairMeta?.tokenIn.symbol ?? 'Token In'})
                <input
                  className="dash-trade__input"
                  value={tradeAmount}
                  onChange={event => setTradeAmount(event.target.value)}
                  placeholder="1"
                />
              </label>

              {executionMode === 'manual' ? (
                <>
                  <label className="dash-trade__label">
                      
                    <input className="dash-trade__input" value={connectedWallet ?? ''} readOnly placeholder="Connect wallet" />
                  </label>
                  <div style={{ display: 'flex', alignItems: 'end', gap: '8px' }}>
                    <button className="dash-trade__exec" onClick={connectWallet} disabled={submittingManual}>Connect Wallet</button>
                    <button className="dash-trade__exec dash-trade__exec--green" onClick={() => void executeManualTrade()} disabled={submittingManual}>
                      {submittingManual ? 'Submitting...' : 'Execute Manual Trade'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="dash-trade__label">
                    Agent Wallet
                    <input
                      className="dash-trade__input"
                      value={agentWallet}
                      onChange={event => setAgentWallet(event.target.value)}
                      placeholder="0x..."
                    />
                  </label>
                  <div style={{ display: 'flex', alignItems: 'end', gap: '8px' }}>
                    <button className="dash-trade__exec dash-trade__exec--green" onClick={() => void executeAgentTrade()} disabled={submittingAgent}>
                      {submittingAgent ? 'Submitting...' : 'Execute Agent Trade'}
                    </button>
                  </div>
                </>
              )}
            </div>
            {manualStatus && executionMode === 'manual' && <div className="dash-trade__hint" style={{ color: '#3bf7d2' }}>{manualStatus}</div>}
            {agentStatus && executionMode === 'agent' && <div className="dash-trade__hint" style={{ color: '#3bf7d2' }}>{agentStatus}</div>}
            {error && <div className="dash-trade__hint" style={{ color: '#ff4d6d' }}>{error}</div>}
          </section>

          <section className="dash-card dash-orders">
            <div className="dash-orders__header">
              <div className="dash-orders__tabs">
                <button className={`dash-orders__tab ${historyScope === 'wallet' ? 'active' : ''}`} onClick={() => setHistoryScope('wallet')}>Wallet History</button>
                <button className={`dash-orders__tab ${historyScope === 'agent' ? 'active' : ''}`} onClick={() => setHistoryScope('agent')}>Agent History</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="trade-stats-pill trade-stats-pill--green">{successCount} success</span>
                <span className="trade-stats-pill trade-stats-pill--red">{failedCount} failed</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '160px 140px 130px auto', gap: '8px', marginBottom: '10px' }}>
              <label className="dash-trade__label">
                Status
                <select className="dash-trade__select" value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                  <option value="ALL">All</option>
                  <option value="SUCCESS">Success</option>
                  <option value="FAILED">Failed</option>
                </select>
              </label>
              <label className="dash-trade__label">
                Page Size
                <select className="dash-trade__select" value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
              <div style={{ display: 'flex', alignItems: 'end', gap: '8px' }}>
                <button className="dash-orders__tab" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1}>Prev</button>
                <button className="dash-orders__tab" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Next</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'flex-end', color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem' }}>
                {`Page ${page} of ${totalPages} · ${totalHistory} total trades`}
              </div>
            </div>

            <div className="dash-orders__table">
              <div className="trade-history__thead" style={{ gridTemplateColumns: '60px 1fr 90px 100px 90px 140px 100px' }}>
                <span>ID</span>
                <span>Pair</span>
                <span>Side</span>
                <span>Amount</span>
                <span>Status</span>
                <span>Tx Hash</span>
                <span>When</span>
              </div>

              {history.map(item => (
                <div key={item.id} className="trade-history__row" style={{ gridTemplateColumns: '60px 1fr 90px 100px 90px 140px 100px' }}>
                  <span>{item.id}</span>
                  <span className="dash-orders__pair" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    {(() => {
                      const parsedPair = parsePairSymbols(item.pair);
                      if (!parsedPair) {
                        return <span>{item.pair}</span>;
                      }

                      const inLogo = tokenLogoBySymbol.get(parsedPair.tokenInSymbol);
                      const outLogo = tokenLogoBySymbol.get(parsedPair.tokenOutSymbol);

                      return (
                        <>
                          <TokenLogo symbol={parsedPair.tokenInSymbol} logoURI={inLogo} size={16} />
                          <TokenLogo symbol={parsedPair.tokenOutSymbol} logoURI={outLogo} size={16} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.pair}</span>
                        </>
                      );
                    })()}
                  </span>
                  <span>{sideLabel(item.side)}</span>
                  <span>{item.amount}</span>
                  <span style={{ color: item.status === 'SUCCESS' ? '#3bf7d2' : '#ff4d6d' }}>{item.status}</span>
                  <span style={{ fontFamily: 'monospace' }}>{item.txHash ? `${item.txHash.slice(0, 10)}...` : 'N/A'}</span>
                  <span>{formatRelativeTime(item.executedAt)}</span>
                </div>
              ))}

              {!loadingHistory && history.length === 0 && (
                <div style={{ padding: '20px', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                  No trades match current filters.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="dash-sidebar">
          <section className="dash-card">
            <div className="dash-card__header">
              <h3 className="dash-card__title">Score</h3>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Current Score</span><strong>{score?.score ?? 0}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Successful Trades</span><strong>{score?.successfulTrades ?? 0}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Failed Trades</span><strong>{score?.failedTrades ?? 0}</strong></div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)' }}>
                Score refreshes from wallet history endpoint after each trade action.
              </div>
            </div>
          </section>

          <section className="dash-card">
            <h3 className="dash-card__title" style={{ marginBottom: '10px' }}>Execution Notes</h3>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.62)', display: 'grid', gap: '8px' }}>
              <div>Manual flow: quote -&gt; build tx -&gt; wallet sign -&gt; store transaction.</div>
              <div>Agent flow: backend execute-trade route with enrolled agent wallet.</div>
              <div>History supports status filter, page size, and pagination.</div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
};

export default TradePage;
