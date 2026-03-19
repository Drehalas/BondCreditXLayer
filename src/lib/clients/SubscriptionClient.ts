import type {
  BondCreditClientConfig,
  CheckStatusResult,
  SubscribeInput,
  SubscribeResult,
  SubscriptionStatus
} from '../types.js';
import { nowIso, randomHex } from '../util.js';

export class SubscriptionClient {
  private expiryMs: number | null = null;
  private paymentsMade = 0;

  constructor(private readonly cfg: BondCreditClientConfig) {}

  async check(): Promise<SubscriptionStatus> {
    const status = await this.checkStatus();
    return { active: status.active, expiryDate: status.expiryDate };
  }

  /**
   * Subscribe to credit monitoring via x402 microtransaction.
   * This is scaffold-only; replace with on-chain/indexer calls later.
   */
  async subscribe(input: SubscribeInput = { duration: '30 days', autoRenew: true }): Promise<SubscribeResult> {
    const duration = input.duration ?? '30 days';
    const days = this.parseDays(duration);
    const startedAt = Date.now();
    const expiryMs = startedAt + days * 24 * 60 * 60 * 1000;

    this.expiryMs = expiryMs;
    this.paymentsMade += 1;

    // Example in spec shows `0.001 OKB`; scaffold keeps it stable per subscription action.
    const amount = '0.001 OKB';
    const txHash = randomHex(32);

    return {
      status: 'active',
      expiry: new Date(expiryMs).toISOString().slice(0, 10),
      txHash,
      amount
    };
  }

  async checkStatus(): Promise<CheckStatusResult> {
    if (!this.expiryMs) {
      return { active: false, daysLeft: 0, paymentsMade: this.paymentsMade };
    }

    const now = Date.now();
    const active = this.expiryMs > now;
    const daysLeft = active ? Math.ceil((this.expiryMs - now) / (24 * 60 * 60 * 1000)) : 0;

    return {
      active,
      expiryDate: new Date(this.expiryMs).toISOString().slice(0, 10),
      daysLeft,
      paymentsMade: this.paymentsMade
    };
  }

  async renew(): Promise<SubscribeResult> {
    // Scaffold: renew for 30 days from now.
    return this.subscribe({ duration: '30 days', autoRenew: true });
  }

  private parseDays(duration: string): number {
    // Accept patterns like "30 days" or "12 day".
    const match = duration.toLowerCase().match(/(\d+)\s*day/);
    const d = match ? Number(match[1]) : 30;
    return Math.max(1, Math.trunc(d));
  }
}

