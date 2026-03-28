import React from 'react';
import { Link } from 'react-router-dom';
import MachineReadableSection from '../components/MachineReadableSection';

const SubscribePage: React.FC = () => {
  const skillSnippet = `# Subscribe: Agent Enrollment & Subscription
POST /subscription/subscribe
{
  "agentId": "string",
  "duration": "30 days",
  "autoRenew": true
}

# Status: Check Subscription
POST /subscription/status
{ "agentId": "string" }

# Renew: Extend Subscription
POST /subscription/renew
{ "agentId": "string" }`;

  return (
    <main className="wt-container" style={{ marginTop: '88px', maxWidth: '960px' }}>
      <div className="bc-stack">

        {/* ── Hero ── */}
        <section className="bc-card" style={{ padding: '40px 36px' }}>
          <span className="info-badge">Subscription</span>
          <h2 className="info-hero__title">x402-Powered Agent Subscriptions</h2>
          <p className="info-hero__desc">
            Subscribe your agent to BondCredit to unlock on-chain credit capabilities. 
            Subscriptions are paid via the x402 payment protocol — automated, verifiable, 
            and fully agent-compatible.
          </p>
          <Link to="/create" className="bc-btn bc-btnPrimary" style={{ textDecoration: 'none', marginTop: '20px', display: 'inline-block' }}>
            Register an Agent →
          </Link>
        </section>

        {/* ── How It Works ── */}
        <section className="bc-card" style={{ padding: '32px 36px' }}>
          <h3 className="info-section__title">How Subscriptions Work</h3>
          <div className="info-steps">
            <div className="info-step">
              <div className="info-step__num">1</div>
              <div>
                <div className="info-step__label">Register</div>
                <p className="info-step__desc">Create an agent wallet and provide identity through the registration wizard.</p>
              </div>
            </div>
            <div className="info-step">
              <div className="info-step__num">2</div>
              <div>
                <div className="info-step__label">Subscribe</div>
                <p className="info-step__desc">Choose a plan (Free, Pro, or Enterprise). Payment is processed via x402 — automated and on-chain.</p>
              </div>
            </div>
            <div className="info-step">
              <div className="info-step__num">3</div>
              <div>
                <div className="info-step__label">Trade & Earn</div>
                <p className="info-step__desc">Access market venues, execute trades, and build your credit score over time.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Plans ── */}
        <section className="bc-card" style={{ padding: '32px 36px' }}>
          <h3 className="info-section__title">Subscription Plans</h3>
          <div className="info-plans">
            <div className="info-plan">
              <div className="info-plan__name">Free</div>
              <div className="info-plan__price">$0</div>
              <ul className="info-plan__features">
                <li><span className="info-check">✓</span> Basic credit scoring</li>
                <li><span className="info-check">✓</span> 1 market venue</li>
                <li><span className="info-check">✓</span> Community support</li>
              </ul>
            </div>
            <div className="info-plan info-plan--popular">
              <div className="info-plan__badge">Popular</div>
              <div className="info-plan__name">Pro</div>
              <div className="info-plan__price">$9.99<span>/mo</span></div>
              <ul className="info-plan__features">
                <li><span className="info-check">✓</span> Advanced credit scoring</li>
                <li><span className="info-check">✓</span> All market venues</li>
                <li><span className="info-check">✓</span> Priority support</li>
                <li><span className="info-check">✓</span> Auto-renew via x402</li>
              </ul>
            </div>
            <div className="info-plan">
              <div className="info-plan__name">Enterprise</div>
              <div className="info-plan__price">Custom</div>
              <ul className="info-plan__features">
                <li><span className="info-check">✓</span> Unlimited agents</li>
                <li><span className="info-check">✓</span> Custom credit limits</li>
                <li><span className="info-check">✓</span> Dedicated support</li>
                <li><span className="info-check">✓</span> SLA guarantees</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Ecosystem ── */}
        <section className="bc-card" style={{ padding: '32px 36px' }}>
          <span className="info-badge" style={{ background: 'rgba(188,237,98,0.08)', color: '#bced62', borderColor: 'rgba(188,237,98,0.15)' }}>Ecosystem</span>
          <h3 className="info-section__title" style={{ marginTop: '8px' }}>Integrations that unlock instant access</h3>
          <p className="info-hero__desc" style={{ marginBottom: '20px' }}>
            Verify your identity or connect a wallet to skip pre-qualification and start trading immediately.
          </p>
          <div className="info-integrations">
            <div className="info-integration info-integration--featured">
              <div className="info-integration__tag">Identity Verification</div>
              <h4 className="info-integration__name">World ID</h4>
              <p className="info-integration__desc">Verify the human behind your agent with World ID to receive instant credit. No pre-qualification wait.</p>
              <ul className="info-integration__checks">
                <li><span className="info-check">✓</span> Human verification</li>
                <li><span className="info-check">✓</span> Sybil protection</li>
                <li><span className="info-check">✓</span> Skip pre-qualification</li>
                <li><span className="info-check">✓</span> Built-in to dashboard</li>
              </ul>
            </div>
            <div className="info-integration">
              <div className="info-integration__tag" style={{ background: 'rgba(59,247,210,0.06)', color: '#3bf7d2' }}>Instant Credit</div>
              <h4 className="info-integration__name">Wallet Funding</h4>
              <p className="info-integration__desc">Fund a wallet to get instant credit. Repay directly via USDC on X Layer. Agent-native.</p>
              <ul className="info-integration__checks">
                <li><span className="info-check">✓</span> Instant credit</li>
                <li><span className="info-check">✓</span> Wallet repayment</li>
                <li><span className="info-check">✓</span> Agent-native</li>
              </ul>
            </div>
            <div className="info-stat-card">
              <div className="info-stat__value">$5</div>
              <div className="info-stat__label">Instant Credit</div>
            </div>
            <div className="info-stat-card">
              <div className="info-stat__value">2</div>
              <div className="info-stat__label">Integrations</div>
            </div>
          </div>
        </section>

        {/* ── Machine Readable ── */}
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
