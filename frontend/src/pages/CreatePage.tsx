import React, { useState } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import { Coins, TrendingUp, Eye, Settings, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useBondCredit } from '../context/BondCreditContext';

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
}

/* ─── Types ─── */
interface AgentFormData {
  email: string;
  walletAddress: string;
  agentName: string;
  description: string;
  agentType: string;
  serviceUrl: string;
  tools: string;
  subscriptionTier: string;
}

const AGENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  stablecoin: <Coins size={20} color="#3bf7d2" />,
  perpetual: <TrendingUp size={20} color="#bced62" />,
  prediction: <Eye size={20} color="#7aa7ff" />,
  other: <Settings size={20} color="#ffb066" />,
};

const AGENT_TYPES = [
  { id: 'stablecoin', label: 'Stablecoin Strategy', desc: 'Yield optimization and stablecoin management' },
  { id: 'perpetual', label: 'Perpetual Trader', desc: 'Leverage trading and position management' },
  { id: 'prediction', label: 'Prediction Market', desc: 'Event-driven prediction market trading' },
  { id: 'other', label: 'Other', desc: 'Custom agent type or multi-strategy' },
];

const STEPS = [
  { num: 1, label: 'Wallet' },
  { num: 2, label: 'Agent Info' },
  { num: 3, label: 'Subscribe' },
  { num: 4, label: 'Dashboard' },
];

/* ─── Stepper ─── */
const Stepper: React.FC<{ current: number }> = ({ current }) => (
  <div className="create-stepper">
    {STEPS.map((step, i) => {
      const isActive = step.num === current;
      const isDone = step.num < current;
      return (
        <React.Fragment key={step.num}>
          {i > 0 && (
            <div
              className="create-stepper__line"
              style={{ background: isDone ? 'var(--bondcredit-green)' : 'var(--bondcredit-border)' }}
            />
          )}
          <div className={`create-stepper__step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
            <div className="create-stepper__circle">
              {isDone ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                step.num
              )}
            </div>
            <span className="create-stepper__label">{step.label}</span>
          </div>
        </React.Fragment>
      );
    })}
  </div>
);

/* ─── Slide Animations ─── */
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

function getCreditAmountForTier(tier: string): number {
  if (tier === 'free') return 0.01;
  if (tier === 'enterprise') return 0.2;
  return 0.0001;
}

const DEFAULT_SUBSCRIPTION_MANAGER_ADDRESS = '0xAEA215B9F67E0d87B9B89828A1F2dE365Ef1EAd5';
const DEFAULT_XLAYER_TESTNET_CHAIN_ID = 1952n;
const DEFAULT_XLAYER_TESTNET_RPC_URL = 'https://testrpc.xlayer.tech';
const DEFAULT_XLAYER_TESTNET_EXPLORER_URL = 'https://www.oklink.com/xlayer-test';
const SUBSCRIPTION_MANAGER_ABI = [
  'function pricePerDayWei() view returns (uint256)',
  'function subscribe(uint256 daysToBuy) payable returns (uint256 expiry)'
] as const;

function getSubscriptionDaysForTier(_tier: string): number {
  return 30;
}

function getErrorMessage(error: unknown): string {
  if (isWalletActionRejected(error)) return 'Transaction signature was rejected in wallet.';

  const shortMessage = getObjectStringField(error, 'shortMessage');
  if (shortMessage) {
    const mapped = mapKnownWalletMessage(shortMessage);
    if (mapped) return mapped;
    return shortMessage;
  }

  const message = getObjectStringField(error, 'message');
  if (message) {
    const mapped = mapKnownWalletMessage(message);
    if (mapped) return mapped;
  }

  return error instanceof Error ? error.message : 'Subscription transaction failed';
}

function toHexChainId(chainId: bigint): string {
  return `0x${chainId.toString(16)}`;
}

function getErrorCode(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) return undefined;
  return (error as { code?: unknown }).code;
}

function isWalletActionRejected(error: unknown): boolean {
  const code = getErrorCode(error);
  return code === 4001 || code === 'ACTION_REJECTED';
}

function getObjectStringField(error: unknown, field: 'shortMessage' | 'message'): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const value = (error as { shortMessage?: unknown; message?: unknown })[field];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function mapKnownWalletMessage(message: string): string | null {
  const lower = message.toLowerCase();
  if (lower.includes('could not decode result data')) {
    return 'Could not read subscription pricing from this network. Switch wallet network to XLayer testnet and retry.';
  }
  if (lower.includes('could not add network that points to same rpc endpoint')) {
    return 'XLayer testnet may already be configured in your wallet. Switch to it in MetaMask and retry.';
  }
  if (lower.includes('wallet network switch rejected')) {
    return 'Wallet network switch was rejected. Please switch to XLayer testnet and try again.';
  }
  return null;
}

async function switchWalletChain(injected: Eip1193Provider, expectedHex: string): Promise<void> {
  await injected.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: expectedHex }],
  });
}

async function addWalletChain(injected: Eip1193Provider, expectedHex: string): Promise<void> {
  await injected.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: expectedHex,
      chainName: 'X Layer Testnet',
      nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
      rpcUrls: [import.meta.env.VITE_XLAYER_TESTNET_RPC_URL ?? DEFAULT_XLAYER_TESTNET_RPC_URL],
      blockExplorerUrls: [
        import.meta.env.VITE_XLAYER_TESTNET_EXPLORER_URL ?? DEFAULT_XLAYER_TESTNET_EXPLORER_URL,
      ],
    }],
  });
}

async function ensureWalletOnExpectedChain(
  provider: BrowserProvider,
  injected: Eip1193Provider,
  expectedChainId: bigint,
): Promise<void> {
  const current = await provider.getNetwork();
  if (current.chainId === expectedChainId) return;

  const expectedHex = toHexChainId(expectedChainId);

  try {
    await switchWalletChain(injected, expectedHex);
    return;
  } catch (switchError) {
    const maybeCode = getErrorCode(switchError);

    if (maybeCode === 4902) {
      try {
        await addWalletChain(injected, expectedHex);
        await switchWalletChain(injected, expectedHex);
        return;
      } catch (addError) {
        if (isWalletActionRejected(addError)) {
          throw new Error('Wallet network switch rejected');
        }

        throw addError;
      }
    }

    if (isWalletActionRejected(switchError)) {
      throw new Error('Wallet network switch rejected');
    }

    throw switchError;
  }
}

/* ─── Main Component ─── */
const CreatePage: React.FC = () => {
  const { setCfg, appendLog } = useBondCredit();
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [walletStatus, setWalletStatus] = useState('');
  const [walletError, setWalletError] = useState('');
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [subscriptionError, setSubscriptionError] = useState('');
  const [isApplyingCredit, setIsApplyingCredit] = useState(false);
  const [isSavingAgentProfile, setIsSavingAgentProfile] = useState(false);
  const [agentProfileError, setAgentProfileError] = useState('');
  const [agentDbId, setAgentDbId] = useState<number | null>(null);
  const [form, setForm] = useState<AgentFormData>({
    email: '',
    walletAddress: '',
    agentName: '',
    description: '',
    agentType: '',
    serviceUrl: '',
    tools: '',
    subscriptionTier: 'pro',
  });

  const next = () => { setDir(1); setStep(s => Math.min(s + 1, 4)); };
  const back = () => { setDir(-1); setStep(s => Math.max(s - 1, 1)); };
  const update = (field: keyof AgentFormData, val: string) => setForm(f => ({ ...f, [field]: val }));

  const handleApplyCreditForSubscription = async () => {
    setSubscriptionError('');
    setSubscriptionStatus('');

    if (!form.walletAddress) {
      setSubscriptionError('Connect your wallet in Step 1 before subscribing.');
      return;
    }

    setIsApplyingCredit(true);
    try {
      const injected = (globalThis as typeof globalThis & { ethereum?: Eip1193Provider }).ethereum;
      if (!injected) {
        throw new Error('No wallet found. Install MetaMask or another injected EVM wallet.');
      }

      setSubscriptionStatus('Connecting wallet...');
      const provider = new BrowserProvider(injected);
      await injected.request({ method: 'eth_requestAccounts' });

      const expectedChainIdRaw = import.meta.env.VITE_BONDCREDIT_CHAIN_ID;
      const expectedChainId = expectedChainIdRaw ? BigInt(expectedChainIdRaw) : DEFAULT_XLAYER_TESTNET_CHAIN_ID;
      setSubscriptionStatus('Switching wallet to XLayer testnet...');
      await ensureWalletOnExpectedChain(provider, injected, expectedChainId);

      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();

      if (signerAddress.toLowerCase() !== form.walletAddress.toLowerCase()) {
        throw new Error('Connected wallet does not match Step 1 wallet. Switch wallet account and try again.');
      }

      const subscriptionManagerAddress =
        import.meta.env.VITE_BONDCREDIT_SUBSCRIPTION_MANAGER ?? DEFAULT_SUBSCRIPTION_MANAGER_ADDRESS;

      setSubscriptionStatus('Wallet connected. Verifying network...');
      const network = await provider.getNetwork();
      const contractCode = await provider.getCode(subscriptionManagerAddress);
      if (contractCode === '0x') {
        throw new Error(
          `Subscription contract is not deployed at ${subscriptionManagerAddress} on chainId ${network.chainId.toString()}. Switch wallet to XLayer testnet and retry.`
        );
      }

      const subscriptionContract = new Contract(subscriptionManagerAddress, SUBSCRIPTION_MANAGER_ABI, signer);

      const daysToBuy = getSubscriptionDaysForTier(form.subscriptionTier);
      setSubscriptionStatus('Preparing subscription transaction...');
      const pricePerDayWei = await subscriptionContract.pricePerDayWei();
      const totalValueWei = pricePerDayWei * BigInt(daysToBuy);

      setSubscriptionStatus('Awaiting wallet signature...');
      const tx = await subscriptionContract.subscribe(daysToBuy, { value: totalValueWei });

      setSubscriptionStatus('Transaction pending...');
      await tx.wait();

      appendLog(
        `subscription.manual.sign(): ${JSON.stringify({
          wallet: signerAddress,
          txHash: tx.hash,
          daysToBuy,
          tier: form.subscriptionTier,
        }, null, 2)}`
      );

      const amount = getCreditAmountForTier(form.subscriptionTier);
      setSubscriptionStatus(`Success. Subscription confirmed for ${daysToBuy} days. Tx: ${tx.hash.slice(0, 10)}... Credit target: ${amount} OKB.`);

      next();
    } catch (error) {
      const message = getErrorMessage(error);
      setSubscriptionError(message);
      appendLog(`subscription.manual.sign.error(): ${message}`);
    } finally {
      setIsApplyingCredit(false);
    }
  };

  const handleStep1Next = async () => {
    setWalletError('');
    setWalletStatus('');

    const normalizedEmail = form.email.trim();
    const normalizedWalletAddress = form.walletAddress.trim();

    if (!normalizedEmail) {
      setWalletError('Enter your email before continuing.');
      return;
    }

    if (!normalizedWalletAddress) {
      setWalletError('Connect your wallet before continuing.');
      return;
    }

    const apiBase = import.meta.env.VITE_BONDCREDIT_API_BASE_URL ?? 'http://localhost:3000';
    setIsConnectingWallet(true);

    try {
      const enrollResponse = await fetch(`${apiBase}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: normalizedWalletAddress,
          email: normalizedEmail,
        }),
      });

      const enrollResult = await enrollResponse.json().catch(() => null);
      if (!enrollResponse.ok) {
        const message =
          typeof enrollResult?.error === 'string' ? enrollResult.error : `Enrollment failed (${enrollResponse.status})`;
        throw new Error(message);
      }

      appendLog(`enroll(): ${JSON.stringify(enrollResult, null, 2)}`);
      // Capture DB agentId from Step 1 enrollment for use in Step 2 update
      if (typeof enrollResult?.agentId === 'number') {
        setAgentDbId(enrollResult.agentId);
        globalThis.localStorage.setItem('bondcredit.agentDbId', String(enrollResult.agentId));
      }
      setWalletStatus('Email and wallet saved successfully.');
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Enrollment failed';
      setWalletError(message);
      appendLog(`enroll.error(): ${message}`);
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleStep2Next = async () => {
    setAgentProfileError('');

    // Validate that we have the agentDbId from Step 1
    if (agentDbId === null) {
      setAgentProfileError('Missing agent database ID from Step 1. Go back and complete Step 1 enrollment first.');
      return;
    }

    if (!form.agentName.trim() || !form.agentType.trim()) {
      setAgentProfileError('Agent Name and Agent Type are required.');
      return;
    }

    const apiBase = import.meta.env.VITE_BONDCREDIT_API_BASE_URL ?? 'http://localhost:3000';
    setIsSavingAgentProfile(true);
    try {
      // Step 2: Call /agent/update with database agentId (not walletAddress)
      const updateResponse = await fetch(`${apiBase}/agent/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agentDbId,  // Database ID from Step 1
          email: form.email.trim() || undefined,
          agentName: form.agentName.trim(),
          description: form.description.trim() || undefined,
          agentType: form.agentType,
          serviceUrl: form.serviceUrl.trim() || undefined,
          tools: form.tools.trim() || undefined,
        }),
      });

      const updateResult = await updateResponse.json().catch(() => null);
      if (!updateResponse.ok) {
        const message =
          typeof updateResult?.error === 'string' ? updateResult.error : `Profile save failed (${updateResponse.status})`;
        throw new Error(message);
      }

      appendLog(`agent.update(): ${JSON.stringify(updateResult, null, 2)}`);
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Profile save failed';
      setAgentProfileError(message);
      appendLog(`agent.update.error(): ${message}`);
    } finally {
      setIsSavingAgentProfile(false);
    }
  };

  const handleConnectExistingWallet = async () => {
    setWalletError('');
    setWalletStatus('');
    setIsConnectingWallet(true);

    try {
      const provider = (globalThis as typeof globalThis & { ethereum?: Eip1193Provider }).ethereum;
      if (!provider) {
        setWalletError('No injected wallet found. Install MetaMask or another EVM wallet extension.');
        return;
      }

      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const connectedAddress = Array.isArray(accounts) ? String(accounts[0] ?? '') : '';
      if (!connectedAddress) {
        setWalletError('Wallet connected but no account address was returned.');
        return;
      }

      update('walletAddress', connectedAddress);
      setCfg(prev => ({ ...prev, agentId: connectedAddress }));
      appendLog(`wallet.connect(): ${connectedAddress}`);
      setWalletStatus(`Connected ${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}. Click Next to save email + wallet.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wallet connection failed';
      setWalletError(message);
      appendLog(`wallet.connect.error(): ${message}`);
    } finally {
      setIsConnectingWallet(false);
    }
  };

  return (
    <main className="create-page wt-container" style={{ marginTop: '88px', paddingBottom: '80px' }}>
      {/* Title */}
      <motion.div
        className="create-page__header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="create-page__icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--bondcredit-green)" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <circle cx="12" cy="10" r="3" />
            <path d="M7 20c0-3 2.5-5 5-5s5 2 5 5" />
          </svg>
        </div>
        <h1 className="create-page__title">Create Agent</h1>
        <p className="create-page__subtitle">
          Register your autonomous agent on the BondCredit XLayer network
        </p>
      </motion.div>

      {/* Stepper */}
      <Stepper current={step} />

      {/* Slides */}
      <div className="create-page__body">
        <AnimatePresence mode="wait" custom={dir}>
          {step === 1 && (
            <motion.div
              key="step1"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            >
              <Step1
                form={form}
                update={update}
                onNext={handleStep1Next}
                onConnectWallet={handleConnectExistingWallet}
                walletStatus={walletStatus}
                walletError={walletError}
                connectingWallet={isConnectingWallet}
              />
            </motion.div>
          )}
          {step === 2 && (
            <motion.div
              key="step2"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            >
              <Step2
                form={form}
                update={update}
                onNext={handleStep2Next}
                onBack={back}
                saving={isSavingAgentProfile}
                error={agentProfileError}
              />
            </motion.div>
          )}
          {step === 3 && (
            <motion.div
              key="step3"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            >
              <Step3
                form={form}
                update={update}
                onBack={back}
                onSubscribe={handleApplyCreditForSubscription}
                subscribing={isApplyingCredit}
                subscriptionStatus={subscriptionStatus}
                subscriptionError={subscriptionError}
              />
            </motion.div>
          )}
          {step === 4 && (
            <motion.div
              key="step4"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            >
              <Step4 form={form} onBack={back} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Autonomous path hint */}
      {step === 1 && (
        <motion.div
          className="create-page__auto-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <div className="create-page__auto-hint-inner bc-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Bot size={20} color="#3bf7d2" />
              <span style={{ fontWeight: 600, color: 'var(--bondcredit-white)' }}>Autonomous Registration</span>
            </div>
            <p style={{ color: 'var(--bondcredit-s2)', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>
              Agents can skip manual sign-up by ingesting our{' '}
              <Link to="/skill" style={{ color: 'var(--bondcredit-green)', textDecoration: 'underline' }}>SKILL.md</Link>.
              Our Credit Scoring Agent will review and onboard autonomously.
            </p>
          </div>
        </motion.div>
      )}

    </main>
  );
};

/* ─── STEP 1: Wallet / Email ─── */
const Step1: React.FC<{
  form: AgentFormData;
  update: (k: keyof AgentFormData, v: string) => void;
  onNext: () => void;
  onConnectWallet: () => Promise<void>;
  walletStatus: string;
  walletError: string;
  connectingWallet: boolean;
}> = ({ form, update, onNext, onConnectWallet, walletStatus, walletError, connectingWallet }) => (
  <div className="create-slide bc-card">
    <div className="create-slide__heading">
      <span className="create-slide__phase">Step 1: Onchain Wallet</span>
      <h2 className="create-slide__title">Connect Your Agentic Wallet</h2>
      <p className="create-slide__desc">
        Provide your email to create or link an Onchain OS Agentic Wallet. This wallet identity is used to manage your agent's on-chain activity, subscriptions, and credit score.
      </p>
    </div>

    <div className="create-slide__form">
      <label className="create-label">
        <span>Email Address</span>
        <input
          type="email"
          placeholder="agent-operator@example.com"
          value={form.email}
          onChange={e => update('email', e.target.value)}
          className="create-input"
        />
      </label>

      <div className="create-slide__or">
        {/* <div className="create-slide__or-line" /> */}
        {/* <span>or</span> */}
        {/* <div className="create-slide__or-line" /> */}
      </div>

      <button
        className="bc-btn create-slide__wallet-btn"
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px' }}
        onClick={onConnectWallet}
        disabled={connectingWallet}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="6" width="20" height="14" rx="3" />
          <path d="M2 10h20" />
          <circle cx="17" cy="15" r="1.5" fill="currentColor" />
        </svg>
        {connectingWallet ? 'Connecting Wallet...' : 'Connect Existing Wallet'}
      </button>

      {!!form.walletAddress && (
        <p style={{ margin: '10px 0 0', fontSize: '0.8125rem', color: 'var(--bondcredit-green)' }}>
          Connected wallet: {form.walletAddress}
        </p>
      )}
      {!!walletError && (
        <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: '#ff7d7d' }}>
          {walletError}
        </p>
      )}
    </div>

    <div className="create-slide__actions">
      <div />
      <button
        className="bc-btn bc-btnPrimary create-slide__next"
        onClick={onNext}
        disabled={connectingWallet || !form.email || !form.walletAddress}
      >
        {connectingWallet ? 'Saving...' : 'Next: Agent Info →'}
      </button>
    </div>
  </div>
);

/* ─── STEP 2: Agent Description ─── */
const Step2: React.FC<{
  form: AgentFormData;
  update: (k: keyof AgentFormData, v: string) => void;
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
  error: string;
}> = ({ form, update, onNext, onBack, saving, error }) => (
  <div className="create-slide bc-card">
    <div className="create-slide__heading">
      <span className="create-slide__phase">Step 2: Agent Profile</span>
      <h2 className="create-slide__title">Describe Your Agent</h2>
      <p className="create-slide__desc">Tell us about your agent so we can tailor its credit profile and marketplace visibility.</p>
    </div>

    <div className="create-slide__form">
      <label className="create-label">
        <span>Agent Name</span>
        <input
          type="text"
          placeholder="e.g. AlphaYield-v3"
          value={form.agentName}
          onChange={e => update('agentName', e.target.value)}
          className="create-input"
        />
      </label>

      <label className="create-label">
        <span>Description</span>
        <textarea
          placeholder="A brief description of what your agent does..."
          value={form.description}
          onChange={e => update('description', e.target.value)}
          className="create-input create-textarea"
          rows={3}
        />
      </label>

      <div className="create-type-label">Agent Type</div>
      <div className="create-type-grid">
        {AGENT_TYPES.map(t => (
          <button
            key={t.id}
            className={`create-type-card bc-card ${form.agentType === t.id ? 'selected' : ''}`}
            onClick={() => update('agentType', t.id)}
          >
            <div className="create-type-card__icon">{AGENT_TYPE_ICONS[t.id]}</div>
            <div className="create-type-card__label">{t.label}</div>
            <div className="create-type-card__desc">{t.desc}</div>
          </button>
        ))}
      </div>

      <label className="create-label" style={{ marginTop: '8px' }}>
        <span>Service URL <span style={{ opacity: 0.5 }}>(optional)</span></span>
        <input
          type="url"
          placeholder="https://api.example.com/mcp"
          value={form.serviceUrl}
          onChange={e => update('serviceUrl', e.target.value)}
          className="create-input"
        />
      </label>

      <label className="create-label">
        <span>Tools / Capabilities <span style={{ opacity: 0.5 }}>(comma-separated, optional)</span></span>
        <input
          type="text"
          placeholder="data_analysis, chart_generation, report_builder"
          value={form.tools}
          onChange={e => update('tools', e.target.value)}
          className="create-input"
        />
      </label>
    </div>

    <div className="create-slide__actions">
      <button className="bc-btn create-slide__back" onClick={onBack}>← Back</button>
      <button
        className="bc-btn bc-btnPrimary create-slide__next"
        onClick={onNext}
        disabled={saving || !form.agentName || !form.agentType}
      >
        {saving ? 'Saving Profile...' : 'Next: Subscribe →'}
      </button>
    </div>

    {!!error && (
      <p style={{ marginTop: '10px', fontSize: '0.8125rem', color: '#ff7d7d' }}>
        {error}
      </p>
    )}
  </div>
);

/* ─── STEP 3: Subscribe / x402 Payment ─── */
const Step3: React.FC<{
  form: AgentFormData;
  update: (k: keyof AgentFormData, v: string) => void;
  onBack: () => void;
  onSubscribe: () => Promise<void>;
  subscribing: boolean;
  subscriptionStatus: string;
  subscriptionError: string;
}> = ({ form, update, onBack, onSubscribe, subscribing, subscriptionStatus, subscriptionError }) => {
  let subscribeButtonText = 'Sign & Subscribe →';
  if (subscribing) {
    subscribeButtonText = 'Waiting for Wallet...';
  } else if (form.subscriptionTier === 'free') {
    subscribeButtonText = 'Sign & Continue →';
  }

  const tiers = [
    {
      id: 'free',
      name: 'Explorer',
      price: 'Free',
      features: ['Basic credit score', '10 API calls/day', 'Community support'],
    },
    {
      id: 'pro',
      name: 'Pro Agent',
      price: '0.05 ETH/mo',
      features: ['Full credit analytics', 'Unlimited API calls', 'OKX DEX access', 'x402 payment delegation', 'Priority support'],
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'Fleet',
      price: '0.2 ETH/mo',
      features: ['Multi-agent management', 'Custom credit models', 'Dedicated infrastructure', 'SLA guarantee', 'White-glove onboarding'],
    },
  ];

  return (
    <div className="create-slide bc-card">
      <div className="create-slide__heading">
        <span className="create-slide__phase">Step 3: Subscription</span>
        <h2 className="create-slide__title">Choose Your Plan</h2>
        <p className="create-slide__desc">Select a subscription tier. Payment is handled securely via x402 protocol.</p>
      </div>

      <div className="create-tiers">
        {tiers.map(tier => (
          <button
            key={tier.id}
            className={`create-tier bc-card ${form.subscriptionTier === tier.id ? 'selected' : ''} ${tier.popular ? 'popular' : ''}`}
            onClick={() => update('subscriptionTier', tier.id)}
          >
            {tier.popular && <div className="create-tier__badge">Most Popular</div>}
            <h3 className="create-tier__name">{tier.name}</h3>
            <div className="create-tier__price">{tier.price}</div>
            <ul className="create-tier__features">
              {tier.features.map(f => (
                <li key={f}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bondcredit-green)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  {f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <div className="create-x402-info bc-card" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59, 247, 210, 0.1)', border: '1px solid rgba(59, 247, 210, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'var(--bondcredit-green)' }}>x402</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--bondcredit-white)' }}>Secure Payment via x402</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--bondcredit-s2)' }}>On-chain settlement · Transparent · Non-custodial</div>
          </div>
        </div>
      </div>

      <div className="create-slide__actions">
        <button className="bc-btn create-slide__back" onClick={onBack}>← Back</button>
        <button
          className="bc-btn bc-btnPrimary create-slide__next"
          onClick={onSubscribe}
          disabled={subscribing || !form.walletAddress}
        >
          {subscribeButtonText}
        </button>
      </div>
      {!form.walletAddress && (
        <p style={{ marginTop: '10px', fontSize: '0.8125rem', color: '#ffb066' }}>
          Connect your wallet in Step 1 to continue with subscription credit.
        </p>
      )}
      {!!subscriptionStatus && (
        <p style={{ marginTop: '10px', fontSize: '0.8125rem', color: 'var(--bondcredit-green)' }}>
          {subscriptionStatus}
        </p>
      )}
      {!!subscriptionError && (
        <p style={{ marginTop: '10px', fontSize: '0.8125rem', color: '#ff7d7d' }}>
          {subscriptionError}
        </p>
      )}
    </div>
  );
};

/* ─── STEP 4: Dashboard Preview ─── */
const Step4: React.FC<{ form: AgentFormData; onBack: () => void }> = ({ form, onBack }) => {
  const mockScore = 712;
  const mockBalance = '2.847';
  const mockTrades = [
    { pair: 'USDC/USDT', type: 'Swap', amount: '1,200 USDC', time: '2 min ago', status: 'Completed' },
    { pair: 'ETH/USDC', type: 'Long', amount: '0.5 ETH', time: '15 min ago', status: 'Completed' },
    { pair: 'OKB/USDT', type: 'Swap', amount: '50 OKB', time: '1 hr ago', status: 'Pending' },
  ];

  return (
    <div className="create-slide">
      <div className="create-slide__heading" style={{ textAlign: 'center' }}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(59, 247, 210, 0.12)', border: '1px solid rgba(59, 247, 210, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--bondcredit-green)" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
        </motion.div>
        <span className="create-slide__phase">Agent Registered</span>
        <h2 className="create-slide__title">{form.agentName || 'Your Agent'} is Live</h2>
        <p className="create-slide__desc">Your agent has been registered on XLayer. Here's your dashboard overview.</p>
      </div>

      {/* Dashboard Grid */}
      <div className="create-dash-grid">
        {/* Credit Score */}
        <div className="bc-card create-dash-score">
          <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--bondcredit-s2)', marginBottom: '12px' }}>Credit Score</h3>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            style={{ textAlign: 'center' }}
          >
            <div style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--bondcredit-lime)', lineHeight: 1, textShadow: '0 0 40px rgba(188, 237, 98, 0.3)' }}>{mockScore}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--bondcredit-green)', marginTop: '6px', fontWeight: 600 }}>GOOD</div>
            <div className="create-dash-score__bar">
              <div className="create-dash-score__fill" style={{ width: `${(mockScore / 850) * 100}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: 'var(--bondcredit-s2)', marginTop: '4px' }}>
              <span>300</span><span>850</span>
            </div>
          </motion.div>
        </div>

        {/* Wallet Balance */}
        <div className="bc-card create-dash-wallet">
          <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--bondcredit-s2)', marginBottom: '12px' }}>Wallet Balance</h3>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--bondcredit-white)' }}>
            {mockBalance} <span style={{ fontSize: '1rem', color: 'var(--bondcredit-s2)' }}>ETH</span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--bondcredit-green)', marginTop: '4px' }}>≈ $5,694.00</div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button className="bc-btn bc-btnPrimary" style={{ flex: 1, fontSize: '0.75rem', padding: '8px' }}>Deposit</button>
            <button className="bc-btn" style={{ flex: 1, fontSize: '0.75rem', padding: '8px' }}>Withdraw</button>
          </div>
        </div>

        {/* Market Access */}
        <div className="bc-card create-dash-market">
          <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--bondcredit-s2)', marginBottom: '12px' }}>Market Access</h3>
          <div className="create-dash-market__list">
            {['OKX DEX', 'OKX Market', 'Uniswap V3', 'Aave V3'].map(mkt => (
              <div key={mkt} className="create-dash-market__item">
                <div className="create-dash-market__dot" />
                <span>{mkt}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--bondcredit-green)' }}>Active</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Trades */}
        <div className="bc-card create-dash-trades" style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--bondcredit-s2)', marginBottom: '12px' }}>Recent Trades</h3>
          <div className="create-dash-trades__table">
            <div className="create-dash-trades__header">
              <span>Pair</span><span>Type</span><span>Amount</span><span>Time</span><span>Status</span>
            </div>
            {mockTrades.map((t, i) => (
              <motion.div
                key={`${t.pair}-${t.time}-${i}`}
                className="create-dash-trades__row"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.15 }}
              >
                <span style={{ fontWeight: 600 }}>{t.pair}</span>
                <span>{t.type}</span>
                <span>{t.amount}</span>
                <span style={{ color: 'var(--bondcredit-s2)' }}>{t.time}</span>
                <span style={{ color: t.status === 'Completed' ? 'var(--bondcredit-green)' : 'var(--bondcredit-lime)' }}>{t.status}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="create-slide__actions" style={{ marginTop: '24px' }}>
        <button className="bc-btn create-slide__back" onClick={onBack}>← Back</button>
        <Link to="/dashboard" className="bc-btn bc-btnPrimary create-slide__next" style={{ textDecoration: 'none' }}>
          Go to Full Dashboard →
        </Link>
      </div>
    </div>
  );
};

export default CreatePage;
