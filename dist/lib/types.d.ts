export type Network = 'xlayer-mainnet' | 'xlayer-testnet';
export type BondCreditClientConfig = {
    network: Network;
    agentId: string;
    /**
     * Optional explicit EVM address for the agent.
     * If omitted, clients may derive it from `agentId` (when it is an address)
     * or from `privateKey`.
     */
    agentAddress?: string;
    /**
     * Optional signer secret for future on-chain actions.
     * This client scaffolding does not transmit keys anywhere.
     */
    privateKey?: string;
    /**
     * Optional RPC URL override.
     */
    rpcUrl?: string;
    /**
     * Optional deployed contract addresses for on-chain mode.
     * If omitted, clients fall back to in-memory scaffold behavior.
     */
    contracts?: {
        subscriptionManager?: string;
        paymentGuarantor?: string;
    };
    /**
     * Optional x402 integration options for hybrid verification mode.
     */
    x402?: {
        defaultGuaranteeTtlSeconds?: number;
        verifierEndpoint?: string;
    };
};
export type SubscriptionStatus = {
    active: boolean;
    startedAt?: string;
    renewsAt?: string;
    plan?: 'daily';
    expiryDate?: string;
    daysLeft?: number;
    paymentsMade?: number;
};
export type SubscribeInput = {
    duration?: string;
    autoRenew?: boolean;
};
export type SubscribeResult = {
    status: 'active' | 'inactive';
    expiry: string;
    txHash: string;
    amount: string;
};
export type CheckStatusResult = {
    active: boolean;
    expiryDate?: string;
    daysLeft?: number;
    paymentsMade?: number;
};
export type RenewResult = SubscribeResult;
export type CreditScore = {
    value: number;
    tier?: string;
    updatedAt: string;
    factors?: Record<string, number>;
};
export type Guarantee = {
    id: string;
    agentId: string;
    amount: string;
    currency: string;
    expiresAt: string;
};
export type AvailableCredit = {
    value: number;
    currency: string;
    updatedAt: string;
};
export type CreditRequest = {
    id: string;
    agentId: string;
    amount: string;
    purpose?: string;
    expectedReturn?: string;
    feeBps: number;
    createdAt: string;
    guarantee?: Guarantee;
};
export type CreditRequestInput = {
    amount: string;
    purpose?: string;
    expectedReturn?: string;
};
export type CreditApproval = {
    approved: boolean;
    creditId?: string;
    amount?: string;
    fee?: string;
    deadline?: string;
    reason?: string | null;
};
export type RepayInput = {
    creditId: string;
    amount: string;
};
export type RepayResult = {
    success: boolean;
    newScore: number;
    txHash?: string;
};
export type Eligibility = {
    eligible: boolean;
    maxAmount?: string;
    reason: string | null;
};
export type CreditLimit = {
    current: string;
    used: string;
    available: string;
    nextTier: string;
};
export type CreditPosition = {
    agentId: string;
    outstanding: string;
    currency: string;
    updatedAt: string;
};
export type AnalyticsEvent = {
    type: 'trade';
    timestamp: string;
    payload: unknown;
} | {
    type: 'subscription';
    timestamp: string;
    payload: unknown;
} | {
    type: 'credit';
    timestamp: string;
    payload: unknown;
};
export type CreditHealthStatus = 'healthy' | 'warning' | 'critical';
export type CreditHealth = {
    status: CreditHealthStatus;
    metrics: {
        creditUtilization: string;
        repaymentRate: string;
        avgRepaymentTime: string;
        scoreTrend: string;
    };
    warnings: string[];
};
export type CreditHistory = {
    scores: Array<{
        date: string;
        score: number;
    }>;
    transactions: number;
    totalCreditUsed: string;
    totalRepaid: string;
};
export type AnalyticsSimulateAction = {
    type: 'subscribe';
    duration: string;
} | {
    type: 'payment';
    count: number;
    success: boolean;
} | {
    type: 'repay';
    amount: string;
    time: string;
};
export type AnalyticsSimulation = {
    projectedScore: number;
    projectedLimit: string;
    timeToAchieve: string;
    confidence: 'high' | 'medium' | 'low';
};
export type AnalyticsReport = {
    summary: {
        avgScore: number;
        totalCreditUsed: string;
        totalRepaid: string;
        profitFromCredit: string;
        roi: string;
    };
    recommendations: string[];
};
export type AnalyticsMonitorUpdate = {
    type: 'warning';
    message: string;
} | {
    type: 'info';
    message: string;
};
export type MonitorStop = () => void;
export type X402GuaranteeRequest = {
    recipient: string;
    amount: string;
    service: string;
    endpoint: string;
};
export type X402Payload = {
    amount: string;
    recipient: string;
    guarantor: string;
};
export type X402GuaranteeResponse = {
    guaranteeId: string;
    proof: string;
    expiresAt: string;
    x402Payload: X402Payload;
};
export type X402GuaranteeStatus = {
    active: boolean;
    used: boolean;
    cancelled?: boolean;
    expiresIn: string;
};
//# sourceMappingURL=types.d.ts.map