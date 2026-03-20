export class BondCreditError extends Error {
    name = 'BondCreditError';
}
export class NotConfiguredError extends BondCreditError {
    name = 'NotConfiguredError';
}
export class SubscriptionInactiveError extends BondCreditError {
    name = 'SubscriptionInactiveError';
}
export class CreditScoreTooLowError extends BondCreditError {
    name = 'CreditScoreTooLowError';
}
export class InsufficientCreditError extends BondCreditError {
    name = 'InsufficientCreditError';
}
export class GuaranteeNotFoundError extends BondCreditError {
    name = 'GuaranteeNotFoundError';
}
//# sourceMappingURL=errors.js.map