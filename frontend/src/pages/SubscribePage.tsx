import React, { useState } from 'react';
import { useBondCredit } from '../context/BondCreditContext';
import type { SubscriptionStatus } from '../../../src/index';
import MachineReadableSection from '../components/MachineReadableSection';

const SubscribePage: React.FC = () => {
  const { log, appendLog } = useBondCredit();
  const [duration, setDuration] = useState('30 days');
  const [autoRenew, setAutoRenew] = useState(true);
  const [walletAddress, setWalletAddress] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [renewBusy, setRenewBusy] = useState(false);
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [apiError, setApiError] = useState('');

  const apiBase = import.meta.env.VITE_BONDCREDIT_API_BASE_URL ?? 'http://localhost:3000';

  async function postJson(path: string, body: Record<string, unknown>) {
    const response = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const message = typeof json?.error === 'string' ? json.error : `Request failed (${response.status})`;
      throw new Error(message);
    }

    return json;
  }

  async function handleManualSubscribe() {
    try {
      setApiError('');
      setManualBusy(true);
      if (!walletAddress) {
        throw new Error('Enter wallet address before subscribe.');
      }

      const res = await postJson('/subscription/subscribe', {
        agentId: walletAddress,
        duration,
        autoRenew,
      });
      appendLog(`subscription.subscribe.backend(): ${JSON.stringify(res, null, 2)}`);
      // No automatic status check here
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Subscribe failed';
      setApiError(message);
      appendLog(`subscription.subscribe.backend.error(): ${message}`);
    } finally {
      setManualBusy(false);
    }
  }

  async function handleCheckStatus() {
    try {
      setApiError('');
      if (!walletAddress) {
        throw new Error('Enter wallet address before checking status.');
      }

      const res = await postJson('/subscription/status', { agentId: walletAddress });
      setSubStatus((res?.subscription as SubscriptionStatus) ?? null);
      appendLog(`subscription.status.backend(): ${JSON.stringify(res, null, 2)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Check status failed';
      setApiError(message);
      appendLog(`subscription.status.error(): ${message}`);
    }
  }

  async function handleRenew() {
    try {
      setApiError('');
      setRenewBusy(true);
      if (!walletAddress) {
        throw new Error('Enter wallet address before renew.');
      }

      const res = await postJson('/subscription/renew', { agentId: walletAddress });
      appendLog(`subscription.renew.backend(): ${JSON.stringify(res, null, 2)}`);
      await handleCheckStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Renew failed';
      setApiError(message);
      appendLog(`subscription.renew.backend.error(): ${message}`);
    } finally {
      setRenewBusy(false);
    }
  }

  const skillSnippet = `# UI Flow: Backend Subscription API
# 1) Enter wallet address
# 2) Call backend /subscription/subscribe or /subscription/renew
# 3) Read status via backend /subscription/status`;

  return (
    <main className="wt-container" style={{ marginTop: '88px', maxWidth: '900px' }}>
    <div className="bc-stack">
      <section className="bc-card">
        <h2>Subscription</h2>
        <div className="bc-grid2">
          <label>
            Wallet Address
            <input
              value={walletAddress}
              onChange={e => setWalletAddress(e.target.value.trim())}
              placeholder="0x..."
            />
          </label>
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
          <button className="bc-btn bc-btnPrimary" onClick={handleManualSubscribe} disabled={manualBusy || !walletAddress}>
            {manualBusy ? 'Submitting...' : 'Subscribe'}
          </button>
          {/* <button className="bc-btn" onClick={handleCheckStatus}>Check status</button> */}
          {/* <button className="bc-btn" onClick={handleRenew} disabled={renewBusy || !walletAddress}>
            {renewBusy ? 'Renewing...' : 'Renew'}
          </button> */}
        </div>
        {!!apiError && <p style={{ marginTop: '10px', color: '#ff7d7d' }}>{apiError}</p>}
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
