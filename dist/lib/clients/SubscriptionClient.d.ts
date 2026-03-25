import type { BondCreditClientConfig, CheckStatusResult, SubscribeInput, SubscribeResult, SubscriptionStatus } from '../types.js';
export declare class SubscriptionClient {
    private readonly cfg;
    private expiryMs;
    private paymentsMade;
    constructor(cfg: BondCreditClientConfig);
    check(): Promise<SubscriptionStatus>;
    /**
     * Subscribe to credit monitoring via x402 microtransaction.
     * Uses on-chain mode when configured, otherwise falls back to scaffold mode.
     */
    subscribe(input?: SubscribeInput): Promise<SubscribeResult>;
    checkStatus(): Promise<CheckStatusResult>;
    renew(input?: Pick<SubscribeInput, 'duration'>): Promise<SubscribeResult>;
}
//# sourceMappingURL=SubscriptionClient.d.ts.map