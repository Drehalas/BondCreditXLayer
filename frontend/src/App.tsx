import { useMemo, useState } from 'react';
import { BondCreditClient } from '../../src/index';
import type { BondCreditClientConfig } from '../../src/index';
import type {
  CreditApproval,
  CreditHistory,
  CreditLimit,
  Eligibility,
  X402GuaranteeResponse,
  X402GuaranteeStatus,
  AnalyticsMonitorUpdate,
  AnalyticsReport,
  CreditHealth,
  SubscriptionStatus,
  CreditScore
} from '../../src/index';
import './styles/app.css';
import BondCreditHeader from './components/BondCreditHeader';
import BondCreditTicker from './components/BondCreditTicker';
import BondCreditFooter from './components/BondCreditFooter';
import { RegisterAgent } from './components/RegisterAgent';
import { AnimatePresence } from 'framer-motion';

type TabKey = 'subscribe' | 'x402' | 'credit' | 'analytics';

function initialClientConfig(): Omit<BondCreditClientConfig, never> {
  return {
    network: 'xlayer-testnet',
    agentId: 'agent-0x123...',
    privateKey: ''
  };
}

export default function App() {
  const [tab, setTab] = useState<TabKey>('subscribe');
  const [showRegister, setShowRegister] = useState(false);

  const [cfg, setCfg] = useState(() => initialClientConfig());

  const client = useMemo(() => {
    const config: BondCreditClientConfig = {
      network: cfg.network,
      agentId: cfg.agentId,
      privateKey: cfg.privateKey || undefined
    };
    return new BondCreditClient(config);
  }, [cfg.agentId, cfg.network, cfg.privateKey]);

  // Shared status output for quick feedback.
  const [log, setLog] = useState<string>('');
  const appendLog = (s: unknown) => setLog(prev => (prev ? `${prev}\n${String(s)}` : String(s)));

  // Subscription
  const [duration, setDuration] = useState('30 days');
  const [autoRenew, setAutoRenew] = useState(true);
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);

  // x402
  const [x402Input, setX402Input] = useState({
    recipient: '0xDataOracle...',
    amount: '0.01 OKB',
    service: 'premium-price-feed',
    endpoint: 'https://api.data.com/x402'
  });
  const [guarantee, setGuarantee] = useState<X402GuaranteeResponse | null>(null);
  const [guaranteeStatus, setGuaranteeStatus] = useState<X402GuaranteeStatus | null>(null);

  // Credit
  const [score, setScore] = useState<CreditScore | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [limit, setLimit] = useState<CreditLimit | null>(null);
  const [creditApproval, setCreditApproval] = useState<CreditApproval | null>(null);
  const [repayResult, setRepayResult] = useState<any | null>(null);
  const [creditRequestInput, setCreditRequestInput] = useState({ amount: '0.1 OKB', purpose: 'arbitrage', expectedReturn: '0.05 OKB' });
  const [repayInput, setRepayInput] = useState({ creditId: 'cred_...', amount: '0.1005 OKB' });

  // Analytics
  const [health, setHealth] = useState<CreditHealth | null>(null);
  const [history, setHistory] = useState<CreditHistory | null>(null);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [monitoring, setMonitoring] = useState(false);

  const [stop, setStop] = useState<(() => void) | null>(null);

  async function handleSubscribe() {
    const res = await client.subscription.subscribe({ duration, autoRenew });
    appendLog(`subscribe(): ${JSON.stringify(res, null, 2)}`);
  }

  async function handleCheckStatus() {
    const res = await client.subscription.checkStatus();
    setSubStatus(res);
    appendLog(`checkStatus(): ${JSON.stringify(res, null, 2)}`);
  }

  async function handleRenew() {
    const res = await client.subscription.renew();
    appendLog(`renew(): ${JSON.stringify(res, null, 2)}`);
  }

  async function handleGuarantee() {
    const res = await client.x402.guaranteePayment(x402Input);
    setGuarantee(res);
    appendLog(`guaranteePayment(): ${JSON.stringify(res, null, 2)}`);
  }

  async function handleCheckGuarantee() {
    if (!guarantee) return;
    const res = await client.x402.checkGuarantee(guarantee.guaranteeId);
    setGuaranteeStatus(res);
    appendLog(`checkGuarantee(): ${JSON.stringify(res, null, 2)}`);
  }

  async function handleCancelGuarantee() {
    if (!guarantee) return;
    await client.x402.cancelGuarantee(guarantee.guaranteeId);
    appendLog(`cancelGuarantee(): ok`);
    setGuaranteeStatus(await client.x402.checkGuarantee(guarantee.guaranteeId));
  }

  async function handleGetScore() {
    const res = await client.credit.getScore();
    setScore(res);
    appendLog(`getScore(): ${JSON.stringify(res, null, 2)}`);
  }

  async function handleCheckEligibility() {
    const res = await client.credit.checkEligibility(creditRequestInput.amount);
    setEligibility(res);
    appendLog(`checkEligibility(): ${JSON.stringify(res, null, 2)}`);
  }

  async function handleGetLimit() {
    const res = await client.credit.getLimit();
    setLimit(res);
    appendLog(`getLimit(): ${JSON.stringify(res, null, 2)}`);
  }

  async function handleCreditRequest() {
    const res = await client.credit.request(creditRequestInput);
    setCreditApproval(res);
    appendLog(`request(): ${JSON.stringify(res, null, 2)}`);
    if (res.approved && res.creditId) {
      setRepayInput(prev => ({ ...prev, creditId: res.creditId! }));
    }
  }

  async function handleRepay() {
    const res = await client.credit.repay(repayInput);
    setRepayResult(res);
    appendLog(`repay(): ${JSON.stringify(res, null, 2)}`);
  }

  async function handleAnalyticsHealth() {
    const res = await client.analytics.getHealth();
    setHealth(res);
    appendLog(`getHealth(): ${JSON.stringify(res, null, 2)}`);
  }

  async function handleAnalyticsHistory() {
    const res = await client.analytics.getHistory('7d');
    setHistory(res);
    appendLog(`getHistory('7d'): ${JSON.stringify(res, null, 2)}`);
  }

  async function handleAnalyticsReport() {
    const res = await client.analytics.generateReport();
    setReport(res);
    appendLog(`generateReport(): ${JSON.stringify(res, null, 2)}`);
  }

  async function handleAnalyticsMonitorToggle() {
    if (monitoring) {
      stop?.();
      setMonitoring(false);
      appendLog(`monitor(): stopped`);
      return;
    }

    setMonitoring(true);
    const stopFn = await client.analytics.monitor((update: AnalyticsMonitorUpdate) => {
      appendLog(`monitor(): ${update.type} - ${update.message}`);
    });
    setStop(() => stopFn);
  }

  return (
    <div className="bc-root">
      <BondCreditHeader
        connected={true}
        onRegisterClick={() => setShowRegister(true)}
      />

      <BondCreditTicker />

      <AnimatePresence mode="wait">
        {showRegister ? (
          <RegisterAgent key="register" onBack={() => setShowRegister(false)} />
        ) : (
          <main className="bc-layout wt-container" key="dashboard" style={{ marginTop: '88px' }}>
            <aside className="bc-sidebar">
              <section className="bc-card">
                <h2>Agent</h2>
                <label>
                  Network
                  <select
                    value={cfg.network}
                    onChange={e => setCfg(prev => ({ ...prev, network: e.target.value as BondCreditClientConfig['network'] }))}
                  >
                    <option value="xlayer-testnet">xlayer-testnet</option>
                    <option value="xlayer-mainnet">xlayer-mainnet</option>
                  </select>
                </label>
                <label>
                  Agent ID
                  <input value={cfg.agentId} onChange={e => setCfg(prev => ({ ...prev, agentId: e.target.value }))} />
                </label>
                <label>
                  Private Key (unused in scaffold)
                  <input
                    value={cfg.privateKey}
                    onChange={e => setCfg(prev => ({ ...prev, privateKey: e.target.value }))}
                    placeholder="optional"
                  />
                </label>
                <div className="bc-pill">Client is created from SDK `BondCreditClient`</div>
              </section>

              <section className="bc-card bc-tabs">
                <div className="bc-tabsRow">
                  {([
                    ['subscribe', 'Subscribe'],
                    ['x402', 'Guarantee (x402)'],
                    ['credit', 'Credit'],
                    ['analytics', 'Analytics']
                  ] as Array<[TabKey, string]>).map(([k, label]) => (
                    <button
                      key={k}
                      className={k === tab ? 'bc-tab bc-tabActive' : 'bc-tab'}
                      onClick={() => setTab(k)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>
            </aside>

            <section className="bc-main">
              {tab === 'subscribe' && (
                <div className="bc-stack">
                  <div className="bc-card">
                    <h2>Subscription</h2>
                    <div className="bc-grid2">
                      <label>
                        Duration
                        <input value={duration} onChange={e => setDuration(e.target.value)} />
                      </label>
                      <label className="bc-check">
                        <input type="checkbox" checked={autoRenew} onChange={e => setAutoRenew(e.target.checked)} />
                        Auto-renew
                      </label>
                    </div>
                    <div className="bc-actions">
                      <button className="bc-btn bc-btnPrimary" onClick={handleSubscribe}>Subscribe</button>
                      <button className="bc-btn" onClick={handleCheckStatus}>Check status</button>
                      <button className="bc-btn" onClick={handleRenew}>Renew</button>
                    </div>
                    {subStatus && (
                      <pre className="bc-pre">{JSON.stringify(subStatus, null, 2)}</pre>
                    )}
                  </div>
                </div>
              )}

              {tab === 'x402' && (
                <div className="bc-stack">
                  <div className="bc-card">
                    <h2>x402 Guarantee</h2>
                    <div className="bc-grid2">
                      <label>
                        Recipient
                        <input value={x402Input.recipient} onChange={e => setX402Input(prev => ({ ...prev, recipient: e.target.value }))} />
                      </label>
                      <label>
                        Amount
                        <input value={x402Input.amount} onChange={e => setX402Input(prev => ({ ...prev, amount: e.target.value }))} />
                      </label>
                      <label>
                        Service
                        <input value={x402Input.service} onChange={e => setX402Input(prev => ({ ...prev, service: e.target.value }))} />
                      </label>
                      <label>
                        Endpoint
                        <input value={x402Input.endpoint} onChange={e => setX402Input(prev => ({ ...prev, endpoint: e.target.value }))} />
                      </label>
                    </div>
                    <div className="bc-actions">
                      <button className="bc-btn bc-btnPrimary" onClick={handleGuarantee}>Guarantee</button>
                      <button className="bc-btn" onClick={handleCheckGuarantee} disabled={!guarantee}>Check</button>
                      <button className="bc-btn" onClick={handleCancelGuarantee} disabled={!guarantee}>Cancel</button>
                    </div>
                  </div>

                  {guarantee && (
                    <div className="bc-card">
                      <h2>Guarantee Payload</h2>
                      <pre className="bc-pre">{JSON.stringify(guarantee, null, 2)}</pre>
                      {guaranteeStatus && (
                        <>
                          <div className="bc-divider" />
                          <h2>Guarantee Status</h2>
                          <pre className="bc-pre">{JSON.stringify(guaranteeStatus, null, 2)}</pre>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {tab === 'credit' && (
                <div className="bc-stack">
                  <div className="bc-card">
                    <h2>Credit</h2>
                    <div className="bc-actions">
                      <button className="bc-btn bc-btnPrimary" onClick={handleGetScore}>Get score</button>
                      <button className="bc-btn" onClick={handleCheckEligibility}>Check eligibility</button>
                      <button className="bc-btn" onClick={handleGetLimit}>Get limit</button>
                    </div>
                    <div className="bc-grid2 bc-mt12">
                      <label>
                        Amount
                        <input value={creditRequestInput.amount} onChange={e => setCreditRequestInput(prev => ({ ...prev, amount: e.target.value }))} />
                      </label>
                      <label>
                        Purpose
                        <input value={creditRequestInput.purpose} onChange={e => setCreditRequestInput(prev => ({ ...prev, purpose: e.target.value }))} />
                      </label>
                      <label>
                        Expected return
                        <input value={creditRequestInput.expectedReturn} onChange={e => setCreditRequestInput(prev => ({ ...prev, expectedReturn: e.target.value }))} />
                      </label>
                    </div>
                    <div className="bc-actions bc-mt12">
                      <button className="bc-btn bc-btnPrimary" onClick={handleCreditRequest}>Request credit</button>
                    </div>
                  </div>

                  <div className="bc-card">
                    <h2>Results</h2>
                    <pre className="bc-pre">{JSON.stringify({ score, eligibility, limit, creditApproval, repayResult }, null, 2)}</pre>
                  </div>

                  <div className="bc-card">
                    <h2>Repay</h2>
                    <div className="bc-grid2">
                      <label>
                        Credit ID
                        <input value={repayInput.creditId} onChange={e => setRepayInput(prev => ({ ...prev, creditId: e.target.value }))} />
                      </label>
                      <label>
                        Amount
                        <input value={repayInput.amount} onChange={e => setRepayInput(prev => ({ ...prev, amount: e.target.value }))} />
                      </label>
                    </div>
                    <div className="bc-actions bc-mt12">
                      <button className="bc-btn bc-btnPrimary" onClick={handleRepay}>Repay</button>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'analytics' && (
                <div className="bc-stack">
                  <div className="bc-card">
                    <h2>Analytics</h2>
                    <div className="bc-actions">
                      <button className="bc-btn bc-btnPrimary" onClick={handleAnalyticsHealth}>Get health</button>
                      <button className="bc-btn" onClick={handleAnalyticsHistory}>History (7d)</button>
                      <button className="bc-btn" onClick={handleAnalyticsReport}>Report</button>
                      <button className={monitoring ? 'bc-btn bc-btnDanger' : 'bc-btn'} onClick={handleAnalyticsMonitorToggle}>
                        {monitoring ? 'Stop monitor' : 'Start monitor'}
                      </button>
                    </div>
                    <div className="bc-divider" />
                    <pre className="bc-pre">{JSON.stringify({ health, history, report }, null, 2)}</pre>
                  </div>
                </div>
              )}

              <div className="bc-console bc-card">
                <h2>Console</h2>
                <pre className="bc-pre bc-preConsole">{log || 'No events yet.'}</pre>
              </div>
            </section>
          </main>
        )}
      </AnimatePresence>

      <BondCreditFooter />
    </div>
  );
}

