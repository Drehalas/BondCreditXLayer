# BondCredit: Progressive Credit Lines for AI Agents

[![OKX XLayer Hackathon](https://img.shields.io/badge/OKX-XLayer%20Hackathon-000000?style=flat-square)](https://www.okx.com/xlayer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![x402 Protocol](https://img.shields.io/badge/x402-Ready-blueviolet)](https://github.com/okx/onchainos-skills)

BondCredit is the first credit protocol purpose-built for AI agents on X Layer. We enable autonomous agents to build on-chain reputation and access progressive credit lines through a simple subscription model.

## 🌟 The Problem

AI agents are the fastest-growing participants in Web3, yet they face a fundamental limitation:

- **Agents need capital** to access data, APIs, compute, and services
- **Agents have 0 balance** at any given moment
- **No credit infrastructure exists** for autonomous agents
- Flash loans are too short (seconds); traditional loans require humans

**Result:** Agents miss opportunities while funds sit idle elsewhere.

## 💡 The Solution: BondCredit

BondCredit introduces **Progressive Credit Lines**—revolving credit that grows with agent reputation.

### How It Works

1. **Subscribe** → Agent pays 0.001 XLAYER/day via x402
2. **Get Monitored** → We index all on-chain activity on X Layer
3. **Receive Score** → Credit score generated from real behavior
4. **Access Credit** → Use credit line for data, APIs, services
5. **Repay & Grow** → On-time repayment → Score ↑ → Credit Line ↑



## 🔷 Built on X Layer

BondCredit is built natively on **X Layer**, OKC's Ethereum L2 powered by the Optimism Stack. We leverage:

- **Full EVM Equivalence** → Deploy without modifications
- **5,000 TPS & Negligible Fees** → Perfect for agent microtransactions
- **99.9% Uptime** → Enterprise-grade reliability
- **OKB Gas Token** → Unified ecosystem currency
- **x402 Protocol Support** → Native agentic payments

> **Learn more about building on X Layer:** [X Layer Documentation](https://web3.okx.com/tr/xlayer/docs/developer/build-on-xlayer/about-xlayer)

##  Demo: Progressive Credit in Action

### Agent A (TraderBot)
- **Balance:** 0 XLAYER
- **Credit Score:** 700
- **Credit Line:** 0.5 XLAYER
Arbitrage opportunity detected (needs 0.1 XLAYER)

Requests credit → Approved (score: 700)

Buys data via x402 (guaranteed by BondCredit)

Executes trade → Profits 0.05 XLAYER

Repays 0.0105 XLAYER (principal + 0.5% fee)

Score updates: 700 → 705

Credit line grows: 0.5 → 0.55 XLAYER



### Agent B (NewBot)
- **Balance:** 1 XLAYER
- **Credit Score:** 0 (no subscription)
Trades without credit protection

Pays 0.01 XLAYER for data (out of pocket)

Trade fails due to slippage

Loses 0.01 XLAYER

Immediately subscribes to BondCredit

"Monitoring started. Score in 7 days."



## 🛠️ Technology Stack

- **Smart Contracts:** Solidity (EVM-equivalent on X Layer)
- **Indexing:** SubQuery (X Layer support)
- **Frontend:** React + ethers.js + MetaMask
- **Payments:** x402 Protocol (Onchain OS)
- **Infrastructure:** X Layer RPC, QuickNode

## 🚀 Getting Started

### Prerequisites
- MetaMask with X Layer network configured
- Test OKB from X Layer faucet
- Node.js v16+

### Installation

```bash
# Clone repository
git clone https://github.com/bondcredit/xlayer.git
cd bondcredit-xlayer

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Add your private key, RPC URLs, etc.

# Deploy contracts
npx hardhat run scripts/deploy.js --network xlayer

# Start SubQuery indexer
cd subquery
yarn install
yarn start:docker

# Run frontend
cd ../frontend
npm start
Smart Contract Deployment (X Layer Testnet)
solidity
// Network: X Layer Testnet
// Chain ID: 195
// RPC: https://testrpc.xlayer.tech

npx hardhat run scripts/deploy.js --network xlayerTestnet
```


### Smart Contract Overview

SubscriptionManager.sol

solidity

function subscribe() external payable;
function checkSubscription(address agent) external view returns (bool);
function getSubscriptionHistory(address agent) external view returns (uint256[] memory);
CreditScoreEngine.sol

solidity

function getCreditScore(address agent) external view returns (uint256);
function getCreditLimit(address agent) external view returns (uint256);
function updateScore(address agent, uint256 newScore) external onlyOracle;
PaymentGuarantor.sol

solidity

function guaranteePayment(address agent, uint256 amount) external returns (bool);
function repayCredit(address agent) external payable;
function getOutstandingCredit(address agent) external view returns (uint256);
ProgressiveLimits.sol

solidity

function calculateProgressiveLimit(address agent) external view returns (uint256);
function recordRepayment(address agent, uint256 amount, uint256 timeToRepay) external;

 Credit Scoring Algorithm
The credit score (0-1000) is calculated based on:

Factor	Weight	Source
Subscription history	25%	SubscriptionManager
x402 payment reliability	30%	Indexed transaction data
Transaction volume	15%	SubQuery
Interaction diversity	10%	SubQuery
Repayment speed	15%	PaymentGuarantor
Cross-agent references	5%	Custom vouching system
Progressive Formula:


creditLine = (baseScore * activityMultiplier) / 1000
activityMultiplier = min(1 + (transactionCount / 500), 3)

🔗 Key Links
X Layer Documentation: https://web3.okx.com/tr/xlayer/docs/developer/build-on-xlayer/about-xlayer

X Layer RPC: https://rpc.xlayer.tech

X Layer Testnet RPC: https://testrpc.xlayer.tech

Onchain OS Skills: https://github.com/okx/onchainos-skills

x402 Protocol: https://github.com/okx/onchainos-skills/tree/main/skills/x402

SubQuery for X Layer: https://academy.subquery.net/

🏆 OKX XLayer Hackathon
Track: AI Agent Playground / Agentic Payments
Phase 1 Timeline: Mar 12-26, 2026
Transaction Hash: 0x...[submitted after deployment]

Judging Criteria Addressed
✅ Deep AI Agent Integration → Agents autonomously subscribe, request, repay
✅ Autonomous Payment Flow → x402 + credit guarantees
✅ Multi-Agent Collaboration → Agents vouch, refer, learn from each other
✅ X Layer Impact → Drives x402 volume, new agent primitives

Special Prize Targets
Best in Agentic Payments (x402 subscription model)

Most Innovative (first credit protocol for agents)

Highest Potential for Integration (infrastructure play)

👥 Team: bond.credit
We're building the financial infrastructure for the autonomous economy.

GitHub: @bondcredit

X (Twitter): @bondcredit

Email: team@bondcredit.xyz

📄 License
MIT
