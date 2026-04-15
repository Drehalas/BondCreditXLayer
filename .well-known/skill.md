# BondCredit Agent Skill

## Description

Machine-readable contract for backend automation flows: enroll identity, update profile,
apply credit with guarantee issuance, repay/settle guarantees, execute Uniswap-style
trades through a server adapter, index score/unlock events, query subscription/pool state,
fund pool liquidity, rebalance, and retrieve risk/volatility snapshots.

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
- Trade execution is server-side and tied to the enrolled agent wallet.
- Score rule is deterministic for hackathon mode: successful trade `+1`, failed trade `-1`.
- Unlock rules: credit line unlock at score `>= 10`; bonus `$100` unlock at 5 successful trades.
- Manual onboarding endpoints remain unchanged and are still supported.
- `POST /agent/subscribe` is for agent-only backend subscription via OKX-managed wallet; manual user wallet flow is unchanged.
- Agent subscription activation is persisted only after on-chain transaction verification succeeds.

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

### Unified Swap Flow

#### Trade Tokens Catalog

Endpoint: GET /tokens

Compatibility alias: GET /trade/tokens

Returns tokens from backend static token-list JSON (`server/data/uniswap-token-list.json`).
List is filtered by env scope via `BONDCREDIT_TOKEN_LIST_SCOPE` (`mainnet` or `testnet`).
If the source file contains chain metadata instead of token-contract entries, API returns warnings and a `chainCatalogPreview`.

Response:
```json
{
  "network": "xlayer-testnet",
  "count": 4,
  "tokens": [
    {
      "symbol": "OKB",
      "name": "OKB",
      "address": "0x...",
      "decimals": 18,
      "isStable": false,
      "enabled": true
    }
  ],
  "tradablePairs": [
    {
      "pair": "OKB/USDT",
      "tokenIn": { "symbol": "OKB", "address": "0x...", "decimals": 18 },
      "tokenOut": { "symbol": "USDT", "address": "0x...", "decimals": 6 }
    }
  ]
}
```

#### Quote Swap

Endpoint: GET /quote

Query:
```text
tokenIn=0x...&tokenOut=0x...&amount=100&userAddress=0x...
```

Response:
```json
{
  "pair": "USDC/ETH",
  "tokenIn": "USDC",
  "tokenOut": "ETH",
  "amount": 100,
  "expectedOutput": "0.03",
  "priceImpact": "0.2%",
  "route": { }
}
```

#### Build Swap Transaction

Endpoint: GET /build-tx

Query:
```text
tokenIn=0x...&tokenOut=0x...&amount=100&userAddress=0x...
```

Response:
```json
{
  "pair": "USDC/ETH",
  "tokenIn": "USDC",
  "tokenOut": "ETH",
  "amount": 100,
  "to": "0xRouter",
  "data": "0xabc...",
  "value": "0x0"
}
```

#### Store Manual Transaction

Endpoint: POST /store-transaction

Compatibility alias: POST /trade/record

Request:
```json
{
  "txHash": "0x...",
  "userId": "0x...",
  "pair": "USDC/ETH",
  "side": "BUY",
  "amount": 100,
  "metadata": {
    "expectedToAddress": "0xRouter",
    "expectedValueWei": "0",
    "expectedData": "0x..."
  }
}
```

Response:
```json
{
  "recorded": true,
  "trade": {
    "id": 101,
    "pair": "USDC/ETH",
    "side": "BUY",
    "amount": 100,
    "status": "SUCCESS",
    "txHash": "0x...",
    "executedAt": "ISO-8601"
  }
}
```

#### Execute Agent Trade

Endpoint: POST /execute-trade

Compatibility alias: POST /trade/execute

Request:
```json
{
  "agentId": 12,
  "tokenIn": "USDC",
  "tokenOut": "ETH",
  "amount": 100,
  "slippageBps": 50,
  "idempotencyKey": "trade-2026-04-14-001"
}
```

Response:
```json
{
  "executed": true,
  "venue": "okx-dex",
  "trade": {
    "id": 101,
    "pair": "USDC/ETH",
    "side": "BUY",
    "amount": 100,
    "status": "SUCCESS",
    "txHash": "0x...",
    "executedAt": "ISO-8601"
  },
  "score": {
    "before": 9,
    "after": 10,
    "delta": 1,
    "successfulTrades": 5,
    "failedTrades": 1
  }
}
```

Notes:
- OKX builds the transaction, your backend or wallet signs it depending on the flow.
- Manual flow signs in the frontend and then stores the transaction for backend verification.
- Agent flow uses backend execution and score updates after verification.

### Score Status

Endpoint: GET /score/status/:agentId

Response:
```json
{
  "agentId": 12,
  "walletAddress": "0x...",
  "score": 10,
  "successfulTrades": 5,
  "failedTrades": 1,
  "unlocks": {
    "creditLineUnlocked": true,
    "bonusUsd100Unlocked": true
  },
  "updatedAt": "ISO-8601"
}
```

### Trade History

Endpoint: GET /trades/history/:agentId?limit=20

Endpoint: GET /trades/history/:agentId

### Unlock Milestones

Endpoint: GET /unlocks/:agentId

### Demo Run: 3 Trades (Replay-safe)

Endpoint: POST /demo/run-3-trades

Request:
```json
{
  "agentId": 12,
  "idempotencyKey": "demo-2026-04-11-001"
}
```

Response:
```json
{
  "demoRun": true,
  "idempotencyKey": "demo-2026-04-11-001",
  "idempotentReplay": false,
  "executedTrades": 3,
  "evidence": [
    {
      "label": "trade-1-success",
      "tradeId": 201,
      "pair": "OKB/USDT",
      "side": "BUY",
      "amount": 10,
      "status": "SUCCESS",
      "txHash": "0x...",
      "scoreBefore": 0,
      "scoreAfter": 1,
      "delta": 1,
      "newlyUnlocked": []
    }
  ],
  "score": {
    "creditScore": 1,
    "successfulTrades": 1,
    "failedTrades": 0,
    "creditLineUnlocked": false,
    "bonusUsd100Unlocked": false
  },
  "unlockEvents": []
}
```

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

### Agent Subscribe (OKX-managed backend signing)

Endpoint: POST /agent/subscribe

Request:
```json
{
  "agentId": "0x..."
}
```

Response:
```json
{
  "status": "SUCCESS",
  "txHash": "0x...",
  "agentId": "0x..."
}
```

Notes:
- Uses the same on-chain `SubscriptionManager.subscribe()` function as manual subscriptions.
- Backend submits transaction through OKX-managed wallet integration and verifies tx on-chain before marking ACTIVE.
- `agentId` is the agent wallet address.

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
