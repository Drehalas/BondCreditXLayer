import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface BondCreditHeaderProps {
  connected: boolean;
  onRegisterClick: () => void;
}

const BondCreditHeader: React.FC<BondCreditHeaderProps> = ({ connected, onRegisterClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="wt-nav" style={{ background: 'var(--bondcredit-bg2)', borderBottom: '1px solid var(--bondcredit-border)', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, transition: 'transform 0.3s ease' }}>
      <div className="wt-container w-full flex items-center justify-between" style={{ height: '48px' }}>
        {/* Logo Section */}
        <a href="/" className="flex flex-col gap-1" style={{ textDecoration: 'none' }}>
          <img
            src="/brandkit/bond.credit_logo_white.svg"
            alt="bond.credit"
            className="h-4 w-auto"
          />
          <span
            className="text-uppercase"
            style={{
              fontSize: '0.5625rem',
              color: 'var(--bondcredit-s2)',
              fontWeight: 600,
              letterSpacing: '0.08em',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '2px'
            }}
          >
            Agentic Alpha
          </span>
        </a>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1">
          <a
            href="/"
            className="nav-link active flex items-center gap-1.5"
            style={{ background: 'var(--bondcredit-card2)' }}
          >
            XLayer Testnet
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--bondcredit-green)',
                display: 'inline-block',
                boxShadow: '0 0 6px var(--bondcredit-green)'
              }}
            />
          </a>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-4">
            <button
              className="text-xs font-medium transition-colors hover:text-bondcredit-white cursor-pointer focus-ring"
              style={{
                color: 'var(--bondcredit-s2)',
                background: 'transparent',
                border: 'none',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem'
              }}
              onClick={onRegisterClick}
            >
              Register Agent
            </button>
            <a
              href="/.well-known/skills/default/SKILL.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium transition-colors hover:text-bondcredit-white focus-ring"
              style={{
                color: 'var(--bondcredit-s2)',
                background: 'transparent',
                border: 'none',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                textDecoration: 'none'
              }}
            >
              Agents
            </a>
            <a
              href="https://x.com/bondoncredit?s=21"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium transition-colors hover:text-bondcredit-white focus-ring"
              style={{
                color: 'var(--bondcredit-s2)',
                background: 'transparent',
                border: 'none',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                textDecoration: 'none'
              }}
            >
              X ↗
            </a>
          </div>

          <button
            className="btn-lime text-xs cursor-pointer focus-ring hover:opacity-90"
            style={{
              padding: '6px 14px',
              opacity: 1,
              transition: 'all 0.2s ease',
              pointerEvents: 'auto',
              border: 'none',
              borderRadius: '0.375rem',
              fontWeight: 600
            }}
          >
            CONNECT
          </button>



          <button
            className="lg:hidden flex items-center justify-center cursor-pointer focus-ring hover:bg-bondcredit-card2"
            aria-label="Open menu"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{
              width: '44px',
              height: '44px',
              color: 'var(--bondcredit-s2)',
              flexShrink: 0,
              background: 'transparent',
              border: '1px solid var(--bondcredit-border)',
              borderRadius: '0.375rem',
              transition: 'all 0.2s ease'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18"></path>
              <path d="M3 6h18"></path>
              <path d="M3 18h18"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <motion.div
          className="lg:hidden border-t border-bondcredit-border bg-bondcredit-bg2"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 52 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          style={{ overflow: 'hidden' }}
        >
          <div className="flex flex-col gap-1 py-3 px-4">
            <a
              href="/"
              className="nav-link text-sm flex items-center gap-1.5"
              style={{ color: 'var(--bondcredit-white)', background: 'var(--bondcredit-card2)' }}
            >
              LIVE
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--bondcredit-green)',
                  display: 'inline-block',
                  boxShadow: '0 0 6px var(--bondcredit-green)'
                }}
              />
            </a>
          </div>
        </motion.div>
      )}
    </nav>
  );
};

export default BondCreditHeader;
