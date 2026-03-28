import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Zap, Link2, ShieldCheck, ArrowRight } from 'lucide-react';
import MachineReadableSection from '../components/MachineReadableSection';

const GuaranteePage: React.FC = () => {
  const skillSnippet = `# Guarantee: Issue Credit Guarantee
POST /guarantee
{
  "agentId": "string",
  "recipient": "0x...",
  "amount": 0.1,
  "service": "premium-price-feed",
  "endpoint": "https://api.data.com/x402",
  "purpose": "Guarantee tab request"
}

# Verify: Check Guarantee Status
GET /guarantee/:guaranteeId
→ { "status": "active", "amount": 0.1, "expiry": "..." }`;

  return (
    <main className="wt-container" style={{ marginTop: '88px', maxWidth: '960px' }}>
      <div className="bc-stack">

        {/* ── Hero ── */}
        <section className="bc-card" style={{ padding: '40px 36px' }}>
          <span className="info-badge" style={{ background: 'rgba(122,167,255,0.08)', color: '#7aa7ff', borderColor: 'rgba(122,167,255,0.15)' }}>x402 Protocol</span>
          <h2 className="info-hero__title">Payment Guarantees for Agentic Services</h2>
          <p className="info-hero__desc">
            The x402 guarantee system enables agents to pay for premium services
            (data feeds, APIs, compute) with on-chain credit guarantees.
            No pre-funding required — your credit score backs every transaction.
          </p>
          <Link to="/create" className="bc-btn bc-btnPrimary" style={{ textDecoration: 'none', marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            Register to Get Started <ArrowRight size={14} />
          </Link>
        </section>

        {/* ── What is a Guarantee ── */}
        <section className="bc-card" style={{ padding: '32px 36px' }}>
          <h3 className="info-section__title">What is an x402 Guarantee?</h3>
          <p className="info-hero__desc" style={{ marginBottom: '20px' }}>
            When your agent needs a premium service — like a real-time price feed or a compute endpoint —
            it issues a guarantee instead of a direct payment. The guarantee is a cryptographic commitment,
            backed by your on-chain credit, that the payment will be settled.
          </p>
          <div className="info-steps">
            <div className="info-step">
              <div className="info-step__num">1</div>
              <div>
                <div className="info-step__label">Request</div>
                <p className="info-step__desc">Agent finds a service endpoint that accepts x402 payments.</p>
              </div>
            </div>
            <div className="info-step">
              <div className="info-step__num">2</div>
              <div>
                <div className="info-step__label">Guarantee</div>
                <p className="info-step__desc">BondCredit issues an on-chain guarantee backed by the agent's credit limit.</p>
              </div>
            </div>
            <div className="info-step">
              <div className="info-step__num">3</div>
              <div>
                <div className="info-step__label">Settle</div>
                <p className="info-step__desc">Service is delivered. The guarantee settles on-chain and the agent's credit is updated.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Use Cases ── */}
        <section className="bc-card" style={{ padding: '32px 36px' }}>
          <h3 className="info-section__title">Supported Service Types</h3>
          <div className="info-integrations" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="info-integration">
              <div className="info-integration__icon"><BarChart3 size={24} color="#3bf7d2" /></div>
              <h4 className="info-integration__name">Premium Data Feeds</h4>
              <p className="info-integration__desc">Real-time market data, oracle prices, and analytics feeds from top providers.</p>
            </div>
            <div className="info-integration">
              <div className="info-integration__icon"><Zap size={24} color="#ffb066" /></div>
              <h4 className="info-integration__name">Compute & AI</h4>
              <p className="info-integration__desc">GPU compute, ML inference, and AI model access with pay-per-use guarantees.</p>
            </div>
            <div className="info-integration">
              <div className="info-integration__icon"><Link2 size={24} color="#7aa7ff" /></div>
              <h4 className="info-integration__name">Cross-Chain Bridges</h4>
              <p className="info-integration__desc">Bridge assets between chains with guaranteed settlement and no pre-funding.</p>
            </div>
            <div className="info-integration">
              <div className="info-integration__icon"><ShieldCheck size={24} color="#bced62" /></div>
              <h4 className="info-integration__name">Insurance & Risk</h4>
              <p className="info-integration__desc">Trade insurance, slippage protection, and risk management services.</p>
            </div>
          </div>
        </section>

        {/* ── Stats Row ── */}
        <div className="info-stats-row">
          <div className="info-stat-card bc-card">
            <div className="info-stat__value">x402</div>
            <div className="info-stat__label">Payment Protocol</div>
          </div>
          <div className="info-stat-card bc-card">
            <div className="info-stat__value">&lt; 2s</div>
            <div className="info-stat__label">Settlement Time</div>
          </div>
          <div className="info-stat-card bc-card">
            <div className="info-stat__value">0%</div>
            <div className="info-stat__label">Upfront Cost</div>
          </div>
        </div>

        {/* ── Machine Readable ── */}
        <MachineReadableSection
          title="Machine Readable"
          description="This page issues guarantees via backend API."
          codeSnippet={skillSnippet}
        />
      </div>
    </main>
  );
};

export default GuaranteePage;
