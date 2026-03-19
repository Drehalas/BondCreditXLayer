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
};

export type CreditScore = {
  value: number; // 0..1000
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

export type CreditRequest = {
  id: string;
  agentId: string;
  amount: string;
  purpose?: string;
  feeBps: number;
  createdAt: string;
  guarantee?: Guarantee;
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

