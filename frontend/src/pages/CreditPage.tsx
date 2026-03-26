import React, { useState } from 'react';
import { useBondCredit } from '../context/BondCreditContext';
import type { CreditApproval, CreditLimit, Eligibility, CreditScore } from '../../../src/index';
import MachineReadableSection from '../components/MachineReadableSection';

const CreditPage: React.FC = () => {
  const { client, log, appendLog } = useBondCredit();
  const [score, setScore] = useState<CreditScore | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [limit, setLimit] = useState<CreditLimit | null>(null);
  const [creditApproval, setCreditApproval] = useState<CreditApproval | null>(null);
  const [repayResult, setRepayResult] = useState<any | null>(null);
  const [creditRequestInput, setCreditRequestInput] = useState({ amount: '0.1 OKB', purpose: 'arbitrage', expectedReturn: '0.05 OKB' });
  const [repayInput, setRepayInput] = useState({ creditId: 'cred_...', amount: '0.1005 OKB' });

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

  return (
    <main className="wt-container" style={{ marginTop: '88px', maxWidth: '900px' }}>
    <div className="bc-stack">
      <section className="bc-card">
        <h2>Credit Dashboard</h2>
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
      </section>

      <section className="bc-card">
        <h2>Results</h2>
        <pre className="bc-pre">{JSON.stringify({ score, eligibility, limit, creditApproval, repayResult }, null, 2)}</pre>
      </section>

      <section className="bc-card">
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
      </section>

      <div className="bc-console bc-card">
        <h2>Console</h2>
        <pre className="bc-pre bc-preConsole">{log || 'No events yet.'}</pre>
      </div>

      <MachineReadableSection 
        title="Machine Readable"
        description="This page exposes autonomous credit application and repayment capabilities for Agents."
        codeSnippet={`# Apply: Autonomous Credit Application
POST /credit/apply
{
  "agentId": "string",
  "amount": 0.1,
  "recipient": "0x...",
  "purpose": "arbitrage"
}

# Rewards: Repay and Grow
POST /credit/repay
{
  "agentId": "string",
  "creditId": "cred_xxx",
  "amount": 0.0105
}`}
      />
    </div>
    </main>
  );
};

export default CreditPage;
