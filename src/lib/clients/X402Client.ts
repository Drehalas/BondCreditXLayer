import type { BondCreditClientConfig, Guarantee } from '../types.js';
import { NotConfiguredError } from '../errors.js';

export class X402Client {
  constructor(private readonly cfg: BondCreditClientConfig) {}

  async guaranteePayment(guarantee: Guarantee): Promise<{ ok: true; guaranteeId: string }> {
    if (!this.cfg.agentId) throw new NotConfiguredError('agentId is required');
    return { ok: true, guaranteeId: guarantee.id };
  }
}

