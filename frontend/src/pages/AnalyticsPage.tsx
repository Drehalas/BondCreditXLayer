import React, { useState } from 'react';
import { useBondCredit } from '../context/BondCreditContext';
import type { CreditHealth, CreditHistory, AnalyticsReport, AnalyticsMonitorUpdate } from '../../../src/index';
import MachineReadableSection from '../components/MachineReadableSection';

const AnalyticsPage: React.FC = () => {
  const { client, log, appendLog } = useBondCredit();
  const [health, setHealth] = useState<CreditHealth | null>(null);
  const [history, setHistory] = useState<CreditHistory | null>(null);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [monitoring, setMonitoring] = useState(false);
  const [stop, setStop] = useState<(() => void) | null>(null);

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
    <main className="wt-container" style={{ marginTop: '88px', maxWidth: '900px' }}>
    <div className="bc-stack">
      <section className="bc-card">
        <h2>Analytics Dashboard</h2>
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
      </section>

      <div className="bc-console bc-card">
        <h2>Console</h2>
        <pre className="bc-pre bc-preConsole">{log || 'No events yet.'}</pre>
      </div>

      <MachineReadableSection 
        title="Machine Readable"
        description="This page exposes analytics, risk Assessment, and vault rebalancing capabilities for Agents."
        codeSnippet={`# Analytics: Get Volatility
GET /volatility {}

# Risk: Assess Risk Score
POST /risk-score
{ "agentId": "string" }

# Vault: Rebalance Vault
POST /rebalance
{ "vaultId": "string" }`}
      />
    </div>
    </main>
  );
};

export default AnalyticsPage;
