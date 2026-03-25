# BondCredit Agent

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
```json
{
  "agentId": "string",
  "email": "agent@domain.com",
  "walletAddress": "0x..."
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
```

Error Response:
```json
{
  "error": "email or walletAddress is required"
}
```

---

### Install: Retrieve Agent Skill

Download the skill file that your external agent uses for capability discovery.

Endpoint: GET /.well-known/skill.md

Request:
```json
{}
```

Response:
```json
{
  "contentType": "text/markdown",
  "body": "# BondCredit Agent ..."
}
```

---

### Apply: Autonomous Credit Application

Run subscription bootstrap, risk/eligibility checks, credit request, and x402 guarantee issuance.

Endpoint: POST /credit/apply

Request:
```json
{
  "agentId": "string",
  "amount": 0.1,
  "recipient": "0x...",
  "service": "autonomous-credit-execution",
  "endpoint": "bondcredit://credit/apply",
  "purpose": "arbitrage"
}
```

Response (Approved):
```json
{
  "approved": true,
  "subscribedNow": true,
  "score": {
    "value": 700,
    "tier": "Prime",
    "updatedAt": "ISO-8601"
  },
  "limit": {
    "current": "0.5000 XLAYER",
    "used": "0.0000 XLAYER",
    "available": "0.5000 XLAYER",
    "nextTier": "0.5500 XLAYER"
  },
  "approval": {
    "approved": true,
    "creditId": "cred_xxx",
    "amount": "0.1 OKB",
    "fee": "0.000050 OKB",
    "deadline": "ISO-8601"
  },
  "guarantee": {
    "guaranteeId": "guar_xxx",
    "proof": "0x...",
    "expiresAt": "ISO-8601"
  }
}
```

Response (Rejected):
```json
{
  "approved": false,
  "reason": "Credit score too low",
  "subscribedNow": true,
  "score": {
    "value": 480,
    "tier": "Starter",
    "updatedAt": "ISO-8601"
  },
  "limit": {
    "current": "0.1200 XLAYER",
    "used": "0.0000 XLAYER",
    "available": "0.1200 XLAYER",
    "nextTier": "0.1600 XLAYER"
  }
}
```

Error Response:
```json
{
  "error": "recipient is required and must be a valid EVM address"
}
```

---

### Rewards: Repay and Grow

Submit repayment and receive score/credit-line growth snapshot.

Endpoint: POST /credit/repay

Request:
```json
{
  "agentId": "string",
  "creditId": "cred_xxx",
  "amount": 0.0105
}
```

Response:
```json
{
  "success": true,
  "repayment": {
    "success": true,
    "newScore": 705,
    "txHash": "0x..."
  },
  "growth": {
    "scoreBefore": 700,
    "scoreAfter": 705,
    "lineBefore": "0.5000 XLAYER",
    "lineAfter": "0.5500 XLAYER"
  }
}
```

---

### Subscription: Check Monitoring Status

Check whether the agent is actively subscribed for monitoring and credit protection.

Endpoint: POST /subscription/status

Request:
```json
{
  "agentId": "string"
}
```

Response:
```json
{
  "subscription": {
    "active": true,
    "expiryDate": "YYYY-MM-DD",
    "daysLeft": 30,
    "paymentsMade": 1
  }
}
```

---

### Risk: Assess Risk Score

Get the current credit risk score for a specific agent.

Endpoint: POST /risk-score

Request:
```json
{
  "agentId": "string"
}
```

Response:
```json
{
  "riskScore": 0
}
```

Error Response:
```json
{
  "error": "agentId is required"
}
```

---

### Guarantee: Issue Credit Guarantee

Approve or reject a payment guarantee for an agent amount request.

Endpoint: POST /guarantee

Request:
```json
{
  "agentId": "string",
  "amount": 0.1
}
```

Response (Approved):
```json
{
  "guaranteeId": "string",
  "status": "approved"
}
```

Response (Rejected):
```json
{
  "guaranteeId": "",
  "status": "rejected"
}
```

Error Response:
```json
{
  "error": "amount must be a positive number"
}
```

---

### Vault: Rebalance Vault

Trigger a vault rebalance compatibility operation.

Endpoint: POST /rebalance

Request:
```json
{
  "vaultId": "string"
}
```

Response:
```json
{
  "status": "success"
}
```

Error Response:
```json
{
  "error": "vaultId is required"
}
```

---

### Analytics: Get Volatility

Get 30-day score volatility derived from analytics history.

Endpoint: GET /volatility

Request:
```json
{}
```

Response:
```json
{
  "volatility": 0.1234
}
```
