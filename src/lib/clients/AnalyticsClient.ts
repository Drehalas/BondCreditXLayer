import type { AnalyticsEvent, BondCreditClientConfig, CreditRequest } from '../types.js';
import { nowIso } from '../util.js';

export class AnalyticsClient {
  constructor(private readonly cfg: BondCreditClientConfig) {}

  async trade(credit: CreditRequest): Promise<AnalyticsEvent> {
    return { type: 'trade', timestamp: nowIso(), payload: { agentId: this.cfg.agentId, credit } };
  }

  async event(type: AnalyticsEvent['type'], payload: unknown): Promise<AnalyticsEvent> {
    return { type, timestamp: nowIso(), payload };
  }
}

