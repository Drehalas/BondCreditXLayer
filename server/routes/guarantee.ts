import { NextFunction, Request, Response, Router } from 'express';
import { formatEther, isAddress, parseEther } from 'ethers';
import { createClient } from '../client.js';
import {
  getGuarantorReadContract,
  getGuarantorWriteContract,
  hasGuarantorContract,
  hasSubscriptionContract,
} from '../../src/lib/onchain.js';

const router = Router();

const GUARANTOR_ERROR_BY_SELECTOR: Record<string, string> = {
  '0xe6c4247b': 'Invalid recipient address',
  '0x2c5211c6': 'Invalid amount or TTL',
  '0x93ca83fe': 'Subscription is inactive',
  '0xbb55fd27': 'Insufficient liquidity in guarantor pool',
  '0x41b09b44': 'Guarantee not found',
  '0x9f3c8e90': 'Guarantee expired',
  '0xe8ca1ebc': 'Guarantee inactive',
  '0x336fec96': 'Not guarantee owner',
  '0x475a2535': 'Guarantee already finalized',
  '0x39a92600': 'Repay value too low',
  '0xa6c5a3bd': 'Withdrawal exceeds free liquidity',
  '0xf0c49d44': 'Refund failed',
  '0xd9c80951': 'Settlement transfer failed',
};

function decodeGuarantorErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'On-chain guarantee failed';

  const selectorMatch = /data=\"(0x[0-9a-fA-F]{8})/.exec(error.message);
  if (!selectorMatch || !selectorMatch[1]) return error.message;

  const selector = selectorMatch[1].toLowerCase();
  return GUARANTOR_ERROR_BY_SELECTOR[selector] ?? error.message;
}

router.post('/guarantee', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      recipient,
      amount,
      service,
      endpoint,
      purpose,
    } = req.body as {
      recipient?: string;
      amount?: number;
      service?: string;
      endpoint?: string;
      purpose?: string;
    };

    // Always use backend signer as agentId
    const backendAgentId = process.env.BONDCREDIT_GUARANTEE_AGENT_ID ||
      '0xd931713CD30c6dBD729EDce527Ac942f7A0EC273';
    const targetRecipient = recipient ?? backendAgentId;
    if (typeof targetRecipient !== 'string' || !isAddress(targetRecipient.trim())) {
      res.status(400).json({ error: 'recipient must be a valid EVM address' });
      return;
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'amount must be a positive number' });
      return;
    }

    const normalizedService = typeof service === 'string' && service.trim().length > 0
      ? service.trim()
      : 'credit-guarantee';
    const normalizedEndpoint = typeof endpoint === 'string' && endpoint.trim().length > 0
      ? endpoint.trim()
      : 'bondcredit://guarantee';
    const normalizedPurpose = typeof purpose === 'string' && purpose.trim().length > 0
      ? purpose.trim()
      : undefined;

    const client = createClient(backendAgentId);

    if (!hasSubscriptionContract(client.config) || !hasGuarantorContract(client.config)) {
      res.status(500).json({ error: 'On-chain subscription and guarantor contracts must be configured' });
      return;
    }

    const subscriptionBefore = await client.subscription.checkStatus();
    let subscribedNow = false;
    if (!subscriptionBefore.active) {
      await client.subscription.subscribe({ duration: '30 days', autoRenew: true });
      subscribedNow = true;
    }

    const read = getGuarantorReadContract(client.config);
    const write = getGuarantorWriteContract(client.config);
    if (!read || !write) {
      res.status(500).json({ error: 'On-chain guarantee requires rpcUrl, guarantor address, and privateKey' });
      return;
    }

    const amountWei = parseEther(String(amount));
    const ttlSeconds = Math.max(
      60,
      Number(process.env.BONDCREDIT_DEFAULT_GUARANTEE_TTL_SECONDS ?? 25 * 60),
    );

    const freeLiquidityWei = await read.freeLiquidityWei();
    if (amountWei > freeLiquidityWei) {
      res.json({
        guaranteeId: '',
        status: 'rejected' as const,
        reason: `Insufficient liquidity in guarantor pool (requested ${formatEther(amountWei)} OKB, available ${formatEther(freeLiquidityWei)} OKB)`,
      });
      return;
    }

    const guaranteeId = await write.createGuarantee.staticCall(targetRecipient.trim(), amountWei, ttlSeconds);
    const tx = await write.createGuarantee(targetRecipient.trim(), amountWei, ttlSeconds);
    await tx.wait();

    const status = await read.checkGuarantee(guaranteeId);
    const expiresAtUnixSec = Number(status[4]);
    const expiresAt = expiresAtUnixSec > 0
      ? new Date(expiresAtUnixSec * 1000).toISOString()
      : new Date(Date.now() + ttlSeconds * 1000).toISOString();

    res.json({
      guaranteeId,
      proof: tx.hash,
      expiresAt,
      service: normalizedService,
      endpoint: normalizedEndpoint,
      purpose: normalizedPurpose,
      subscribedNow,
      status: 'approved' as const,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.json({
        guaranteeId: '',
        status: 'rejected' as const,
        reason: decodeGuarantorErrorMessage(error),
      });
      return;
    }
    next(error);
  }
});

export default router;
