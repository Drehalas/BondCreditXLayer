import React from 'react';

const SKILL_CONTENT = `# BondCredit Agent Skill

## Description

Machine-readable contract for backend automation flows: enroll identity, update profile, apply credit, repay guarantees, and execute autonomous trades on Uniswap V3. Designed for AI agent ingestion.

## Base URL

https://api.bond.credit

## Authentication

None

---

## Agent Economy Loop

1. **Enroll**: Link wallet to BondCredit identity.
2. **Execute**: Trade on Uniswap V3 via the execution endpoint.
3. **Analyze**: Backend verifies transaction success and evaluates profitability.
4. **Scoring**: Successful/Profitable trades add +1 to your credit score.
5. **Unlock**: Score milestones automatically unlock higher credit lines.

---

## Capabilities

### Enrollment: Enroll Agent Identity

Enroll an agent using email or wallet and retrieve current score and line snapshot.

Endpoint: POST /enroll

Request:
\`\`\`json
{
  "walletAddress": "0x...",
  "email": "agent@domain.com",
  "agentName": "Alpha-Agent-v1"
}
\`\`\`

Response:
\`\`\`json
{
  "enrolled": true,
  "agentId": 12,
  "credit": {
    "score": 0,
    "tier": "Standard",
    "line": "0.0100 OKB"
  }
}
\`\`\`

---

### Trading: Unified Swap Flow (Uniswap V3)

#### 1. Discovery: Trade Tokens Catalog

Retrieve supported tokens and high-liquidity pairs.

Endpoint: GET /tokens

Response:
\`\`\`json
{
  "network": "xlayer-mainnet",
  "count": 12,
  "tokens": [
    { "symbol": "ETH", "address": "0x...", "decimals": 18 },
    { "symbol": "USDC", "address": "0x...", "decimals": 6 }
  ],
  "tradablePairs": [
    { "pair": "ETH/USDC", "tokenIn": { "symbol": "ETH" }, "tokenOut": { "symbol": "USDC" } }
  ]
}
\`\`\`

#### 2. Pricing: Swap Quote

Fetch expect output and price impact data.

Endpoint: GET /quote

Request:
\`\`\`json
{
  "tokenIn": "ETH",
  "tokenOut": "USDC",
  "amount": 1,
  "userAddress": "0x..."
}
\`\`\`

Response:
\`\`\`json
{
  "pair": "ETH/USDC",
  "amount": 1,
  "expectedOutput": "2450.50",
  "priceImpact": "0.05%",
  "route": { "protocol": "Uniswap V3" }
}
\`\`\`

#### 3. Execution: Build Swap Transaction

Generate encoded calldata payload for on-chain execution.

Endpoint: GET /build-tx

Request:
\`\`\`json
{
  "tokenIn": "ETH",
  "tokenOut": "USDC",
  "amount": 1,
  "userAddress": "0x..."
}
\`\`\`

Response:
\`\`\`json
{
  "to": "0xRouter",
  "data": "0x...",
  "value": "1000000000000000000",
  "gasLimit": "250000"
}
\`\`\`

#### 4. Verification: Store Manual Transaction

Record a manually signed transaction for credit scoring.

Endpoint: POST /store-transaction

Request:
\`\`\`json
{
  "txHash": "0x...",
  "userId": "0x...",
  "pair": "ETH/USDC",
  "side": "BUY",
  "amount": 1
}
\`\`\`

Response:
\`\`\`json
{ "recorded": true, "tradeId": 105, "status": "PENDING" }
\`\`\`

#### 5. Autonomous: Execute Agent Trade

Directly execute a swap using the agent's registered credentials.

Endpoint: POST /execute-trade

Request:
\`\`\`json
{
  "agentId": 12,
  "tokenIn": "ETH",
  "tokenOut": "USDC",
  "amount": 1,
  "slippageBps": 50,
  "idempotencyKey": "unique-task-id"
}
\`\`\`

Response:
\`\`\`json
{
  "executed": true,
  "venue": "okx-dex",
  "trade": {
    "txHash": "0x...",
    "status": "SUCCESS"
  },
  "score": { "before": 9, "after": 10, "delta": 1 }
}
\`\`\`

---

### Credit: Autonomous Application (x402)

Run risk checks, application, and x402 guarantee issuance in one flow.

Endpoint: POST /credit/apply

Request:
\`\`\`json
{
  "agentId": 12,
  "amount": 0.1,
  "recipient": "0x...",
  "purpose": "yield-strategy"
}
\`\`\`

Response:
\`\`\`json
{
  "approved": true,
  "score": { "value": 700, "tier": "Prime" },
  "guarantee": { "guaranteeId": "guar_xxx", "proof": "0x..." }
}
\`\`\`

---

### Rewards: Repay and Grow

Submit repayment to improve score and unlock limits.

Endpoint: POST /credit/repay

Request:
\`\`\`json
{
  "agentId": 12,
  "creditId": "0x...",
  "amount": 0.105
}
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "growth": { "scoreAfter": 705, "lineAfter": "0.5500 XLAYER" }
}
\`\`\`

---

### Governance & Risk

Assess score, history, rebalance vaults, and fetch volatility.

Endpoint: GET /score/status/:agentId

Endpoint: GET /trades/history/:agentId

Endpoint: POST /risk-score

Endpoint: POST /rebalance

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
