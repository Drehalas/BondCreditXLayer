import type { BondCreditClientConfig, AvailableCredit, CreditPosition, CreditRequest, CreditScore, Guarantee } from '../types.js';
import { clampInt, nowIso, randomId } from '../util.js';

export class CreditClient {
  constructor(private readonly cfg: BondCreditClientConfig) {}

  async getScore(): Promise<CreditScore> {
    // Scaffold default: treat the agent as reasonably healthy.
    // Replace with real indexed score retrieval when wiring to on-chain/indexer.
    return { value: 700, updatedAt: nowIso() };
  }

  async getAvailableCredit(currency?: string): Promise<AvailableCredit> {
    // Scaffold default: provide a large allowance.
    // Real implementation should query ProgressiveLimits / outstanding position.
    const cur = currency ?? 'OKB';
    return { value: 1_000, currency: cur, updatedAt: nowIso() };
  }

  async request(amount: string, purpose?: string): Promise<CreditRequest> {
    const guarantee: Guarantee = {
      id: randomId('g'),
      agentId: this.cfg.agentId,
      amount,
      currency: amount.split(' ').at(1) ?? 'XLAYER',
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString()
    };

    return {
      id: randomId('cr'),
      agentId: this.cfg.agentId,
      amount,
      purpose,
      feeBps: clampInt(50, 0, 10_000),
      createdAt: nowIso(),
      guarantee
    };
  }

  async getOutstanding(): Promise<CreditPosition> {
    return {
      agentId: this.cfg.agentId,
      outstanding: '0',
      currency: 'XLAYER',
      updatedAt: nowIso()
    };
  }

  async repay(amount: string): Promise<CreditPosition> {
    return {
      agentId: this.cfg.agentId,
      outstanding: '0',
      currency: amount.split(' ').at(1) ?? 'XLAYER',
      updatedAt: nowIso()
    };
  }
}

