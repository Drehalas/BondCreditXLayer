import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, CheckCircle, Shield, Target, ArrowRight } from 'lucide-react';
import MachineReadableSection from '../components/MachineReadableSection';

const CreditPage: React.FC = () => {
  const skillSnippet = `# Apply: Autonomous Credit Application
POST /credit/apply
{
  "agentId": "string",
  "amount": 0.1,
  "recipient": "0x...",
  "purpose": "arbitrage"
}

# Score: Check Credit Score
GET /credit/score/:agentId
→ { "score": 712, "rating": "Good", "factors": [...] }

# Repay: Settle Outstanding Credit
POST /credit/repay
{
  "agentId": "string",
  "creditId": "cred_xxx",
  "amount": 0.1005
}`;

  return (
    <main className="wt-container" style={{ marginTop: '88px', maxWidth: '960px' }}>
      <div className="bc-stack">

        {/* ── Hero ── */}
        <section className="bc-card" style={{ padding: '40px 36px' }}>
          <span className="info-badge" style={{ background: 'rgba(188,237,98,0.08)', color: '#bced62', borderColor: 'rgba(188,237,98,0.15)' }}>On-Chain Credit</span>
          <h2 className="info-hero__title">Autonomous Agentic Credit on X Layer</h2>
          <p className="info-hero__desc">
            BondCredit enables agents to build verifiable on-chain credit scores through 
            consistent trading, timely repayments, and risk management. Higher scores unlock 
            larger credit lines, better rates, and increased trading capacity.
          </p>
          <Link to="/dashboard" className="bc-btn bc-btnPrimary" style={{ textDecoration: 'none', marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            View Dashboard <ArrowRight size={14} />
          </Link>
        </section>

        {/* ── Credit Score Breakdown ── */}
        <section className="bc-card" style={{ padding: '32px 36px' }}>
          <h3 className="info-section__title">How Credit Scores Work</h3>
          <p className="info-hero__desc" style={{ marginBottom: '24px' }}>
            Your agent's credit score is computed from four key factors. Each factor updates in real-time
            as your agent trades, repays, and manages risk across supported venues.
          </p>
          <div className="info-factors">
            <div className="info-factor">
              <div className="info-factor__header">
                <span className="info-factor__icon"><TrendingUp size={18} color="#3bf7d2" /></span>
                <span className="info-factor__name">Trade Consistency</span>
                <span className="info-factor__weight">30%</span>
              </div>
              <p className="info-factor__desc">Regular trading activity across markets demonstrates reliability and engagement.</p>
            </div>
            <div className="info-factor">
              <div className="info-factor__header">
                <span className="info-factor__icon"><CheckCircle size={18} color="#3bf7d2" /></span>
                <span className="info-factor__name">Settlement History</span>
                <span className="info-factor__weight">35%</span>
              </div>
              <p className="info-factor__desc">On-time repayments and clean settlement records are the strongest credit signal.</p>
            </div>
            <div className="info-factor">
              <div className="info-factor__header">
                <span className="info-factor__icon"><Shield size={18} color="#3bf7d2" /></span>
                <span className="info-factor__name">Risk Management</span>
                <span className="info-factor__weight">20%</span>
              </div>
              <p className="info-factor__desc">Prudent position sizing, stop-losses, and leverage usage demonstrate responsible trading.</p>
            </div>
            <div className="info-factor">
              <div className="info-factor__header">
                <span className="info-factor__icon"><Target size={18} color="#3bf7d2" /></span>
                <span className="info-factor__name">Portfolio Diversity</span>
                <span className="info-factor__weight">15%</span>
              </div>
              <p className="info-factor__desc">Trading across multiple pairs and venues reduces concentration risk.</p>
            </div>
          </div>
        </section>

        {/* ── Credit Lifecycle ── */}
        <section className="bc-card" style={{ padding: '32px 36px' }}>
          <h3 className="info-section__title">Credit Lifecycle</h3>
          <div className="info-steps">
            <div className="info-step">
              <div className="info-step__num">1</div>
              <div>
                <div className="info-step__label">Apply</div>
                <p className="info-step__desc">Your agent requests credit for a specific purpose — trading, arbitrage, or liquidity provision.</p>
              </div>
            </div>
            <div className="info-step">
              <div className="info-step__num">2</div>
              <div>
                <div className="info-step__label">Score Check</div>
                <p className="info-step__desc">BondCredit evaluates your credit score and determines your limit in real-time.</p>
              </div>
            </div>
            <div className="info-step">
              <div className="info-step__num">3</div>
              <div>
                <div className="info-step__label">Deploy</div>
                <p className="info-step__desc">Approved credit is deployed to your wallet. Trade across OKX DEX and supported venues.</p>
              </div>
            </div>
            <div className="info-step">
              <div className="info-step__num">4</div>
              <div>
                <div className="info-step__label">Repay & Grow</div>
                <p className="info-step__desc">Repay on time to increase your score and unlock larger credit capacity.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Score Tiers ── */}
        <section className="bc-card" style={{ padding: '32px 36px' }}>
          <h3 className="info-section__title">Score Tiers</h3>
          <div className="info-tiers">
            <div className="info-tier">
              <div className="info-tier__range" style={{ color: '#ff4d6d' }}>300 – 549</div>
              <div className="info-tier__label">Building</div>
              <p className="info-tier__desc">New agents start here. Limited credit, foundational access.</p>
            </div>
            <div className="info-tier">
              <div className="info-tier__range" style={{ color: '#ffb066' }}>550 – 699</div>
              <div className="info-tier__label">Fair</div>
              <p className="info-tier__desc">Growing track record. Standard credit limits and rates.</p>
            </div>
            <div className="info-tier">
              <div className="info-tier__range" style={{ color: '#bced62' }}>700 – 749</div>
              <div className="info-tier__label">Good</div>
              <p className="info-tier__desc">Proven reliability. Expanded credit and better rates.</p>
            </div>
            <div className="info-tier">
              <div className="info-tier__range" style={{ color: '#3bf7d2' }}>750 – 850</div>
              <div className="info-tier__label">Excellent</div>
              <p className="info-tier__desc">Top-tier agents. Maximum credit lines and lowest rates.</p>
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <div className="info-stats-row">
          <div className="info-stat-card bc-card">
            <div className="info-stat__value">850</div>
            <div className="info-stat__label">Max Score</div>
          </div>
          <div className="info-stat-card bc-card">
            <div className="info-stat__value">4</div>
            <div className="info-stat__label">Score Factors</div>
          </div>
          <div className="info-stat-card bc-card">
            <div className="info-stat__value">Live</div>
            <div className="info-stat__label">Real-Time Updates</div>
          </div>
        </div>

        {/* ── Machine Readable ── */}
        <MachineReadableSection
          title="Machine Readable"
          description="This page exposes autonomous credit application and repayment capabilities for Agents."
          codeSnippet={skillSnippet}
        />
      </div>
    </main>
  );
};

export default CreditPage;
