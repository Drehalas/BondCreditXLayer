import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, BarChart3, Repeat, Shield, ArrowDownLeft, ArrowUpRight, Star } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   MOCK DATA — will be replaced with live API data later
   ═══════════════════════════════════════════════════════════════ */

const CREDIT_SCORE = 712;

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

const TRADE_HISTORY = [
  { pair: 'ETH/USDC', side: 'Buy', type: 'Market', amount: '0.5 ETH', price: '$2,012.40', time: '2 min ago', status: 'Filled', pnl: '+$24.50' },
  { pair: 'OKB/USDT', side: 'Long', type: 'Limit', amount: '120 OKB', price: '$50.12', time: '18 min ago', status: 'Filled', pnl: '+$86.40' },
  { pair: 'USDC/USDT', side: 'Sell', type: 'Swap', amount: '1,200 USDC', price: '$1.0001', time: '45 min ago', status: 'Filled', pnl: '+$0.12' },
  { pair: 'ETH/USDC', side: 'Short', type: 'Limit', amount: '0.3 ETH', price: '$2,045.80', time: '2 hrs ago', status: 'Filled', pnl: '-$12.30' },
  { pair: 'OKB/USDT', side: 'Buy', type: 'Market', amount: '65 OKB', price: '$49.88', time: '5 hrs ago', status: 'Filled', pnl: '+$33.15' },
];

const TX_HISTORY = [
  { type: 'receive', label: 'Funds received', asset: '0.0124 BTC', time: '2 min ago' },
  { type: 'send', label: 'Withdraw funds', asset: '-$300.00', time: '18 min ago' },
  { type: 'fee', label: 'Transaction Fee', asset: '-$0.50', time: '45 min ago' },
  { type: 'receive', label: 'Funds received', asset: '0.0124 ETH', time: '1 hr ago' },
  { type: 'send', label: 'Withdraw funds', asset: '-$150.00', time: '3 hrs ago' },
  { type: 'credit', label: 'Credit Score +3', asset: '+3 pts', time: '5 hrs ago' },
];

const PAIRS = ['ETH/USDC', 'OKB/USDT', 'USDC/USDT', 'ETH/OKB', 'BTC/USDC'];

/* ═══════════════════════════════════════════════════════════════
   Mini SVG Sparkline
   ═══════════════════════════════════════════════════════════════ */
const Sparkline: React.FC<{ data: number[]; color: string; width?: number; height?: number }> = ({
  data, color, width = 80, height = 32
}) => {
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
        <linearGradient id={`spark-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-${color.replace(/[^a-z0-9]/gi, '')})`} />
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
const TradingDashboardPage: React.FC = () => {
  const [tradeTab, setTradeTab] = useState<'buy' | 'sell' | 'long' | 'short' | 'deposit'>('buy');
  const [selectedPair, setSelectedPair] = useState('ETH/USDC');
  const [tradeAmount, setTradeAmount] = useState('');
  const [chartPeriod, setChartPeriod] = useState<'1W' | '1M' | '3M' | '1Y'>('1M');

  const totalUsd = WALLET_TOKENS.reduce((sum, t) => sum + parseFloat(t.usd.replace(/[$,]/g, '')), 0);

  const sideColors: Record<string, string> = {
    Buy: '#3bf7d2',
    Sell: '#ff4d6d',
    Long: '#bced62',
    Short: '#ff8c42',
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
            XLayer Testnet
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
                  +12 pts
                </div>
              </div>
              <ScoreGauge score={CREDIT_SCORE} />
              <div className="dash-credit__factors">
                {[
                  { label: 'Trade Consistency', val: 85 },
                  { label: 'Settlement History', val: 92 },
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
                  <select value={selectedPair} onChange={e => setSelectedPair(e.target.value)} className="dash-trade__select">
                    {PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
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
                  <button className="dash-trade__exec dash-trade__exec--green">
                    Deposit {tradeAmount || ''} {tradeAmount ? selectedPair.split('/')[0] : ''}
                  </button>
                ) : (
                  <button className={`dash-trade__exec ${tradeTab === 'buy' || tradeTab === 'long' ? 'dash-trade__exec--green' : 'dash-trade__exec--red'}`}>
                    {tradeTab === 'buy' && `Buy ${selectedPair.split('/')[0]}`}
                    {tradeTab === 'sell' && `Sell ${selectedPair.split('/')[0]}`}
                    {tradeTab === 'long' && `Long ${selectedPair.split('/')[0]}`}
                    {tradeTab === 'short' && `Short ${selectedPair.split('/')[0]}`}
                  </button>
                )}

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
                <button className="dash-orders__tab active">Active Orders</button>
                <button className="dash-orders__tab">Filled Orders</button>
                <button className="dash-orders__tab">My Trades</button>
              </div>
              <span className="dash-orders__count">{TRADE_HISTORY.length} trades</span>
            </div>
            <div className="dash-orders__table">
              <div className="dash-orders__thead">
                <span>Pair</span><span>Side</span><span>Type</span><span>Amount</span><span>Price</span><span>Time</span><span>Status</span><span>P&L</span>
              </div>
              {TRADE_HISTORY.map((t, i) => (
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
