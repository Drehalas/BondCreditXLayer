import type {
  BondCreditClientConfig,
  CheckStatusResult,
  SubscribeInput,
  SubscribeResult,
  SubscriptionStatus
} from '../types.js';
import { randomHex } from '../util.js';
import {
  dateOnlyFromUnixSec,
  daysFromDuration,
  formatWeiAmount,
  getSubscriptionReadContract,
  getSubscriptionWriteContract,
  hasSubscriptionContract,
  resolveAgentAddress
} from '../onchain.js';

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
   * Uses on-chain mode when configured, otherwise falls back to scaffold mode.
   */
  async subscribe(input: SubscribeInput = { duration: '30 days', autoRenew: true }): Promise<SubscribeResult> {
    if (hasSubscriptionContract(this.cfg)) {
      const days = daysFromDuration(input.duration ?? '30 days');
      const read = getSubscriptionReadContract(this.cfg);
      const write = getSubscriptionWriteContract(this.cfg);

      if (!read || !write) {
        throw new Error('On-chain subscription mode requires rpcUrl, contract address, and privateKey');
      }

      const pricePerDayWei = (await read.pricePerDayWei()) as bigint;
      const total = pricePerDayWei * BigInt(days);

      const tx = await write.subscribe(days, { value: total });
      await tx.wait();

      const status = await this.checkStatus();
      return {
        status: status.active ? 'active' : 'inactive',
        expiry: status.expiryDate ?? new Date().toISOString().slice(0, 10),
        txHash: tx.hash,
        amount: formatWeiAmount(total)
      };
    }

    const duration = input.duration ?? '30 days';
    const days = daysFromDuration(duration);
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
    if (hasSubscriptionContract(this.cfg)) {
      const read = getSubscriptionReadContract(this.cfg);
      const agent = resolveAgentAddress(this.cfg);
      if (!read || !agent) {
        throw new Error('On-chain subscription mode requires a resolvable agent address');
      }

      const [active, expiryDate, daysLeft, paymentCount] = await read.checkStatus(agent);
      return {
        active: Boolean(active),
        expiryDate: Number(expiryDate) > 0 ? dateOnlyFromUnixSec(expiryDate) : undefined,
        daysLeft: Number(daysLeft),
        paymentsMade: Number(paymentCount)
      };
    }

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
    if (hasSubscriptionContract(this.cfg)) {
      const read = getSubscriptionReadContract(this.cfg);
      const write = getSubscriptionWriteContract(this.cfg);
      if (!read || !write) {
        throw new Error('On-chain renew requires rpcUrl, contract address, and privateKey');
      }

      const days = 30;
      const pricePerDayWei = (await read.pricePerDayWei()) as bigint;
      const total = pricePerDayWei * BigInt(days);

      const tx = await write.renew(days, { value: total });
      await tx.wait();

      const status = await this.checkStatus();
      return {
        status: status.active ? 'active' : 'inactive',
        expiry: status.expiryDate ?? new Date().toISOString().slice(0, 10),
        txHash: tx.hash,
        amount: formatWeiAmount(total)
      };
    }

    // Scaffold fallback: renew for 30 days from now.
    return this.subscribe({ duration: '30 days', autoRenew: true });
  }
}

