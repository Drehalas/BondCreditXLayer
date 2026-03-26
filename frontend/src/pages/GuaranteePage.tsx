import React, { useState } from 'react';
import { useBondCredit } from '../context/BondCreditContext';
import type { X402GuaranteeResponse, X402GuaranteeStatus } from '../../../src/index';
import MachineReadableSection from '../components/MachineReadableSection';

const GuaranteePage: React.FC = () => {
  const { client, log, appendLog } = useBondCredit();
  const [x402Input, setX402Input] = useState({
    recipient: '0xDataOracle...',
    amount: '0.01 OKB',
    service: 'premium-price-feed',
    endpoint: 'https://api.data.com/x402'
  });
  const [guarantee, setGuarantee] = useState<X402GuaranteeResponse | null>(null);
  const [guaranteeStatus, setGuaranteeStatus] = useState<X402GuaranteeStatus | null>(null);

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
    const status = await client.x402.checkGuarantee(guarantee.guaranteeId);
    setGuaranteeStatus(status);
  }

  return (
    <main className="wt-container" style={{ marginTop: '88px', maxWidth: '900px' }}>
    <div className="bc-stack">
      <section className="bc-card">
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
      </section>

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

      <div className="bc-console bc-card">
        <h2>Console</h2>
        <pre className="bc-pre bc-preConsole">{log || 'No events yet.'}</pre>
      </div>

      <MachineReadableSection 
        title="Machine Readable"
        description="This page exposes credit guarantee issuance capabilities for Agents."
        codeSnippet={`# Guarantee: Issue Credit Guarantee
POST /guarantee
{
  "agentId": "string",
  "amount": 0.1
}`}
      />
    </div>
    </main>
  );
};

export default GuaranteePage;
