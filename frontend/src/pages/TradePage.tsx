import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal,
  Zap,
  ShieldCheck,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Wallet,
  Trophy,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Fingerprint,
  Scale,
  Shield,
  Key,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
interface TradeRecord {
  id: number;
  pair: string;
  side: 'Buy' | 'Sell';
  amount: string;
  price: string;
  pnl: string;
  pnlValue: number;
  creditImpact: number;
  status: 'Success' | 'Failed';
  time: string;
  txHash: string;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const ACTIVATION_STEPS = [
  { text: 'x402 payment complete...', icon: '💳', delay: 900 },
  { text: 'Wallet analysis loading...', icon: '🔍', delay: 1100 },
  { text: 'KYC/KYB review pending...', icon: '📋', delay: 1400 },
  { text: 'KYAgent unlocked...', icon: '🤖', delay: 800 },
  { text: 'Ethos account not identified', icon: '⚠️', delay: 700 },
  { text: 'AMLBOT review completed', icon: '✅', delay: 1200 },
  { text: 'Scoring Algorithm unlocked', icon: '📊', delay: 900 },
  { text: "It's time to Bond", icon: '🚀', delay: 600 },
];

const TRADE_PAIRS = [
  { label: 'ETH / USDC', from: 'ETH', to: 'USDC', basePrice: 3685.42 },
  { label: 'XLYR / USDT', from: 'XLYR', to: 'USDT', basePrice: 1.24 },
  { label: 'WETH / WBTC', from: 'WETH', to: 'WBTC', basePrice: 0.054 },
];

const REWARD_THRESHOLD = 10;
const CREDIT_LINE_AMOUNT = 100;

const randomTxHash = () =>
  '0x' + Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('') + '...';

const formatTime = () => new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */
const TradePage: React.FC = () => {
  /* ── State ── */
  const [logs, setLogs] = useState<Array<{ text: string; type: 'system' | 'trade-ok' | 'trade-fail' | 'info'; time: string }>>([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [creditScore, setCreditScore] = useState(0);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [tradeStatus, setTradeStatus] = useState<'idle' | 'trading'>('idle');
  const [selectedPairIdx, setSelectedPairIdx] = useState(0);
  const [tradeAmount, setTradeAmount] = useState('0.5');
  const [rewardUnlocked, setRewardUnlocked] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [walletBalances, setWalletBalances] = useState({ ETH: 12.45, USDC: 4210.80, XLYR: 8500, USDT: 2100, WETH: 5.2, WBTC: 0.28 });

  const terminalRef = useRef<HTMLDivElement>(null);
  const tradeIdRef = useRef(0);

  /* ── Helpers ── */
  const addLog = useCallback((text: string, type: 'system' | 'trade-ok' | 'trade-fail' | 'info' = 'system') => {
    setLogs(prev => [...prev, { text, type, time: formatTime() }]);
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  /* ── Check reward unlock ── */
  useEffect(() => {
    if (creditScore >= REWARD_THRESHOLD && !rewardUnlocked) {
      setRewardUnlocked(true);
      setShowCelebration(true);
      addLog(`[REWARD] 🏆 $${CREDIT_LINE_AMOUNT} Credit Line UNLOCKED! Score: ${creditScore}`, 'trade-ok');
      setTimeout(() => setShowCelebration(false), 4000);
    }
  }, [creditScore, rewardUnlocked, addLog]);

  /* ── Skill Ingestion ── */
  const ingestSkills = async () => {
    if (isIngesting || isAgentActive) return;
    setIsIngesting(true);
    setLogs([]);

    addLog('> Initializing BondCredit Agent Skill Ingestion...', 'info');
    await new Promise(r => setTimeout(r, 600));

    for (const step of ACTIVATION_STEPS) {
      await new Promise(r => setTimeout(r, step.delay + Math.random() * 400));
      addLog(`${step.icon} ${step.text}`, 'system');
    }

    await new Promise(r => setTimeout(r, 500));
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
    addLog('✅ Agent activated. Onchain OS wallet connected.', 'trade-ok');
    addLog('🔗 Uniswap V3 Skill integrated.', 'info');
    addLog('📡 Ready for autonomous trading on X Layer.', 'info');

    setIsAgentActive(true);
    setIsIngesting(false);
  };

  /* ── Execute Trade ── */
  const executeTrade = async () => {
    if (!isAgentActive || tradeStatus === 'trading') return;

    const pair = TRADE_PAIRS[selectedPairIdx];
    const amount = parseFloat(tradeAmount) || 0.5;
    setTradeStatus('trading');

    addLog(`> Initiating Uniswap V3 swap: ${amount} ${pair.from} → ${pair.to}...`, 'info');
    await new Promise(r => setTimeout(r, 800));

    addLog('> Fetching liquidity routes via Onchain OS wallet...', 'info');
    await new Promise(r => setTimeout(r, 1000));

    addLog('> Optimal route identified: Uniswap V3 (0.05% fee)', 'info');
    await new Promise(r => setTimeout(r, 600));

    addLog('> Transaction signed & broadcasted...', 'info');
    await new Promise(r => setTimeout(r, 1500));

    // 70% success, 30% fail
    const isSuccess = Math.random() < 0.7;
    const priceVariation = 1 + (Math.random() - 0.5) * 0.04; // ±2%
    const executionPrice = pair.basePrice * priceVariation;
    const resultAmount = (amount * executionPrice).toFixed(2);
    const pnlPct = ((priceVariation - 1) * 100).toFixed(2);
    const pnlValue = parseFloat(((priceVariation - 1) * amount * pair.basePrice).toFixed(2));

    const tradeId = ++tradeIdRef.current;

    if (isSuccess) {
      addLog(`[SUCCESS] Swap complete. ${amount} ${pair.from} → ${resultAmount} ${pair.to}`, 'trade-ok');
      addLog(`> Credit Score: +1 (Trade performance validated)`, 'trade-ok');
      setCreditScore(prev => prev + 1);

      // Update wallet balances
      setWalletBalances(prev => ({
        ...prev,
        [pair.from]: Math.max(0, (prev[pair.from as keyof typeof prev] || 0) - amount),
        [pair.to]: (prev[pair.to as keyof typeof prev] || 0) + parseFloat(resultAmount),
      }));

      setTrades(prev => [{
        id: tradeId,
        pair: pair.label,
        side: 'Buy',
        amount: `${amount} ${pair.from}`,
        price: `$${executionPrice.toFixed(2)}`,
        pnl: `+${pnlPct}%`,
        pnlValue: Math.abs(pnlValue),
        creditImpact: +1,
        status: 'Success',
        time: formatTime(),
        txHash: randomTxHash(),
      }, ...prev]);
    } else {
      addLog(`[FAILED] Swap reverted. Slippage exceeded on ${pair.from}/${pair.to}`, 'trade-fail');
      addLog(`> Credit Score: -1 (Trade failure recorded)`, 'trade-fail');
      setCreditScore(prev => Math.max(0, prev - 1));

      setTrades(prev => [{
        id: tradeId,
        pair: pair.label,
        side: 'Sell',
        amount: `${amount} ${pair.from}`,
        price: `$${executionPrice.toFixed(2)}`,
        pnl: `${pnlPct}%`,
        pnlValue: -Math.abs(pnlValue),
        creditImpact: -1,
        status: 'Failed',
        time: formatTime(),
        txHash: randomTxHash(),
      }, ...prev]);
    }

    setTradeStatus('idle');
  };

  /* ── Derived ── */
  const successCount = trades.filter(t => t.status === 'Success').length;
  const failCount = trades.filter(t => t.status === 'Failed').length;
  const progressPct = Math.min((creditScore / REWARD_THRESHOLD) * 100, 100);
  const tradesUntilUnlock = Math.max(0, REWARD_THRESHOLD - creditScore);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <main className="dash-page" style={{ marginTop: '64px' }}>
      {/* ── Top Bar ── */}
      <div className="dash-topbar" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="dash-topbar__title">
            Agent Trade <span style={{ color: '#bced62', fontWeight: 400 }}>&amp; Credit Loop</span>
          </h1>
          <p className="dash-topbar__sub">Autonomous agent trading on Uniswap via Onchain OS — Credit scoring in real-time</p>
        </div>
        <div className="dash-topbar__right">
          <div
            className="dash-topbar__status"
            style={{
              color: isAgentActive ? '#3bf7d2' : '#ff4d6d',
              borderColor: isAgentActive ? 'rgba(59,247,210,0.2)' : 'rgba(255,77,109,0.2)',
              background: isAgentActive ? 'rgba(59,247,210,0.04)' : 'rgba(255,77,109,0.04)',
            }}
          >
            <div className="dash-topbar__dot" style={{ background: isAgentActive ? '#3bf7d2' : '#ff4d6d' }} />
            {isAgentActive ? 'AGENT ACTIVE' : isIngesting ? 'INGESTING...' : 'AGENT OFFLINE'}
          </div>
        </div>
      </div>

      <div className="dash-layout" style={{ gridTemplateColumns: '1fr 340px' }}>
        {/* ═══════════════════════════════════════════════
            LEFT COLUMN
           ═══════════════════════════════════════════════ */}
        <div className="dash-main">

          {/* ── Panel 1: Agent Terminal ── */}
          <section
            className="dash-card"
            style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {/* Terminal Header */}
            <div className="trade-terminal__header">
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Terminal size={14} color="#bced62" />
                <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', color: '#bced62' }}>
                  BOND_AGENT_CONSOLE_v2.0
                </span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <div className="trade-terminal__dot" style={{ background: '#ff4d6d' }} />
                <div className="trade-terminal__dot" style={{ background: '#ffb066' }} />
                <div className="trade-terminal__dot" style={{ background: '#3bf7d2' }} />
              </div>
            </div>

            {/* Terminal Body */}
            <div ref={terminalRef} className="trade-terminal__body">
              {logs.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                  System idle. Ingest agent skills to activate autonomous trading...
                </div>
              )}
              {logs.map((log, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ marginBottom: '3px' }}
                >
                  <span className="trade-terminal__timestamp">[{log.time}]</span>{' '}
                  <span
                    className={
                      log.type === 'trade-ok' ? 'trade-terminal__success' :
                      log.type === 'trade-fail' ? 'trade-terminal__fail' :
                      log.type === 'info' ? 'trade-terminal__info' : ''
                    }
                  >
                    {log.text}
                  </span>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── Panel 2: Trade Execution ── */}
          <div className="trade-exec-row">
            {/* Swap Form */}
            <section className="dash-card" style={{ padding: '24px' }}>
              <div className="dash-card__header" style={{ marginBottom: '12px' }}>
                <h3 className="dash-card__title">
                  <ArrowRightLeft size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
                  Agent Trade Execution
                </h3>
                {tradeStatus === 'trading' && <RefreshCw size={14} color="#3bf7d2" className="trade-spin" />}
              </div>

              <div className="dash-trade__form">
                <label className="dash-trade__label">
                  Trade Pair
                  <select
                    className="dash-trade__select"
                    value={selectedPairIdx}
                    onChange={e => setSelectedPairIdx(Number(e.target.value))}
                    disabled={!isAgentActive || tradeStatus === 'trading'}
                  >
                    {TRADE_PAIRS.map((p, i) => (
                      <option key={p.label} value={i}>{p.label}</option>
                    ))}
                  </select>
                </label>

                <label className="dash-trade__label">
                  Amount
                  <div className="dash-trade__input-wrap">
                    <input
                      type="text"
                      className="dash-trade__input"
                      value={tradeAmount}
                      onChange={e => setTradeAmount(e.target.value)}
                      disabled={!isAgentActive || tradeStatus === 'trading'}
                    />
                    <span className="dash-trade__suffix">{TRADE_PAIRS[selectedPairIdx].from}</span>
                  </div>
                </label>

                <button
                  className={`dash-trade__exec ${isAgentActive ? 'dash-trade__exec--green' : ''}`}
                  onClick={executeTrade}
                  disabled={!isAgentActive || tradeStatus === 'trading'}
                  style={{ opacity: isAgentActive ? 1 : 0.4, cursor: isAgentActive ? 'pointer' : 'not-allowed' }}
                >
                  {tradeStatus === 'trading' ? (
                    <>
                      <RefreshCw size={14} className="trade-spin" style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
                      EXECUTING...
                    </>
                  ) : (
                    <>
                      <Zap size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
                      EXECUTE AGENT TRADE
                    </>
                  )}
                </button>

                <div className="dash-trade__hint">
                  <Activity size={14} color="#3bf7d2" />
                  Each trade impacts your credit score: +1 success / −1 failure
                </div>
              </div>
            </section>

            {/* Last Trade Result */}
            <section className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <AnimatePresence mode="wait">
                {trades.length > 0 ? (
                  <motion.div
                    key={trades[0].id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    style={{ width: '100%' }}
                  >
                    <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
                      Last Trade Result
                    </div>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: 800,
                      color: trades[0].status === 'Success' ? '#3bf7d2' : '#ff4d6d',
                      marginBottom: '4px',
                    }}>
                      {trades[0].status === 'Success' ? (
                        <><TrendingUp size={20} style={{ display: 'inline', verticalAlign: '-3px', marginRight: '6px' }} />SUCCESS</>
                      ) : (
                        <><TrendingDown size={20} style={{ display: 'inline', verticalAlign: '-3px', marginRight: '6px' }} />FAILED</>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
                      {trades[0].pair} · {trades[0].amount}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                      <div className={`trade-impact-badge ${trades[0].creditImpact > 0 ? 'trade-impact-badge--positive' : 'trade-impact-badge--negative'}`}>
                        {trades[0].creditImpact > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        CREDIT {trades[0].creditImpact > 0 ? '+1' : '−1'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        TX: {trades[0].txHash}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div style={{ opacity: 0.3 }}>
                    <ArrowRightLeft size={32} style={{ marginBottom: '12px' }} />
                    <p style={{ fontSize: '0.75rem' }}>Execute a trade to see<br />on-chain scoring impact</p>
                  </div>
                )}
              </AnimatePresence>
            </section>
          </div>

          {/* ── Panel 3: Trade History ── */}
          <motion.section
            className="dash-card dash-orders"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="dash-orders__header">
              <div className="dash-orders__tabs">
                <button className="dash-orders__tab active">Trade History</button>
                <button className="dash-orders__tab">Agent Logs</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="trade-stats-pill trade-stats-pill--green">
                  <CheckCircle2 size={10} /> {successCount} Won
                </span>
                <span className="trade-stats-pill trade-stats-pill--red">
                  <XCircle size={10} /> {failCount} Lost
                </span>
                <span className="dash-orders__count">{trades.length} trades</span>
              </div>
            </div>

            <div className="dash-orders__table">
              <div className="trade-history__thead">
                <span>#</span>
                <span>Pair</span>
                <span>Side</span>
                <span>Amount</span>
                <span>Price</span>
                <span>P&L</span>
                <span>Credit</span>
                <span>Status</span>
                <span>Time</span>
              </div>

              {trades.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.8125rem' }}>
                  No trades yet. Activate agent and execute your first trade.
                </div>
              )}

              <AnimatePresence>
                {trades.map((t, i) => (
                  <motion.div
                    key={t.id}
                    className={`trade-history__row ${t.status === 'Success' ? 'trade-history__row--success' : 'trade-history__row--fail'}`}
                    initial={{ opacity: 0, x: -20, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    transition={{ duration: 0.3 }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6875rem' }}>{trades.length - i}</span>
                    <span className="dash-orders__pair">{t.pair}</span>
                    <span style={{ color: t.side === 'Buy' ? '#3bf7d2' : '#ff4d6d', fontWeight: 600 }}>{t.side}</span>
                    <span>{t.amount}</span>
                    <span>{t.price}</span>
                    <span style={{ color: t.pnlValue >= 0 ? '#3bf7d2' : '#ff4d6d', fontWeight: 600 }}>{t.pnl}</span>
                    <span className={`trade-credit-chip ${t.creditImpact > 0 ? 'trade-credit-chip--up' : 'trade-credit-chip--down'}`}>
                      {t.creditImpact > 0 ? '+1' : '−1'}
                    </span>
                    <span className={t.status === 'Success' ? 'dash-orders__status' : ''} style={t.status === 'Failed' ? { color: '#ff4d6d', fontWeight: 600 } : {}}>
                      {t.status}
                    </span>
                    <span className="dash-orders__time">{t.time}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Running Score */}
            {trades.length > 0 && (
              <div className="trade-running-score">
                <span>Running Credit Score:</span>
                <span style={{ color: '#bced62', fontWeight: 800, fontSize: '1rem' }}>{creditScore}</span>
              </div>
            )}
          </motion.section>
        </div>

        {/* ═══════════════════════════════════════════════
            RIGHT SIDEBAR
           ═══════════════════════════════════════════════ */}
        <motion.aside
          className="dash-sidebar"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* ── Ingest Button ── */}
          {!isAgentActive && (
            <button
              className="trade-ingest-btn"
              onClick={ingestSkills}
              disabled={isIngesting}
              style={{ opacity: isIngesting ? 0.6 : 1 }}
            >
              <Zap size={18} fill={isIngesting ? 'transparent' : 'currentColor'} />
              {isIngesting ? 'INGESTING SKILLS...' : 'INGEST AGENT SKILLS'}
            </button>
          )}

          {/* ── Credit Score ── */}
          <section className="dash-card">
            <div className="dash-card__header">
              <h3 className="dash-card__title">Credit Score</h3>
              <div className="dash-credit__badge">
                <ShieldCheck size={12} /> {creditScore >= REWARD_THRESHOLD ? 'UNLOCKED' : 'BUILDING'}
              </div>
            </div>

            {/* Gauge */}
            <div className="dash-gauge" style={{ height: '130px' }}>
              <svg width="170" height="96" viewBox="0 0 170 96">
                <path
                  d="M 15 88 A 70 70 0 0 1 155 88"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <motion.path
                  d="M 15 88 A 70 70 0 0 1 155 88"
                  fill="none"
                  stroke={creditScore >= REWARD_THRESHOLD ? '#bced62' : creditScore > 5 ? '#3bf7d2' : '#ffb066'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={219.9}
                  initial={{ strokeDashoffset: 219.9 }}
                  animate={{ strokeDashoffset: 219.9 - (219.9 * Math.min(creditScore / (REWARD_THRESHOLD + 5), 1)) }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </svg>
              <div className="dash-gauge__value" style={{ bottom: '4px' }}>
                <motion.span
                  key={creditScore}
                  initial={{ scale: 1.3, color: '#fff' }}
                  animate={{ scale: 1, color: creditScore >= REWARD_THRESHOLD ? '#bced62' : '#3bf7d2' }}
                  transition={{ duration: 0.4 }}
                  style={{ fontSize: '2.25rem', fontWeight: 900, lineHeight: 1 }}
                >
                  {creditScore}
                </motion.span>
                <span className="dash-gauge__label" style={{ color: creditScore >= REWARD_THRESHOLD ? '#bced62' : 'rgba(255,255,255,0.5)' }}>
                  / {REWARD_THRESHOLD}
                </span>
              </div>
            </div>

            {/* Reward Progress */}
            <div className="trade-reward-section">
              <div className="trade-reward__header">
                {rewardUnlocked ? <Unlock size={14} color="#bced62" /> : <Lock size={14} color="rgba(255,255,255,0.4)" />}
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: rewardUnlocked ? '#bced62' : 'rgba(255,255,255,0.5)' }}>
                  ${CREDIT_LINE_AMOUNT} Credit Line
                </span>
              </div>

              <div className="trade-reward__track">
                <motion.div
                  className="trade-reward__fill"
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  style={{ background: rewardUnlocked ? 'linear-gradient(90deg, #3bf7d2, #bced62)' : 'linear-gradient(90deg, #3bf7d2, rgba(59,247,210,0.4))' }}
                />
              </div>

              <AnimatePresence mode="wait">
                {rewardUnlocked ? (
                  <motion.div
                    key="unlocked"
                    className={`trade-reward__card ${showCelebration ? 'trade-reward__card--celebrate' : ''}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Trophy size={20} color="#bced62" />
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#bced62' }}>Credit Line Unlocked!</div>
                      <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.5)' }}>${CREDIT_LINE_AMOUNT} available</div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="locked"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.35)', marginTop: '8px', textAlign: 'center' }}
                  >
                    {tradesUntilUnlock > 0
                      ? `${tradesUntilUnlock} more credit points to unlock`
                      : 'Almost there...'}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Credit Factors */}
            <div className="dash-credit__factors" style={{ marginTop: '16px' }}>
              {[
                { icon: <Fingerprint size={12} />, label: 'Identity (KYC/KYB/KYA)', value: isAgentActive ? 'Verified' : 'Pending', active: isAgentActive },
                { icon: <Scale size={12} />, label: 'Reputation (R/R Scoring)', value: isAgentActive ? `${creditScore} pts` : '—', active: creditScore > 0 },
                { icon: <Shield size={12} />, label: 'Compliance (AMLBOT)', value: isAgentActive ? 'Passed' : 'Pending', active: isAgentActive },
                { icon: <Key size={12} />, label: 'Access (Credit Line)', value: rewardUnlocked ? 'Unlocked' : 'Locked', active: rewardUnlocked },
              ].map((f, i) => (
                <div key={i} className="trade-factor-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: f.active ? '#3bf7d2' : 'rgba(255,255,255,0.3)' }}>{f.icon}</span>
                    <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.6)' }}>{f.label}</span>
                  </div>
                  <span style={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    color: f.active ? '#3bf7d2' : 'rgba(255,255,255,0.3)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: f.active ? 'rgba(59,247,210,0.08)' : 'rgba(255,255,255,0.03)',
                  }}>
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Wallet ── */}
          <section className="dash-card">
            <div className="dash-card__header">
              <h3 className="dash-card__title">Onchain OS Wallet</h3>
              <Wallet size={14} color="var(--bondcredit-s2)" />
            </div>
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '4px' }}>Agentic Wallet</div>
              <div style={{ fontSize: '0.8125rem', fontFamily: 'monospace', color: '#bced62', marginBottom: '16px' }}>0x7b2F...c9f29E</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { symbol: 'ETH', balance: walletBalances.ETH },
                  { symbol: 'USDC', balance: walletBalances.USDC },
                  { symbol: 'XLYR', balance: walletBalances.XLYR },
                ].map(token => (
                  <div key={token.symbol} className="trade-wallet-token">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="trade-wallet-token__icon">{token.symbol.charAt(0)}</div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{token.symbol}</span>
                    </div>
                    <motion.span
                      key={token.balance}
                      initial={{ color: '#fff' }}
                      animate={{ color: 'rgba(255,255,255,0.9)' }}
                      style={{ fontSize: '0.75rem', fontWeight: 700 }}
                    >
                      {typeof token.balance === 'number' ? token.balance.toLocaleString('en-US', { maximumFractionDigits: 2 }) : token.balance}
                    </motion.span>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent Capabilities */}
            <div className="trade-capabilities">
              {['Swap', 'Price Data', 'x402 Payments', 'DEX Trade'].map(cap => (
                <div key={cap} className="trade-capability">
                  <CheckCircle2 size={10} color="#3bf7d2" />
                  <span>{cap}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Quick Stats ── */}
          <section className="dash-card">
            <h3 className="dash-card__title" style={{ marginBottom: '12px' }}>Session Stats</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Total Trades', value: trades.length.toString() },
                { label: 'Win Rate', value: trades.length > 0 ? `${Math.round((successCount / trades.length) * 100)}%` : '—' },
                { label: 'Credit Score', value: creditScore.toString() },
                { label: 'Reward Status', value: rewardUnlocked ? '✅ Unlocked' : '🔒 Locked' },
              ].map((stat, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.5)' }}>{stat.label}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--bondcredit-white)' }}>{stat.value}</span>
                </div>
              ))}
            </div>
          </section>
        </motion.aside>
      </div>
    </main>
  );
};

export default TradePage;
