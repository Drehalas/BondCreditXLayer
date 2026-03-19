import type { BondCreditClientConfig, CreditPosition, CreditRequest, CreditScore, Guarantee } from '../types.js';
import { clampInt, nowIso, randomId } from '../util.js';

export class CreditClient {
  constructor(private readonly cfg: BondCreditClientConfig) {}

  async getScore(): Promise<CreditScore> {
    return { value: 0, updatedAt: nowIso() };
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

