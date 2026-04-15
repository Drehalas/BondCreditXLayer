import { JsonRpcProvider, isAddress } from 'ethers';

export interface VerifyTradeTransactionInput {
  rpcUrl: string;
  txHash: string;
  expectedFromAddress?: string;
  expectedToAddress?: string;
  expectedValueWei?: bigint;
  expectedData?: string;
}

export interface VerifyTradeTransactionResult {
  from: string;
  to: string | null;
  valueWei: bigint;
  status: number;
}

export async function verifyTradeTransaction(
  input: VerifyTradeTransactionInput,
): Promise<VerifyTradeTransactionResult> {
  const provider = new JsonRpcProvider(input.rpcUrl);
  const [tx, receipt] = await Promise.all([
    provider.getTransaction(input.txHash),
    provider.getTransactionReceipt(input.txHash),
  ]);

  if (!tx || !receipt) {
    throw new Error('Transaction not found on-chain');
  }
  if (receipt.status !== 1) {
    throw new Error('Transaction failed on-chain');
  }

  if (input.expectedFromAddress) {
    if (!isAddress(input.expectedFromAddress) || tx.from.toLowerCase() !== input.expectedFromAddress.toLowerCase()) {
      throw new Error('Transaction sender mismatch');
    }
  }

  if (input.expectedToAddress) {
    if (!tx.to || tx.to.toLowerCase() !== input.expectedToAddress.toLowerCase()) {
      throw new Error('Transaction recipient/contract mismatch');
    }
  }

  if (typeof input.expectedValueWei === 'bigint' && tx.value !== input.expectedValueWei) {
    throw new Error('Transaction value mismatch');
  }

  if (input.expectedData && tx.data.toLowerCase() !== input.expectedData.toLowerCase()) {
    throw new Error('Transaction calldata mismatch');
  }

  return {
    from: tx.from,
    to: tx.to,
    valueWei: tx.value,
    status: receipt.status,
  };
}
