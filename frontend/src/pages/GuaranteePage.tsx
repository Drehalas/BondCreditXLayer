import React, { useState } from 'react';
import { useBondCredit } from '../context/BondCreditContext';
import MachineReadableSection from '../components/MachineReadableSection';

const GuaranteePage: React.FC = () => {
  const { log, appendLog } = useBondCredit();
  const apiBase = import.meta.env.VITE_BONDCREDIT_API_BASE_URL ?? 'http://localhost:3000';

  const [x402Input, setX402Input] = useState({
    agentId: 'agent-0x123...',
    recipient: '0xDataOracle...',
    amount: '0.01',
    service: 'premium-price-feed',
    endpoint: 'https://api.data.com/x402',
    purpose: 'Guarantee tab request',
  });
  const [manualBusy, setManualBusy] = useState(false);
  const [guarantee, setGuarantee] = useState<Record<string, unknown> | null>(null);
  const [apiError, setApiError] = useState('');

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

  async function handleGuaranteeWalletSigned() {
    try {
      setApiError('');
      setManualBusy(true);
      const parsedAmount = Number(x402Input.amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Amount must be a positive number');
      }

      const res = await postJson('/guarantee', {
        agentId: x402Input.agentId,
        recipient: x402Input.recipient,
        amount: parsedAmount,
        service: x402Input.service,
        endpoint: x402Input.endpoint,
        purpose: x402Input.purpose,
      });

      setGuarantee(res as Record<string, unknown>);
      appendLog(`guarantee.backend(): ${JSON.stringify(res, null, 2)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Guarantee failed';
      setApiError(message);
      appendLog(`guarantee.backend.error(): ${message}`);
    } finally {
      setManualBusy(false);
    }
  }

  return (
    <main className="wt-container" style={{ marginTop: '88px', maxWidth: '900px' }}>
    <div className="bc-stack">
      <section className="bc-card">
        <h2>x402 Guarantee</h2>
        <div className="bc-grid2">
          <label>
            Agent ID
            <input
              value={x402Input.agentId}
              onChange={e => setX402Input(prev => ({ ...prev, agentId: e.target.value }))}
              placeholder="agent-... or 0x..."
            />
          </label>
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
          <label>
            Purpose
            <input value={x402Input.purpose} onChange={e => setX402Input(prev => ({ ...prev, purpose: e.target.value }))} />
          </label>
        </div>
        <div className="bc-actions">
          <button className="bc-btn bc-btnPrimary" onClick={handleGuaranteeWalletSigned} disabled={manualBusy || !x402Input.agentId}>
            {manualBusy ? 'Submitting...' : 'Guarantee'}
          </button>
        </div>
        {!!apiError && <p style={{ marginTop: '10px', color: '#ff7d7d' }}>{apiError}</p>}
      </section>

      {guarantee && (
        <div className="bc-card">
          <h2>Guarantee Response</h2>
          <pre className="bc-pre">{JSON.stringify(guarantee, null, 2)}</pre>
        </div>
      )}

      <div className="bc-console bc-card">
        <h2>Console</h2>
        <pre className="bc-pre bc-preConsole">{log || 'No events yet.'}</pre>
      </div>

      <MachineReadableSection 
        title="Machine Readable"
        description="This page issues guarantees via backend API."
        codeSnippet={`# Guarantee: Issue Credit Guarantee
POST /guarantee
{
  "agentId": "string",
  "recipient": "0x...",
  "amount": 0.1,
  "service": "premium-price-feed",
  "endpoint": "https://api.data.com/x402",
  "purpose": "Guarantee tab request"
}`}
      />
    </div>
    </main>
  );
};

export default GuaranteePage;
