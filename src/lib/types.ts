export type Network = 'xlayer-mainnet' | 'xlayer-testnet';

export type BondCreditClientConfig = {
  network: Network;
  agentId: string;
  /**
   * Optional signer secret for future on-chain actions.
   * This client scaffolding does not transmit keys anywhere.
   */
  privateKey?: string;
  /**
   * Optional RPC URL override.
   */
  rpcUrl?: string;
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
  duration?: string; // e.g. "30 days"
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
  value: number; // 0..1000
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
  value: number; // numeric value in the given currency
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

export type AnalyticsEvent =
  | { type: 'trade'; timestamp: string; payload: unknown }
  | { type: 'subscription'; timestamp: string; payload: unknown }
  | { type: 'credit'; timestamp: string; payload: unknown };

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

