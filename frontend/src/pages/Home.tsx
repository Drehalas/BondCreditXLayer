import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const Section: React.FC<{ children: React.ReactNode; className?: string; id?: string; style?: React.CSSProperties }> = ({ children, className, id, style }) => (
  <motion.section
    id={id}
    initial={{ opacity: 0, y: 50 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.8, ease: "easeOut" }}
    className={`min-h-[80vh] py-20 flex flex-col justify-center items-center text-center ${className}`}
    style={{ padding: '80px 24px', minHeight: '80vh', ...style }}
  >
    <div className="wt-container">
      {children}
    </div>
  </motion.section>
);

const Home: React.FC = () => {
  return (
    <div className="home-root" style={{ background: 'var(--bondcredit-bg)', color: 'var(--bondcredit-white)' }}>
      <Section 
        className="hero-section" 
        style={{ 
          paddingTop: '160px', 
          paddingBottom: '120px',
          background: 'linear-gradient(rgba(13, 15, 20, 0.4), rgba(13, 15, 20, 0.9)), url("/hero/bondhero.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative'
        }}
      >
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{ fontSize: 'clamp(3rem, 10vw, 5rem)', fontWeight: 900, lineHeight: 1.05, marginBottom: '24px', letterSpacing: '-0.02em' }}
        >
          Trust and <span style={{ color: 'var(--bondcredit-green)', textShadow: '0 0 40px rgba(59, 247, 210, 0.3)' }}>Credit</span><br />
          <span style={{ fontSize: '0.8em', fontWeight: 700, opacity: 0.9 }}>for the Agentic Economy</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          style={{ fontSize: '1.25rem', color: 'var(--bondcredit-s2)', maxWidth: '650px', margin: '0 auto 48px', lineHeight: 1.6 }}
        >
          Our Agentic Credit Engine analyses agent behavior history onchain to provide real-time credit scores and credit lines.
        </motion.p>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}
        >
          <Link to="/subscribe" className="bc-btn bc-btnPrimary" style={{ padding: '16px 48px', fontSize: '1.125rem', fontWeight: 600, borderRadius: '14px' }}>Subscribe</Link>
          <a href="#x402" className="bc-btn" style={{ padding: '16px 48px', fontSize: '1.125rem', fontWeight: 600, borderRadius: '14px' }}>Explore Protocols</a>
        </motion.div>
      </Section>

      {/* Subscribe Section */}
      <Section id="subscribe" style={{ background: 'linear-gradient(180deg, var(--bondcredit-bg) 0%, var(--bondcredit-bg2) 100%)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '80px', alignItems: 'center', textAlign: 'left' }}>
          <div>
            <div style={{ color: 'var(--bondcredit-lime)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', fontSize: '0.875rem' }}>Phase 01: Onboarding</div>
            <h2 style={{ fontSize: '3rem', marginBottom: '24px', lineHeight: 1.1, fontWeight: 800 }}>Seamless <br /><span style={{ color: 'var(--bondcredit-lime)' }}>Registration</span></h2>
            <p style={{ color: 'var(--bondcredit-s2)', fontSize: '1.125rem', marginBottom: '40px', lineHeight: 1.7 }}>
              Integrate your agents with the XLayer ecosystem in minutes. Our SDK handles everything from identity verification to automated subscription management.
            </p>
            <Link to="/subscribe" className="bc-btn bc-btnPrimary" style={{ padding: '12px 28px' }}>Subscribe</Link>
          </div>
          <div className="bc-card" style={{ padding: '0', background: '#000', border: '1px solid rgba(59, 247, 210, 0.1)', boxShadow: '0 0 100px rgba(59, 247, 210, 0.05)' }}>
             <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }} />
             </div>
             <pre style={{ color: 'var(--bondcredit-green)', fontSize: '0.9rem', padding: '32px', margin: '0', lineHeight: 1.6, overflow: 'hidden' }}>
{`<span style="color: #7aa7ff">import</span> { BondCreditClient } <span style="color: #7aa7ff">from</span> <span style="color: #bced62">'@bondcredit/sdk'</span>;

<span style="color: #555">// Initialize your Agent</span>
<span style="color: #7aa7ff">const</span> agent = <span style="color: #7aa7ff">new</span> BondCreditClient({
  network: <span style="color: #bced62">'xlayer-mainnet'</span>,
  agentId: <span style="color: #bced62">'agent-0x...'</span>
});

<span style="color: #7aa7ff">await</span> agent.subscription.subscribe();`}
             </pre>
          </div>
        </div>
      </Section>

      {/* x402 Section */}
      <Section id="x402">
        <div style={{ textAlign: 'center', maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ color: 'var(--bondcredit-green)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', fontSize: '0.875rem' }}>Phase 02: Execution</div>
          <h2 style={{ fontSize: '3rem', marginBottom: '24px', fontWeight: 800 }}>Payment <span style={{ color: 'var(--bondcredit-green)' }}>Delegation</span> (x402)</h2>
          <p style={{ color: 'var(--bondcredit-s2)', fontSize: '1.125rem', marginBottom: '56px', maxWidth: '700px', margin: '0 auto 56px', lineHeight: 1.7 }}>
            Empower your agents to transact autonomously. x402 is a secure delegation protocol that allows agents to consume services and settle payments on-chain without manual intervention.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '48px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', width: '100%' }}>
            <div className="bc-card" style={{ padding: '32px', textAlign: 'left' }}>
              <div style={{ color: 'var(--bondcredit-green)', fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px', opacity: 0.5 }}>01</div>
              <h3 style={{ marginBottom: '12px', fontSize: '1.25rem' }}>Initiate</h3>
              <p style={{ fontSize: '0.9375rem', color: 'var(--bondcredit-s2)', lineHeight: 1.6 }}>Agent triggers a payment guarantee for a specific autonomous service.</p>
            </div>
            <div className="bc-card" style={{ padding: '32px', textAlign: 'left' }}>
              <div style={{ color: 'var(--bondcredit-green)', fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px', opacity: 0.5 }}>02</div>
              <h3 style={{ marginBottom: '12px', fontSize: '1.25rem' }}>Authorize</h3>
              <p style={{ fontSize: '0.9375rem', color: 'var(--bondcredit-s2)', lineHeight: 1.6 }}>Smart contracts verify delegation limits and securely lock necessary funds.</p>
            </div>
            <div className="bc-card" style={{ padding: '32px', textAlign: 'left' }}>
              <div style={{ color: 'var(--bondcredit-green)', fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px', opacity: 0.5 }}>03</div>
              <h3 style={{ marginBottom: '12px', fontSize: '1.25rem' }}>Execute</h3>
              <p style={{ fontSize: '0.9375rem', color: 'var(--bondcredit-s2)', lineHeight: 1.6 }}>The service is rendered and settlement happens automatically via x402.</p>
            </div>
          </div>
          <Link to="/guarantee" className="bc-btn bc-btnPrimary" style={{ padding: '14px 36px' }}>Explore Delegate Protocol</Link>
          </div>
        </div>
      </Section>

      {/* ═══ NEW: Agentic Trading Section ═══ */}
      <Section id="trade" style={{ background: 'linear-gradient(180deg, #050505 0%, #0a0a0a 50%, #050505 100%)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '80px', alignItems: 'center', textAlign: 'left' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ color: '#ffffff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.875rem' }}>NEW</span>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
              <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.875rem' }}>Agentic Trading</span>
            </div>
            <h2 style={{ fontSize: '3rem', marginBottom: '24px', lineHeight: 1.1, fontWeight: 900, letterSpacing: '-0.02em' }}>
              Trade on <br /><span style={{ color: '#ffffff' }}>Uniswap</span> <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>via</span> <span style={{ color: '#ffffff' }}>Onchain OS</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.125rem', marginBottom: '32px', lineHeight: 1.7 }}>
              Deploy autonomous AI trading agents that execute swaps on Uniswap V3 through Onchain OS agentic wallets. Every trade builds your on-chain credit score — unlocking credit lines at scale.
            </p>

            {/* Capability Badges */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '40px' }}>
              {[
                { label: 'DEX Swap', desc: 'Uniswap V3' },
                { label: 'Price Data', desc: 'Real-time feeds' },
                { label: 'x402 Payments', desc: 'Autonomous settlement' },
                { label: 'Credit Scoring', desc: '+1 success / −1 failure' },
              ].map((cap) => (
                <div key={cap.label} style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  background: '#000000',
                  border: '1px solid #1a1a1a',
                  transition: 'border-color 200ms ease',
                }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#ffffff', marginBottom: '2px' }}>{cap.label}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)' }}>{cap.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <Link to="/trade" style={{
                padding: '14px 36px',
                borderRadius: '50px',
                background: '#ffffff',
                color: '#000000',
                fontWeight: 800,
                fontSize: '0.9375rem',
                textDecoration: 'none',
                transition: 'opacity 200ms',
                border: 'none',
              }}>Start Trading</Link>
              <Link to="/dashboard" style={{
                padding: '14px 36px',
                borderRadius: '50px',
                background: 'transparent',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.9375rem',
                textDecoration: 'none',
                border: '1px solid #2a2a2a',
                transition: 'border-color 200ms',
              }}>View Dashboard</Link>
            </div>
          </div>

          {/* Trade Terminal Mock */}
          <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #1a1a1a', background: '#000000' }}>
            {/* Terminal Header */}
            <div style={{ background: '#0a0a0a', padding: '10px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em', color: '#ffffff' }}>BOND_AGENT_TRADE</span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff4d6d', opacity: 0.5 }} />
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffb066', opacity: 0.5 }} />
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3bf7d2', opacity: 0.5 }} />
              </div>
            </div>
            {/* Terminal Body */}
            <div style={{ padding: '24px', fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '0.8125rem', lineHeight: 1.8, color: 'rgba(255,255,255,0.5)' }}>
              <div><span style={{ color: 'rgba(255,255,255,0.25)' }}>[09:14:02]</span> <span style={{ color: 'rgba(255,255,255,0.6)' }}>💳 x402 payment complete...</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.25)' }}>[09:14:03]</span> <span style={{ color: 'rgba(255,255,255,0.6)' }}>✅ AMLBOT review completed</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.25)' }}>[09:14:04]</span> <span style={{ color: 'rgba(255,255,255,0.6)' }}>📊 Scoring Algorithm unlocked</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.25)' }}>[09:14:05]</span> <span style={{ color: '#ffffff', fontWeight: 700 }}>🚀 It's time to Bond</span></div>
              <div style={{ height: '1px', background: '#1a1a1a', margin: '12px 0' }} />
              <div><span style={{ color: 'rgba(255,255,255,0.25)' }}>[09:15:12]</span> <span style={{ color: 'rgba(255,255,255,0.6)' }}>&gt; Initiating Uniswap V3 swap: 0.5 ETH → USDC</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.25)' }}>[09:15:14]</span> <span style={{ color: 'rgba(255,255,255,0.6)' }}>&gt; Optimal route: Uniswap V3 (0.05% fee)</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.25)' }}>[09:15:16]</span> <span style={{ color: '#ffffff', fontWeight: 700 }}>[SUCCESS] 0.5 ETH → 1,842.50 USDC</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.25)' }}>[09:15:16]</span> <span style={{ color: 'rgba(255,255,255,0.6)' }}>&gt; Credit Score: +1</span></div>
              <div style={{ height: '1px', background: '#1a1a1a', margin: '12px 0' }} />
              <div><span style={{ color: 'rgba(255,255,255,0.25)' }}>[09:16:30]</span> <span style={{ color: '#ffffff', fontWeight: 700 }}>🏆 $100 Credit Line UNLOCKED — Score: 10</span></div>
            </div>
            {/* Score Bar */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>Credit Score</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff' }}>10</span>
              </div>
              <div style={{
                padding: '6px 16px',
                borderRadius: '50px',
                background: '#ffffff',
                color: '#000000',
                fontSize: '0.6875rem',
                fontWeight: 800,
              }}>
                CREDIT LINE UNLOCKED
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Credit Section */}
      <Section id="credit" style={{ background: 'linear-gradient(0deg, var(--bondcredit-bg) 0%, var(--bondcredit-bg2) 100%)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '80px', alignItems: 'center', textAlign: 'left' }}>
          <div className="bc-card" style={{ height: '360px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible', background: 'radial-gradient(circle at center, rgba(188, 237, 98, 0.15) 0%, transparent 70%)' }}>
            <motion.div 
              style={{ textAlign: 'center' }}
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1, type: 'spring' }}
            >
              <div style={{ fontSize: '6rem', fontWeight: 900, color: 'var(--bondcredit-lime)', lineHeight: 1, textShadow: '0 0 60px rgba(188, 237, 98, 0.4)' }}>782</div>
              <div style={{ fontSize: '1.5rem', color: 'var(--bondcredit-green)', fontWeight: 700, letterSpacing: '0.1em', marginTop: '8px' }}>PRIME SCORE</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--bondcredit-s2)', marginTop: '16px', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 16px', borderRadius: '99px' }}>TOP 2% OF AGENTS</div>
            </motion.div>
          </div>
          <div>
            <div style={{ color: 'var(--bondcredit-green)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', fontSize: '0.875rem' }}>Phase 03: Intelligence</div>
            <h2 style={{ fontSize: '3rem', marginBottom: '24px', fontWeight: 800, lineHeight: 1.1 }}>Quantifiable <br /><span style={{ color: 'var(--bondcredit-green)' }}>Trust</span></h2>
            <p style={{ color: 'var(--bondcredit-s2)', fontSize: '1.125rem', marginBottom: '40px', lineHeight: 1.7 }}>
              Our Agentic Credit Engine analyses agent behavior history onchain to provide real-time credit scores and credit lines.
            </p>
            <Link to="/subscribe" className="bc-btn bc-btnPrimary" style={{ padding: '12px 28px' }}>Subscribe</Link>
          </div>
        </div>
      </Section>

      {/* Analytics Section */}
      <Section id="analytics" style={{ paddingBottom: '160px' }}>
        <div style={{ color: 'var(--bondcredit-red)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', fontSize: '0.875rem' }}>Global View</div>
        <h2 style={{ fontSize: '3rem', marginBottom: '24px', fontWeight: 800 }}>Real-time <span style={{ color: 'var(--bondcredit-red)' }}>Monitoring</span></h2>
        <p style={{ color: 'var(--bondcredit-s2)', fontSize: '1.125rem', marginBottom: '56px', maxWidth: '750px', margin: '0 auto 56px', lineHeight: 1.7 }}>
          Gain deep visibility into your agent fleet. Track performance metrics, health status, and cross-chain interaction traces with our enterprise-grade analytics engine.
        </p>
        <Link to="/subscribe" className="bc-btn bc-btnPrimary" style={{ padding: '16px 40px', fontSize: '1.125rem' }}>Subscribe</Link>
      </Section>
    </div>
  );
};

export default Home;
