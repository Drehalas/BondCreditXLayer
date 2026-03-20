export declare class BondCreditError extends Error {
    name: string;
}
export declare class NotConfiguredError extends BondCreditError {
    name: string;
}
export declare class SubscriptionInactiveError extends BondCreditError {
    name: string;
}
export declare class CreditScoreTooLowError extends BondCreditError {
    name: string;
}
export declare class InsufficientCreditError extends BondCreditError {
    name: string;
}
export declare class GuaranteeNotFoundError extends BondCreditError {
    name: string;
}
//# sourceMappingURL=errors.d.ts.map