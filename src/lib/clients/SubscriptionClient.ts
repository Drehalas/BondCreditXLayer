import type { BondCreditClientConfig, SubscriptionStatus } from '../types.js';
import { nowIso } from '../util.js';

export class SubscriptionClient {
  constructor(private readonly cfg: BondCreditClientConfig) {}

  async check(): Promise<SubscriptionStatus> {
    return { active: false };
  }

  async subscribe(): Promise<SubscriptionStatus> {
    return {
      active: true,
      startedAt: nowIso(),
      renewsAt: nowIso(),
      plan: 'daily'
    };
  }
}

