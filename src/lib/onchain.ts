import { Contract, JsonRpcProvider, Wallet, formatEther, isAddress, parseEther } from 'ethers';
import type { BondCreditClientConfig } from './types.js';

type SubscriptionReadContract = {
  pricePerDayWei(): Promise<bigint>;
  checkStatus(agent: string): Promise<[boolean, bigint, bigint, bigint]>;
  isActive(agent: string): Promise<boolean>;
};

type SubscriptionWriteContract = SubscriptionReadContract & {
  subscribe(daysToBuy: number, overrides: { value: bigint }): Promise<{ hash: string; wait(): Promise<unknown> }>;
  renew(daysToBuy: number, overrides: { value: bigint }): Promise<{ hash: string; wait(): Promise<unknown> }>;
};

type GuarantorReadContract = {
  checkGuarantee(guaranteeId: string): Promise<[boolean, boolean, boolean, boolean, bigint, string]>;
  freeLiquidityWei(): Promise<bigint>;
  outstandingByAgent(agent: string): Promise<bigint>;
  feeBps(): Promise<bigint>;
};

type GuarantorWriteContract = GuarantorReadContract & {
  createGuarantee: {
    (recipient: string, amountWei: bigint, ttlSeconds: number): Promise<{ hash: string; wait(): Promise<unknown> }>;
    staticCall(recipient: string, amountWei: bigint, ttlSeconds: number): Promise<string>;
  };
  cancelGuarantee(guaranteeId: string): Promise<{ hash: string; wait(): Promise<unknown> }>;
  repayGuarantee(guaranteeId: string, overrides: { value: bigint }): Promise<{ hash: string; wait(): Promise<unknown> }>;
};

export const subscriptionManagerAbi = [
  'function pricePerDayWei() view returns (uint256)',
  'function subscribe(uint256 daysToBuy) payable returns (uint256 expiry)',
  'function renew(uint256 daysToBuy) payable returns (uint256 expiry)',
  'function checkStatus(address agent) view returns (bool active, uint256 expiryDate, uint256 daysLeft, uint256 paymentCount)',
  'function isActive(address agent) view returns (bool)'
] as const;

export const paymentGuarantorAbi = [
  'function createGuarantee(address recipient, uint256 amountWei, uint256 ttlSeconds) returns (bytes32 guaranteeId)',
  'function checkGuarantee(bytes32 guaranteeId) view returns (bool active, bool used, bool cancelled, bool repaid, uint256 expiresAt, bytes32 payloadHash)',
  'function cancelGuarantee(bytes32 guaranteeId)',
  'function repayGuarantee(bytes32 guaranteeId) payable',
  'function markGuaranteeUsed(bytes32 guaranteeId, bytes32 x402PayloadHash)',
  'function freeLiquidityWei() view returns (uint256)',
  'function outstandingByAgent(address agent) view returns (uint256)',
  'function feeBps() view returns (uint256)'
] as const;

export function getProvider(cfg: BondCreditClientConfig): JsonRpcProvider | null {
  if (!cfg.rpcUrl) return null;
  return new JsonRpcProvider(cfg.rpcUrl);
}

export function getWallet(cfg: BondCreditClientConfig): Wallet | null {
  const provider = getProvider(cfg);
  if (!provider || !cfg.privateKey) return null;
  return new Wallet(cfg.privateKey, provider);
}

export function resolveAgentAddress(cfg: BondCreditClientConfig): string | null {
  if (cfg.agentAddress && isAddress(cfg.agentAddress)) return cfg.agentAddress;
  if (isAddress(cfg.agentId)) return cfg.agentId;

  const wallet = getWallet(cfg);
  return wallet?.address ?? null;
}

export function hasSubscriptionContract(cfg: BondCreditClientConfig): boolean {
  return Boolean(cfg.rpcUrl && cfg.contracts?.subscriptionManager);
}

export function hasGuarantorContract(cfg: BondCreditClientConfig): boolean {
  return Boolean(cfg.rpcUrl && cfg.contracts?.paymentGuarantor);
}

export function getSubscriptionReadContract(cfg: BondCreditClientConfig): SubscriptionReadContract | null {
  const provider = getProvider(cfg);
  const address = cfg.contracts?.subscriptionManager;
  if (!provider || !address) return null;
  return new Contract(address, subscriptionManagerAbi, provider) as unknown as SubscriptionReadContract;
}

export function getSubscriptionWriteContract(cfg: BondCreditClientConfig): SubscriptionWriteContract | null {
  const wallet = getWallet(cfg);
  const address = cfg.contracts?.subscriptionManager;
  if (!wallet || !address) return null;
  return new Contract(address, subscriptionManagerAbi, wallet) as unknown as SubscriptionWriteContract;
}

export function getGuarantorReadContract(cfg: BondCreditClientConfig): GuarantorReadContract | null {
  const provider = getProvider(cfg);
  const address = cfg.contracts?.paymentGuarantor;
  if (!provider || !address) return null;
  return new Contract(address, paymentGuarantorAbi, provider) as unknown as GuarantorReadContract;
}

export function getGuarantorWriteContract(cfg: BondCreditClientConfig): GuarantorWriteContract | null {
  const wallet = getWallet(cfg);
  const address = cfg.contracts?.paymentGuarantor;
  if (!wallet || !address) return null;
  return new Contract(address, paymentGuarantorAbi, wallet) as unknown as GuarantorWriteContract;
}

export function parseAmountToWei(amount: string): bigint {
  const numeric = amount.trim().split(/\s+/)[0] ?? '0';
  return parseEther(numeric);
}

export function formatWeiAmount(amountWei: bigint, currency: string = 'OKB'): string {
  return `${formatEther(amountWei)} ${currency}`;
}

export function daysFromDuration(duration: string): number {
  const match = /(\d+)\s*day/.exec(duration.toLowerCase());
  const value = match ? Number(match[1]) : 30;
  return Math.max(1, Math.trunc(value));
}

export function dateOnlyFromUnixSec(unixSec: bigint | number): string {
  const n = typeof unixSec === 'bigint' ? Number(unixSec) : unixSec;
  return new Date(n * 1000).toISOString().slice(0, 10);
}

export function minutesRemainingFromUnixSec(unixSec: bigint | number): string {
  const n = typeof unixSec === 'bigint' ? Number(unixSec) : unixSec;
  const msRemaining = Math.max(0, (n * 1000) - Date.now());
  return `${Math.ceil(msRemaining / 60000)} minutes`;
}
