export class BondCreditError extends Error {
  override name = 'BondCreditError';
}

export class NotConfiguredError extends BondCreditError {
  override name = 'NotConfiguredError';
}

export class SubscriptionInactiveError extends BondCreditError {
  override name = 'SubscriptionInactiveError';
}

export class CreditScoreTooLowError extends BondCreditError {
  override name = 'CreditScoreTooLowError';
}

export class InsufficientCreditError extends BondCreditError {
  override name = 'InsufficientCreditError';
}

export class GuaranteeNotFoundError extends BondCreditError {
  override name = 'GuaranteeNotFoundError';
}

