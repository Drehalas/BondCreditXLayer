import { Contract, Interface, JsonRpcProvider, isAddress } from 'ethers';
import { subscriptionManagerAbi } from '../../src/lib/onchain.js';

export interface VerifySubscriptionTransactionInput {
  rpcUrl: string;
  txHash: string;
  expectedContractAddress: string;
  expectedFromAddress: string;
  expectedValueWei: bigint;
  expectedDaysToBuy: number;
}

export async function verifySubscriptionTransaction(
  input: VerifySubscriptionTransactionInput,
): Promise<void> {
  const provider = new JsonRpcProvider(input.rpcUrl);

  const [tx, receipt] = await Promise.all([
    provider.getTransaction(input.txHash),
    provider.getTransactionReceipt(input.txHash),
  ]);

  if (!tx || !receipt) {
    throw new Error('Subscription transaction not found on-chain');
  }
  if (receipt.status !== 1) {
    throw new Error('Subscription transaction failed on-chain');
  }

  if (!isAddress(input.expectedContractAddress) || !isAddress(input.expectedFromAddress)) {
    throw new Error('Expected addresses for subscription verification are invalid');
  }

  if (!tx.to || tx.to.toLowerCase() !== input.expectedContractAddress.toLowerCase()) {
    throw new Error('Subscription transaction target contract mismatch');
  }
  if (tx.from.toLowerCase() !== input.expectedFromAddress.toLowerCase()) {
    throw new Error('Subscription transaction sender mismatch');
  }
  if (tx.value !== input.expectedValueWei) {
    throw new Error('Subscription transaction value mismatch');
  }

  const iface = new Interface(subscriptionManagerAbi);
  let parsedDaysToBuy: bigint;
  try {
    const decoded = iface.decodeFunctionData('subscribe', tx.data);
    parsedDaysToBuy = BigInt(decoded[0]);
  } catch {
    throw new Error('Transaction data does not match subscribe(uint256) call');
  }

  if (parsedDaysToBuy !== BigInt(input.expectedDaysToBuy)) {
    throw new Error('Subscription transaction daysToBuy mismatch');
  }

  const read = new Contract(
    input.expectedContractAddress,
    subscriptionManagerAbi,
    provider,
  ) as unknown as {
    checkStatus(agent: string): Promise<[boolean, bigint, bigint, bigint]>;
  };

  const [active] = await read.checkStatus(input.expectedFromAddress);
  if (!active) {
    throw new Error('Subscription transaction mined but subscription is not active');
  }
}
