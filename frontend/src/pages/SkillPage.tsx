import React from 'react';

const SKILL_CONTENT = `# BondCredit Agent

## Description

Hybrid on-chain/off-chain agent enabling enrollment, autonomous credit application with x402 guarantee, and reward growth through repayment.

## Base URL

http://localhost:3000

## Authentication

None

---

## Agent Flow

1. Land: Enroll with email or wallet linked to your Onchain OS agent.
2. Install: Download this skill file and send it to your agent.
3. Apply: Agent calls the credit apply capability to subscribe (if needed), score, request limit, and create x402 guarantee.
4. Earn Rewards: Agent repays to improve score and unlock higher credit line.

---

## Capabilities

### Enrollment: Enroll Agent Identity

Enroll an agent using email or wallet and retrieve current score and line snapshot.

Endpoint: POST /enroll

Request:
\`\`\`json
{
  "agentId": "string",
  "email": "agent@domain.com",
  "walletAddress": "0x..."
}
\`\`\`

Response:
\`\`\`json
{
  "enrolled": true,
  "agentId": "string",
  "email": "agent@domain.com",
  "walletAddress": "0x...",
  "subscription": {
    "active": false,
    "expiryDate": "YYYY-MM-DD",
    "daysLeft": 0,
    "paymentsMade": 0
  },
  "credit": {
    "score": 700,
    "tier": "Prime",
    "line": "0.5000 XLAYER"
  },
  "message": "Enrollment complete. Download skill.md and connect it to your agent."
}
\`\`\`

---

### Install: Retrieve Agent Skill

Download the skill file that your external agent uses for capability discovery.

Endpoint: GET /.well-known/skill.md

---

### Apply: Autonomous Credit Application

Run subscription bootstrap, risk/eligibility checks, credit request, and x402 guarantee issuance.

Endpoint: POST /credit/apply

Request:
\`\`\`json
{
  "agentId": "string",
  "amount": 0.1,
  "recipient": "0x...",
  "service": "autonomous-credit-execution",
  "endpoint": "bondcredit://credit/apply",
  "purpose": "arbitrage"
}
\`\`\`

Response (Approved):
\`\`\`json
{
  "approved": true,
  "subscribedNow": true,
  "score": { "value": 700, "tier": "Prime", "updatedAt": "ISO-8601" },
  "limit": { "current": "0.5000 XLAYER", "used": "0.0000 XLAYER", "available": "0.5000 XLAYER" },
  "approval": { "approved": true, "creditId": "cred_xxx", "amount": "0.1 OKB", "fee": "0.000050 OKB" },
  "guarantee": { "guaranteeId": "guar_xxx", "proof": "0x...", "expiresAt": "ISO-8601" }
}
\`\`\`

---

### Rewards: Repay and Grow

Submit repayment and receive score/credit-line growth snapshot.

Endpoint: POST /credit/repay

Request:
\`\`\`json
{
  "agentId": "string",
  "creditId": "cred_xxx",
  "amount": 0.0105
}
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "repayment": { "success": true, "newScore": 705, "txHash": "0x..." },
  "growth": { "scoreBefore": 700, "scoreAfter": 705, "lineBefore": "0.5000 XLAYER", "lineAfter": "0.5500 XLAYER" }
}
\`\`\`

---

### Subscription: Check Monitoring Status

Endpoint: POST /subscription/status

Request:
\`\`\`json
{ "agentId": "string" }
\`\`\`

---

### Risk: Assess Risk Score

Endpoint: POST /risk-score

Request:
\`\`\`json
{ "agentId": "string" }
\`\`\`

---

### Guarantee: Issue Credit Guarantee

Endpoint: POST /guarantee

Request:
\`\`\`json
{
  "agentId": "string",
  "amount": 0.1
}
\`\`\`

---

### Vault: Rebalance Vault

Endpoint: POST /rebalance

Request:
\`\`\`json
{ "vaultId": "string" }
\`\`\`

---

### Analytics: Get Volatility

Endpoint: GET /volatility
`;

function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let blockKey = 0;

  const flush = () => {
    if (codeLines.length > 0) {
      elements.push(
        <pre key={blockKey++} style={{
          background: '#f6f8fa',
          border: '1px solid #d0d7de',
          borderRadius: '6px',
          padding: '16px',
          margin: '12px 0',
          overflowX: 'auto',
          fontSize: '0.8125rem',
          lineHeight: 1.6,
          fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
        }}>
          <code>
            {codeLines.map((line, i) => {
              const highlighted = line
                .replace(/"([^"]+)"(\s*:)/g, '<key>"$1"</key>$2')
                .replace(/:\s*"([^"]+)"/g, ': <str>"$1"</str>')
                .replace(/:\s*(true|false|null)/g, ': <bool>$1</bool>')
                .replace(/:\s*(\d+\.?\d*)/g, ': <num>$1</num>');

              return (
                <div key={i} dangerouslySetInnerHTML={{ __html:
                  highlighted
                    .replace(/<key>/g, '<span style="color:#0550ae">')
                    .replace(/<\/key>/g, '</span>')
                    .replace(/<str>/g, '<span style="color:#0a3069">')
                    .replace(/<\/str>/g, '</span>')
                    .replace(/<bool>/g, '<span style="color:#cf222e">')
                    .replace(/<\/bool>/g, '</span>')
                    .replace(/<num>/g, '<span style="color:#6639ba">')
                    .replace(/<\/num>/g, '</span>')
                }} />
              );
            })}
          </code>
        </pre>
      );
      codeLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('\`\`\`')) {
      if (inCodeBlock) {
        flush();
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={blockKey++} style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: '#1f2328',
          marginTop: '48px',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid #d0d7de',
        }}>
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={blockKey++} style={{
          fontSize: '1.375rem',
          fontWeight: 600,
          color: '#1f2328',
          marginTop: '36px',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid #d0d7de',
        }}>
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={blockKey++} style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: '#1f2328',
          marginTop: '28px',
          marginBottom: '8px',
        }}>
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith('---')) {
      elements.push(
        <hr key={blockKey++} style={{
          border: 'none',
          borderTop: '1px solid #d0d7de',
          margin: '28px 0',
        }} />
      );
    } else if (/^\d+\.\s/.test(line)) {
      const text = line.replace(/^\d+\.\s/, '');
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={blockKey++} style={{ display: 'flex', gap: '10px', marginBottom: '6px', paddingLeft: '4px' }}>
          <span style={{ color: '#57606a', fontWeight: 600, minWidth: '18px' }}>{num}.</span>
          <span style={{ color: '#1f2328', lineHeight: 1.6 }}>{text}</span>
        </div>
      );
    } else if (line.startsWith('Endpoint:')) {
      const parts = line.split(' ');
      const method = parts[1] || '';
      const path = parts.slice(2).join(' ');
      elements.push(
        <div key={blockKey++} style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          background: '#f6f8fa',
          border: '1px solid #d0d7de',
          borderRadius: '6px',
          padding: '6px 14px',
          margin: '10px 0',
          fontFamily: 'Menlo, Monaco, Consolas, monospace',
          fontSize: '0.8125rem',
        }}>
          <span style={{
            background: method === 'GET' ? '#ddf4ff' : '#ffebe9',
            color: method === 'GET' ? '#0550ae' : '#cf222e',
            padding: '2px 8px',
            borderRadius: '4px',
            fontWeight: 700,
            fontSize: '0.6875rem',
            letterSpacing: '0.02em',
          }}>
            {method}
          </span>
          <span style={{ color: '#1f2328' }}>{path}</span>
        </div>
      );
    } else if (line.startsWith('Request:') || line.startsWith('Response') || line.startsWith('Error Response:')) {
      elements.push(
        <p key={blockKey++} style={{
          color: '#57606a',
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginTop: '14px',
          marginBottom: '2px',
        }}>
          {line}
        </p>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={blockKey++} style={{ height: '6px' }} />);
    } else {
      elements.push(
        <p key={blockKey++} style={{
          color: '#1f2328',
          lineHeight: 1.7,
          marginBottom: '6px',
          fontSize: '0.9375rem',
        }}>
          {line}
        </p>
      );
    }
  }

  flush();
  return elements;
}

const SkillPage: React.FC = () => {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#ffffff',
      color: '#1f2328',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
    }}>
      <div style={{
        maxWidth: '780px',
        margin: '0 auto',
        padding: '32px 24px 80px',
      }}>
        {/* Top bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px',
          padding: '12px 16px',
          background: '#f6f8fa',
          border: '1px solid #d0d7de',
          borderRadius: '6px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1f2328' }}>SKILL.md</span>
            <span style={{ color: '#57606a', fontSize: '0.75rem', fontFamily: 'monospace' }}>/.well-known/SKILL.md</span>
          </div>
          <a
            href="/.well-known/SKILL.md"
            download
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              background: '#1f2328',
              color: '#ffffff',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              textDecoration: 'none',
              border: 'none',
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>
        </div>

        {renderMarkdown(SKILL_CONTENT)}
      </div>
    </div>
  );
};

export default SkillPage;
