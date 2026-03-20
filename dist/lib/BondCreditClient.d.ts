import type { BondCreditClientConfig } from './types.js';
import { SubscriptionClient } from './clients/SubscriptionClient.js';
import { CreditClient } from './clients/CreditClient.js';
import { X402Client } from './clients/X402Client.js';
import { AnalyticsClient } from './clients/AnalyticsClient.js';
export declare class BondCreditClient {
    readonly config: BondCreditClientConfig;
    readonly subscription: SubscriptionClient;
    readonly credit: CreditClient;
    readonly x402: X402Client;
    readonly analytics: AnalyticsClient;
    constructor(config: BondCreditClientConfig);
}
//# sourceMappingURL=BondCreditClient.d.ts.map