import type { BondCreditClientConfig, AvailableCredit, X402GuaranteeRequest, X402GuaranteeResponse, X402GuaranteeStatus } from '../types.js';
type SubscriptionLike = {
    check(): Promise<{
        active: boolean;
    }>;
};
type CreditLike = {
    getScore(): Promise<{
        value: number;
        updatedAt: string;
    }>;
    getAvailableCredit(currency?: string): Promise<AvailableCredit>;
};
export declare class X402Client {
    private readonly cfg;
    private readonly deps;
    private readonly guaranteeState;
    constructor(cfg: BondCreditClientConfig, deps: {
        subscription: SubscriptionLike;
        credit: CreditLike;
    });
    guaranteePayment(input: X402GuaranteeRequest): Promise<X402GuaranteeResponse>;
    checkGuarantee(guaranteeId: string): Promise<X402GuaranteeStatus>;
    cancelGuarantee(guaranteeId: string): Promise<{
        ok: true;
    }>;
}
export {};
//# sourceMappingURL=X402Client.d.ts.map