import React from 'react';

interface MachineReadableSectionProps {
  title: string;
  description: string;
  codeSnippet: string;
  sdkVersion?: string;
}

const MachineReadableSection: React.FC<MachineReadableSectionProps> = ({ title, description, codeSnippet, sdkVersion = '0.2.40' }) => {
  return (
    <section className="bc-card" style={{ marginTop: '40px', padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '32px', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--bondcredit-white)' }}>{title}</h2>
          <p style={{ color: 'var(--bondcredit-s2)', fontSize: '0.875rem' }}>{description}</p>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <a 
            href="/.well-known/SKILL.md" 
            target="_blank" 
            className="bc-btn bc-btnPrimary" 
            style={{ padding: '8px 20px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '99px', textDecoration: 'none' }}
          >
            <span>Preview</span>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          </a>
          <span style={{ fontSize: '0.75rem', color: 'var(--bondcredit-s2)', fontFamily: 'monospace' }}>SDK {sdkVersion}</span>
        </div>
      </div>

      <div style={{ background: '#1e1e1e', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }} />
          </div>
          <span style={{ marginLeft: '12px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>SKILL.md preview</span>
        </div>
        <pre style={{ margin: 0, padding: '24px', color: '#d4d4d4', fontSize: '0.8125rem', lineHeight: 1.5, overflowX: 'auto', fontFamily: 'Menlo, Monaco, Consolas, "Andale Mono", "Ubuntu Mono", "Courier New", monospace' }}>
          <code style={{ whiteSpace: 'pre' }}>{codeSnippet}</code>
        </pre>
      </div>
    </section>
  );
};

export default MachineReadableSection;
