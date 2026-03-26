# BondCredit Agent

## Description

BondCredit backend skill for automated agent execution: enroll identity, manage subscription state, apply and repay credit, issue guarantees, and monitor pool/risk endpoints.

## Base URL

http://localhost:3000

## Authentication

None

---

## Execution Modes

- Agent mode (this skill): call backend endpoints only.
- Wallet-signed mode: available in web UI and signs transactions directly from the connected wallet.

Use this skill for agent/backend automation flows.

---

## Capabilities

### Enrollment: Enroll Agent Identity

Endpoint: POST /enroll

Request:
```json
{
  "agentId": "string",
  "email": "agent@domain.com"
}
```

Response:
```json
{
  "enrolled": true,
  "agentId": "string",
  "email": "agent@domain.com",
  "walletAddress": "0x...",
  "subscription": {
    "active": true,
    "expiryDate": "YYYY-MM-DD",
    "daysLeft": 30,
    "paymentsMade": 1
  },
  "credit": {
    "score": 620,
    "tier": "Growth",
    "line": "0.0500 OKB"
  },
  "message": "Enrollment complete. Download skill.md and connect it to your agent."
}
```

---

### Install: Retrieve Agent Skill

Endpoint: GET /.well-known/skill.md

---

### Credit: Apply (Auto-Subscribe + Guarantee)

Endpoint: POST /credit/apply

Request:
```json
{
  "agentId": "string",
  "recipient": "0x...",
  "amount": 0.01
}
```

Response (approved):
```json
{
  "approved": true,
  "subscribedNow": false,
  "score": {
    "value": 606,
    "tier": "Growth",
    "updatedAt": "ISO-8601"
  },
  "limit": {
    "current": "0.0494 OKB",
    "used": "0.0101 OKB",
    "available": "0.0393 OKB",
    "nextTier": "0.0618 OKB"
  },
  "guarantee": {
    "guaranteeId": "0x...",
    "proof": "0x...",
    "expiresAt": "ISO-8601"
  }
}
```

Response (rejected):
```json
{
  "approved": false,
  "reason": "Insufficient liquidity in guarantor pool (...)",
  "subscribedNow": false,
  "score": {
    "value": 606,
    "tier": "Growth",
    "updatedAt": "ISO-8601"
  },
  "limit": {
    "current": "0.0494 OKB",
    "used": "0.0101 OKB",
    "available": "0.0393 OKB",
    "nextTier": "0.0618 OKB"
  }
}
```

---

### Credit: Repay and Grow

Endpoint: POST /credit/repay

Request:
```json
{
  "agentId": "string",
  "creditId": "0x...",
  "amount": 0.0105
}
```

---

### Credit: Settle x402 Payload

Endpoint: POST /credit/settle

Request:
```json
{
  "agentId": "string",
  "creditId": "0x...",
  "x402PayloadHash": "0x..."
}
```

---

### Subscription: Check Status

Endpoint: POST /subscription/status

Request:
```json
{
  "agentId": "string"
}
```

---

### Subscription: Subscribe

Endpoint: POST /subscription/subscribe

Request:
```json
{
  "agentId": "string",
  "duration": "30 days",
  "autoRenew": true
}
```

---

### Subscription: Renew

Endpoint: POST /subscription/renew

Request:
```json
{
  "agentId": "string"
}
```

---

### Guarantee: Issue Credit Guarantee

Endpoint: POST /guarantee

Request:
```json
{
  "agentId": "string",
  "recipient": "0x...",
  "amount": 0.1,
  "service": "premium-price-feed",
  "endpoint": "https://api.data.com/x402",
  "purpose": "Guarantee tab request"
}
```

Response (approved):
```json
{
  "guaranteeId": "0x...",
  "proof": "0x...",
  "expiresAt": "ISO-8601",
  "service": "premium-price-feed",
  "endpoint": "https://api.data.com/x402",
  "purpose": "Guarantee tab request",
  "subscribedNow": false,
  "status": "approved"
}
```

Response (rejected):
```json
{
  "guaranteeId": "",
  "status": "rejected",
  "reason": "..."
}
```

---

### Pool: Status

Endpoint: GET /pool/status

---

### Pool: Fund

Endpoint: POST /pool/fund

Request:
```json
{
  "agentId": "string",
  "amount": 0.1
}
```

---

### Vault: Rebalance

Endpoint: POST /rebalance

Request:
```json
{
  "vaultId": "string"
}
```

---

### Risk: Score

Endpoint: POST /risk-score

Request:
```json
{
  "agentId": "string"
}
```

---

### Analytics: Volatility

Endpoint: GET /volatility
