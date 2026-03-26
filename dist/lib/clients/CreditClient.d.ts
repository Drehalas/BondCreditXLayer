import type { AvailableCredit, BondCreditClientConfig, CreditApproval, CreditLimit, CreditPosition, CreditRequestInput, CreditScore, Eligibility, RepayInput, RepayResult } from '../types.js';
export declare class CreditClient {
    private readonly cfg;
    private static readonly stateByAgent;
    constructor(cfg: BondCreditClientConfig);
    private getState;
    private static clampScore;
    private scoreTier;
    private repaymentSpeedFactor;
    private getSubscriptionSignals;
    private getScoreFactors;
    private getScoredLimitSnapshot;
    getScore(): Promise<CreditScore>;
    getAvailableCredit(currency?: string): Promise<AvailableCredit>;
    request(input: CreditRequestInput): Promise<CreditApproval>;
    request(amount: string, purpose?: string): Promise<CreditApproval>;
    repay(input: RepayInput): Promise<RepayResult>;
    repay(creditId: string, amount: string): Promise<RepayResult>;
    checkEligibility(amount: string): Promise<Eligibility>;
    getLimit(): Promise<CreditLimit>;
    getOutstanding(): Promise<CreditPosition>;
}
//# sourceMappingURL=CreditClient.d.ts.map