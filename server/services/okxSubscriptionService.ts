import { isHexString } from 'ethers';

export interface OkxManagedSubscriptionInput {
  agentWalletAddress: string;
  contractAddress: string;
  chainId: number;
  data: string;
  valueWei: bigint;
}

function parseTxHashFromResponse(payload: unknown): string | null {
  if (typeof payload === 'string') {
    return isHexString(payload, 32) ? payload : null;
  }

  if (!payload || typeof payload !== 'object') return null;

  const obj = payload as Record<string, unknown>;
  const candidates = [obj.txHash, obj.hash, obj.transactionHash];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && isHexString(candidate, 32)) return candidate;
  }

  if (obj.data && typeof obj.data === 'object') {
    const nested = obj.data as Record<string, unknown>;
    const nestedCandidates = [nested.txHash, nested.hash, nested.transactionHash];
    for (const candidate of nestedCandidates) {
      if (typeof candidate === 'string' && isHexString(candidate, 32)) return candidate;
    }
  }

  return null;
}

export async function submitOkxManagedSubscriptionTx(
  input: OkxManagedSubscriptionInput,
): Promise<string> {
  const mockedTxHash = process.env.BONDCREDIT_OKX_MOCK_TX_HASH;
  if (typeof mockedTxHash === 'string' && mockedTxHash.trim()) {
    const trimmed = mockedTxHash.trim();
    if (!isHexString(trimmed, 32)) {
      throw new Error('BONDCREDIT_OKX_MOCK_TX_HASH must be a 32-byte tx hash (0x...)');
    }
    return trimmed;
  }

  const endpoint = process.env.BONDCREDIT_OKX_SUBMIT_URL;
  if (!endpoint) {
    throw new Error('BONDCREDIT_OKX_SUBMIT_URL is required for OKX-managed subscription');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const authHeader = process.env.BONDCREDIT_OKX_AUTH_HEADER;
  const apiKey = process.env.BONDCREDIT_OKX_API_KEY;
  if (authHeader && authHeader.trim()) {
    headers.Authorization = authHeader.trim();
  } else if (apiKey && apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: input.agentWalletAddress,
      walletAddress: input.agentWalletAddress,
      to: input.contractAddress,
      chainId: input.chainId,
      data: input.data,
      value: input.valueWei.toString(),
    }),
  });

  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(`OKX submit failed with status ${response.status}: ${responseBody.slice(0, 280)}`);
  }

  let parsedBody: unknown = responseBody;
  try {
    parsedBody = JSON.parse(responseBody);
  } catch {
    // Response may be plain text tx hash.
  }

  const txHash = parseTxHashFromResponse(parsedBody);
  if (!txHash) {
    throw new Error('OKX submit succeeded but no valid txHash was returned');
  }

  return txHash;
}
