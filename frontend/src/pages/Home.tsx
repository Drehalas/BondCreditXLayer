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
