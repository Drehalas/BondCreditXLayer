import type {
  BondCreditClientConfig,
  AvailableCredit,
  X402GuaranteeRequest,
  X402GuaranteeResponse,
  X402GuaranteeStatus,
} from '../types.js';
import {
  CreditScoreTooLowError,
  GuaranteeNotFoundError,
  InsufficientCreditError,
  SubscriptionInactiveError
} from '../errors.js';
import { parseAmount, randomHex, nowIso } from '../util.js';

type SubscriptionLike = {
  check(): Promise<{ active: boolean }>;
};

type CreditLike = {
  getScore(): Promise<{ value: number; updatedAt: string }>;
  getAvailableCredit(currency?: string): Promise<AvailableCredit>;
};

export class X402Client {
  private readonly guaranteeState = new Map<
    string,
    { req: X402GuaranteeRequest; res: X402GuaranteeResponse; status: X402GuaranteeStatus }
  >();

  constructor(
    private readonly cfg: BondCreditClientConfig,
    private readonly deps: { subscription: SubscriptionLike; credit: CreditLike }
  ) {}

  async guaranteePayment(input: X402GuaranteeRequest): Promise<X402GuaranteeResponse> {
    const subscription = await this.deps.subscription.check();
    if (!subscription.active) throw new SubscriptionInactiveError('Active subscription required');

    const score = await this.deps.credit.getScore();
    if (score.value <= 500) throw new CreditScoreTooLowError('Credit score must be > 500');

    const { value: amountValue, currency } = parseAmount(input.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      throw new InsufficientCreditError('Invalid amount');
    }

    const available = await this.deps.credit.getAvailableCredit(currency);
    if (available.value < amountValue) throw new InsufficientCreditError('Available credit is insufficient');

    const guaranteeId = 'guar_' + randomHex(12).slice(2);
    const expiresAt = new Date(Date.now() + 25 * 60_000).toISOString();
    const proof = randomHex(32);

    const x402Payload = {
      amount: input.amount,
      recipient: input.recipient,
      guarantor: '0xBondCredit...'
    };

    const res: X402GuaranteeResponse = {
      guaranteeId,
      proof,
      expiresAt,
      x402Payload
    };

    const status: X402GuaranteeStatus = {
      active: true,
      used: false,
      expiresIn: '25 minutes'
    };

    this.guaranteeState.set(guaranteeId, { req: input, res, status });
    return res;
  }

  async checkGuarantee(guaranteeId: string): Promise<X402GuaranteeStatus> {
    const record = this.guaranteeState.get(guaranteeId);
    if (!record) {
      // For scaffolding, treat unknown as inactive + not used.
      return { active: false, used: false, expiresIn: '0 minutes', cancelled: true };
    }
    // Expiry isn't enforced yet; update expiresIn to something stable.
    return record.status;
  }

  async cancelGuarantee(guaranteeId: string): Promise<{ ok: true }> {
    const record = this.guaranteeState.get(guaranteeId);
    if (!record) throw new GuaranteeNotFoundError('Guarantee not found');
    record.status.active = false;
    record.status.cancelled = true;
    this.guaranteeState.set(guaranteeId, record);
    return { ok: true };
  }
}

