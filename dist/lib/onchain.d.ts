import { JsonRpcProvider, Wallet } from 'ethers';
import type { BondCreditClientConfig } from './types.js';
type SubscriptionReadContract = {
    pricePerDayWei(): Promise<bigint>;
    checkStatus(agent: string): Promise<[boolean, bigint, bigint, bigint]>;
    isActive(agent: string): Promise<boolean>;
};
type SubscriptionWriteContract = SubscriptionReadContract & {
    subscribe(daysToBuy: number, overrides: {
        value: bigint;
    }): Promise<{
        hash: string;
        wait(): Promise<unknown>;
    }>;
    renew(daysToBuy: number, overrides: {
        value: bigint;
    }): Promise<{
        hash: string;
        wait(): Promise<unknown>;
    }>;
};
type GuarantorReadContract = {
    checkGuarantee(guaranteeId: string): Promise<[boolean, boolean, boolean, boolean, bigint, string]>;
    freeLiquidityWei(): Promise<bigint>;
    outstandingByAgent(agent: string): Promise<bigint>;
    feeBps(): Promise<bigint>;
};
type GuarantorWriteContract = GuarantorReadContract & {
    createGuarantee: {
        (recipient: string, amountWei: bigint, ttlSeconds: number): Promise<{
            hash: string;
            wait(): Promise<unknown>;
        }>;
        staticCall(recipient: string, amountWei: bigint, ttlSeconds: number): Promise<string>;
    };
    cancelGuarantee(guaranteeId: string): Promise<{
        hash: string;
        wait(): Promise<unknown>;
    }>;
    repayGuarantee(guaranteeId: string, overrides: {
        value: bigint;
    }): Promise<{
        hash: string;
        wait(): Promise<unknown>;
    }>;
};
export declare const subscriptionManagerAbi: readonly ["function pricePerDayWei() view returns (uint256)", "function subscribe(uint256 daysToBuy) payable returns (uint256 expiry)", "function renew(uint256 daysToBuy) payable returns (uint256 expiry)", "function checkStatus(address agent) view returns (bool active, uint256 expiryDate, uint256 daysLeft, uint256 paymentCount)", "function isActive(address agent) view returns (bool)"];
export declare const paymentGuarantorAbi: readonly ["function createGuarantee(address recipient, uint256 amountWei, uint256 ttlSeconds) returns (bytes32 guaranteeId)", "function checkGuarantee(bytes32 guaranteeId) view returns (bool active, bool used, bool cancelled, bool repaid, uint256 expiresAt, bytes32 payloadHash)", "function cancelGuarantee(bytes32 guaranteeId)", "function repayGuarantee(bytes32 guaranteeId) payable", "function markGuaranteeUsed(bytes32 guaranteeId, bytes32 x402PayloadHash)", "function freeLiquidityWei() view returns (uint256)", "function outstandingByAgent(address agent) view returns (uint256)", "function feeBps() view returns (uint256)"];
export declare function getProvider(cfg: BondCreditClientConfig): JsonRpcProvider | null;
export declare function getWallet(cfg: BondCreditClientConfig): Wallet | null;
export declare function resolveAgentAddress(cfg: BondCreditClientConfig): string | null;
export declare function hasSubscriptionContract(cfg: BondCreditClientConfig): boolean;
export declare function hasGuarantorContract(cfg: BondCreditClientConfig): boolean;
export declare function getSubscriptionReadContract(cfg: BondCreditClientConfig): SubscriptionReadContract | null;
export declare function getSubscriptionWriteContract(cfg: BondCreditClientConfig): SubscriptionWriteContract | null;
export declare function getGuarantorReadContract(cfg: BondCreditClientConfig): GuarantorReadContract | null;
export declare function getGuarantorWriteContract(cfg: BondCreditClientConfig): GuarantorWriteContract | null;
export declare function parseAmountToWei(amount: string): bigint;
export declare function formatWeiAmount(amountWei: bigint, currency?: string): string;
export declare function daysFromDuration(duration: string): number;
export declare function dateOnlyFromUnixSec(unixSec: bigint | number): string;
export declare function minutesRemainingFromUnixSec(unixSec: bigint | number): string;
export {};
//# sourceMappingURL=onchain.d.ts.map