import React from 'react';
import { motion } from 'framer-motion';
import './RegisterAgent.css';

interface RegisterAgentProps {
  onBack: () => void;
}

export const RegisterAgent: React.FC<RegisterAgentProps> = ({ onBack }) => {
  return (
    <motion.div 
      className="register-agent-page"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.4 }}
    >
      <div className="register-container">
        <button className="back-button" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 10H5M5 10L10 15M5 10L10 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Dashboard
        </button>

        <header className="register-header">
          <span className="kicker">REGISTRATION GUIDE</span>
          <h1>Register Your Agent</h1>
          <p className="subtitle">Follow these steps to list your AI agent on the BondCredit Registry using the Hedera Agent Kit.</p>
        </header>

        <div className="steps-grid">
          <section className="step-card">
            <div className="step-number">01</div>
            <h3>Create SKILL.md</h3>
            <p>Every agent in the BondCredit ecosystem is defined by a <code>SKILL.md</code> file. This file acts as the manifest for your agent's capabilities.</p>
            <div className="code-snippet">
              <pre><code>{`# Agent Name: MyAgent
# Ticker: MYA
# Description: Describe what your agent does.

## Capabilities
- Portfolio Rebalancing
- Risk Assessment`}</code></pre>
            </div>
          </section>

          <section className="step-card">
            <div className="step-number">02</div>
            <h3>Define Metadata</h3>
            <p>Ensure your <code>SKILL.md</code> contains the required metadata headers. These are used to categorize your agent and display its information on the dashboard.</p>
            <ul className="requirements-list">
              <li><strong>Agent Name:</strong> Human-readable name</li>
              <li><strong>Ticker:</strong> 3-5 character unique identifier</li>
              <li><strong>Version:</strong> Current semantic version</li>
            </ul>
          </section>

          <section className="step-card">
            <div className="step-number">03</div>
            <h3>Placement</h3>
            <p>Place your completed <code>SKILL.md</code> file in the <code>.agents/</code> or <code>.skills/</code> directory of your project repository.</p>
            <div className="file-tree">
              <div className="tree-item">📁 my-project/</div>
              <div className="tree-item">  📁 .agents/</div>
              <div className="tree-item highlight">    📄 SKILL.md</div>
              <div className="tree-item">  📄 package.json</div>
            </div>
          </section>

          <section className="step-card">
            <div className="step-number">04</div>
            <h3>Network Broadcast</h3>
            <p>Once your file is in place, the Hedera Agent Kit will broadcast your agent's presence to the network. No manual submission is required.</p>
            <div className="status-badge">
              <span className="pulse-dot"></span>
              Automatic Discovery Enabled
            </div>
          </section>
        </div>

        <footer className="register-footer">
          <div className="help-box">
            <h4>Need Help?</h4>
            <p>Join our developer Discord or check out the full <a href="https://docs.bond.credit" target="_blank" rel="noopener noreferrer">Hedera Agent Kit Documentation</a>.</p>
          </div>
          <button className="primary-cta" onClick={onBack}>I'm Ready, Let's Go</button>
        </footer>
      </div>
    </motion.div>
  );
};
