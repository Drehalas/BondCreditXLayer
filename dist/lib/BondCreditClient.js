import { SubscriptionClient } from './clients/SubscriptionClient.js';
import { CreditClient } from './clients/CreditClient.js';
import { X402Client } from './clients/X402Client.js';
import { AnalyticsClient } from './clients/AnalyticsClient.js';
export class BondCreditClient {
    config;
    subscription;
    credit;
    x402;
    analytics;
    constructor(config) {
        this.config = config;
        this.subscription = new SubscriptionClient(config);
        this.credit = new CreditClient(config);
        this.x402 = new X402Client(config, {
            subscription: this.subscription,
            credit: this.credit
        });
        this.analytics = new AnalyticsClient(config);
    }
}
//# sourceMappingURL=BondCreditClient.js.map