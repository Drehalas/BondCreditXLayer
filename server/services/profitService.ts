export interface ProfitCalculationResult {
  profit: number;
  isProfit: boolean;
  valueReceived: number;
}

export function calculateProfit(amountIn: number, amountOut: number, price: number): ProfitCalculationResult {
  if (!Number.isFinite(amountIn) || amountIn < 0) {
    throw new Error('amountIn must be a non-negative number');
  }
  if (!Number.isFinite(amountOut) || amountOut < 0) {
    throw new Error('amountOut must be a non-negative number');
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('price must be a positive number');
  }

  const valueReceived = amountOut * price;
  const profit = valueReceived - amountIn;

  return {
    profit,
    isProfit: valueReceived > amountIn,
    valueReceived,
  };
}
