import React, { useState } from 'react';
import { useBondCredit } from '../context/BondCreditContext';
import type { SubscriptionStatus } from '../../../src/index';
import MachineReadableSection from '../components/MachineReadableSection';

const SubscribePage: React.FC = () => {
  const { client, cfg, setCfg, log, appendLog } = useBondCredit();
  const [duration, setDuration] = useState('30 days');
  const [autoRenew, setAutoRenew] = useState(true);
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);

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

  const skillSnippet = `# Enrollment: Enroll Agent Identity
POST /enroll
{
  "agentId": "string",
  "email": "agent@domain.com",
  "walletAddress": "0x..."
}

# Subscription: Check Monitoring Status
POST /subscription/status
{
  "agentId": "string"
}`;

  return (
    <main className="wt-container" style={{ marginTop: '88px', maxWidth: '900px' }}>
    <div className="bc-stack">
      <section className="bc-card">
        <h2>Agent Configuration</h2>
        <label>
          Network
          <select
            value={cfg.network}
            onChange={e => setCfg(prev => ({ ...prev, network: e.target.value as any }))}
          >
            <option value="xlayer-testnet">xlayer-testnet</option>
            <option value="xlayer-mainnet">xlayer-mainnet</option>
          </select>
        </label>
        <label>
          Agent ID
          <input value={cfg.agentId} onChange={e => setCfg(prev => ({ ...prev, agentId: e.target.value }))} />
        </label>
      </section>

      <section className="bc-card">
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
      </section>

      <div className="bc-console bc-card">
        <h2>Console</h2>
        <pre className="bc-pre bc-preConsole">{log || 'No events yet.'}</pre>
      </div>

      <MachineReadableSection 
        title="Machine Readable"
        description="This page exposes enrollment and subscription capabilities for Agents."
        codeSnippet={skillSnippet}
      />
    </div>
    </main>
  );
};

export default SubscribePage;
