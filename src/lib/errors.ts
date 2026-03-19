export class BondCreditError extends Error {
  override name = 'BondCreditError';
}

export class NotConfiguredError extends BondCreditError {
  override name = 'NotConfiguredError';
}

