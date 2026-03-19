import type { BondCreditClientConfig } from './types.js';
import { SubscriptionClient } from './clients/SubscriptionClient.js';
import { CreditClient } from './clients/CreditClient.js';
import { X402Client } from './clients/X402Client.js';
import { AnalyticsClient } from './clients/AnalyticsClient.js';

export class BondCreditClient {
  public readonly subscription: SubscriptionClient;
  public readonly credit: CreditClient;
  public readonly x402: X402Client;
  public readonly analytics: AnalyticsClient;

  constructor(public readonly config: BondCreditClientConfig) {
    this.subscription = new SubscriptionClient(config);
    this.credit = new CreditClient(config);
    this.x402 = new X402Client(config, {
      subscription: this.subscription,
      credit: this.credit
    });
    this.analytics = new AnalyticsClient(config);
  }
}

