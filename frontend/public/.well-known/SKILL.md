# BondCredit Agent Skill

## Description

Machine-readable contract for backend automation flows: enroll identity, update profile,
apply credit with guarantee issuance, repay/settle guarantees, query subscription and pool
status, fund pool liquidity, rebalance, and retrieve risk/volatility snapshots.

## Base URL

http://localhost:3000

## Authentication

None

## Canonical Path

The canonical file path is:

Endpoint: GET /.well-known/skill.md

Compatibility alias currently exists for legacy clients:

Endpoint: GET /.well-known/SKILL.md

## Execution Notes

- Some endpoints always use backend signer IDs from env vars (subscription, guarantee, risk, rebalance).
- For `POST /credit/apply`, `recipient` defaults to `agentId` if omitted.
- Guarantee IDs and credit IDs are 32-byte hex values (`0x...`, 66 chars total).
- Manual onboarding endpoints remain unchanged and are still supported.

---

## Capabilities

### Enroll Agent Identity

Endpoint: POST /enroll

Request:
```json
{
  "walletAddress": "0x...",
  "email": "agent-operator@example.com",
  "agentName": "optional",
  "description": "optional",
  "agentType": "optional",
  "serviceUrl": "optional",
  "tools": "optional"
}
```

Response:
```json
{
  "enrolled": true,
  "agentId": 12,
  "email": "agent-operator@example.com",
  "walletAddress": "0x...",
  "agent": {
    "id": 12,
    "walletAddress": "0x..."
  },
  "credit": {
    "score": 620,
    "tier": "Growth",
    "line": "0.0500 OKB"
  },
  "message": "Enrollment complete. Download skill.md and connect it to your agent."
}
```

### Update Agent Profile

Endpoint: POST /agent/update

Request:
```json
{
  "agentId": 12,
  "agentName": "AlphaYield-v3",
  "agentType": "stablecoin",
  "email": "optional",
  "description": "optional",
  "serviceUrl": "optional",
  "tools": "optional"
}
```

Response:
```json
{
  "updated": true,
  "agentId": 12,
  "walletAddress": "0x...",
  "agent": {
    "id": 12,
    "agentName": "AlphaYield-v3"
  },
  "message": "Agent profile updated successfully."
}
```

### Retrieve Skill Contract

Endpoint: GET /.well-known/skill.md

### Autonomous Onboard + Subscribe

Endpoint: POST /autonomous/onboard-subscribe

Request:
```json
{
  "idempotencyKey": "run-20260328-001",
  "walletAddress": "0x...",
  "email": "agent-operator@example.com",
  "agentName": "AlphaYield-v3",
  "agentType": "stablecoin",
  "description": "optional",
  "serviceUrl": "optional",
  "tools": "optional",
  "subscriptionTier": "pro",
  "amount": 0.0001,
  "recipient": "0x..."
}
```

Response:
```json
{
  "workflowId": "uuid",
  "idempotencyKey": "run-20260328-001",
  "mode": "autonomous",
  "stages": {
    "enroll": { "status": "completed" },
    "profileUpdate": { "status": "completed" },
    "subscriptionDecision": { "status": "completed" },
    "creditApply": { "status": "completed" }
  },
  "finalStatus": "approved",
  "idempotentReplay": false
}
```

Replay behavior:
- Same `idempotencyKey` returns cached result with `idempotentReplay: true`.

### Credit Apply (Auto-Subscribe + Guarantee)

Endpoint: POST /credit/apply

Request:
```json
{
  "agentId": "0x...",
  "amount": 0.01,
  "recipient": "0x..."
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

### Credit Apply (Legacy Alias)

Endpoint: POST /apply

### Credit Repay

Endpoint: POST /credit/repay

Request:
```json
{
  "agentId": "0x...",
  "creditId": "0x...",
  "amount": 0.0105
}
```

### Credit Settle x402 Payload

Endpoint: POST /credit/settle

Request:
```json
{
  "agentId": "0x...",
  "creditId": "0x...",
  "x402PayloadHash": "0x..."
}
```

### Subscription Status

Endpoint: POST /subscription/status

### Subscription Subscribe

Endpoint: POST /subscription/subscribe

Request:
```json
{
  "duration": "30 days",
  "autoRenew": true
}
```

### Subscription Renew

Endpoint: POST /subscription/renew

### Issue Guarantee

Endpoint: POST /guarantee

Request:
```json
{
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

### Pool Status

Endpoint: GET /pool/status

### Pool Fund

Endpoint: POST /pool/fund

Request:
```json
{
  "agentId": "0x...",
  "amount": 0.1
}
```

### Vault Rebalance

Endpoint: POST /rebalance

Request:
```json
{
  "vaultId": "vault-001"
}
```

### Risk Score

Endpoint: POST /risk-score

### Volatility Snapshot

Endpoint: GET /volatility
