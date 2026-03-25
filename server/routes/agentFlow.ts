import { NextFunction, Request, Response, Router } from 'express';
import { formatEther, isAddress, isHexString, keccak256, parseEther, toUtf8Bytes } from 'ethers';
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
  if (!(error instanceof Error)) return 'On-chain apply failed';

  const selectorMatch = /data=\"(0x[0-9a-fA-F]{8})/.exec(error.message);
  if (!selectorMatch || !selectorMatch[1]) return error.message;

  const selector = selectorMatch[1].toLowerCase();
  return GUARANTOR_ERROR_BY_SELECTOR[selector] ?? error.message;
}

router.post('/enroll', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      agentId,
      email,
      walletAddress,
    } = req.body as { agentId?: string; email?: string; walletAddress?: string };

    if (!agentId || typeof agentId !== 'string') {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }

    const hasEmail = typeof email === 'string' && email.trim().length > 0;
    const hasWallet = typeof walletAddress === 'string' && walletAddress.trim().length > 0;
    const normalizedEmail = hasEmail ? email.trim() : null;
    const normalizedWalletAddress = hasWallet ? walletAddress.trim() : null;

    if (!hasEmail && !hasWallet) {
      res.status(400).json({ error: 'email or walletAddress is required' });
      return;
    }

    if (normalizedWalletAddress && !isAddress(normalizedWalletAddress)) {
      res.status(400).json({ error: 'walletAddress must be a valid EVM address' });
      return;
    }

    const client = createClient(agentId);
    if (!hasSubscriptionContract(client.config) || !hasGuarantorContract(client.config)) {
      res.status(500).json({ error: 'On-chain subscription and guarantor contracts must be configured' });
      return;
    }
    const subscription = await client.subscription.checkStatus();
    const score = await client.credit.getScore();
    const limit = await client.credit.getLimit();

    res.json({
      enrolled: true,
      agentId,
      email: normalizedEmail,
      walletAddress: normalizedWalletAddress,
      subscription,
      credit: {
        score: score.value,
        tier: score.tier,
        line: limit.current,
      },
      message: 'Enrollment complete. Download skill.md and connect it to your agent.'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/credit/apply', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      agentId,
      amount,
      recipient,
    } = req.body as {
      agentId?: string;
      amount?: number;
      recipient?: string;
    };

    if (!agentId || typeof agentId !== 'string') {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'amount must be a positive number' });
      return;
    }

    const client = createClient(agentId);
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

    const targetRecipient = recipient ?? agentId;
    if (!isAddress(targetRecipient)) {
      res.status(400).json({ error: 'recipient is required and must be a valid EVM address' });
      return;
    }

    const read = getGuarantorReadContract(client.config);
    const write = getGuarantorWriteContract(client.config);
    if (!read || !write) {
      res.status(500).json({ error: 'On-chain apply requires rpcUrl, guarantor address, and privateKey' });
      return;
    }

    const amountWei = parseEther(String(amount));
    const ttlSeconds = Math.max(
      60,
      Number(process.env.BONDCREDIT_DEFAULT_GUARANTEE_TTL_SECONDS ?? 25 * 60),
    );

    const freeLiquidityWei = await read.freeLiquidityWei();
    if (amountWei > freeLiquidityWei) {
      const score = await client.credit.getScore();
      const limit = await client.credit.getLimit();

      res.json({
        approved: false,
        reason: `Insufficient liquidity in guarantor pool (requested ${formatEther(amountWei)} OKB, available ${formatEther(freeLiquidityWei)} OKB)`,
        subscribedNow,
        score,
        limit,
      });
      return;
    }

    try {
      const guaranteeId = await write.createGuarantee.staticCall(targetRecipient, amountWei, ttlSeconds);
      const tx = await write.createGuarantee(targetRecipient, amountWei, ttlSeconds);
      await tx.wait();

      const status = await read.checkGuarantee(guaranteeId);
      const expiresAt = new Date(Number(status[4]) * 1000).toISOString();
      const score = await client.credit.getScore();
      const limit = await client.credit.getLimit();

      res.json({
        approved: true,
        subscribedNow,
        score,
        limit,
        guarantee: {
          guaranteeId,
          proof: tx.hash,
          expiresAt,
        }
      });
      return;
    } catch (error) {
      const message = decodeGuarantorErrorMessage(error);
      const score = await client.credit.getScore();
      const limit = await client.credit.getLimit();

      res.json({
        approved: false,
        reason: message,
        subscribedNow,
        score,
        limit,
      });
      return;
    }
  } catch (error) {
    next(error);
  }
});

router.post('/credit/repay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      agentId,
      creditId,
      amount,
    } = req.body as { agentId?: string; creditId?: string; amount?: number };

    if (!agentId || typeof agentId !== 'string') {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }
    if (!creditId || typeof creditId !== 'string') {
      res.status(400).json({ error: 'creditId is required' });
      return;
    }
    const guaranteeId = creditId.trim();
    if (!isHexString(guaranteeId, 32)) {
      res.status(400).json({ error: 'creditId must be a 32-byte hex guarantee id (0x...)' });
      return;
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'amount must be a positive number' });
      return;
    }

    const client = createClient(agentId);
    if (!hasGuarantorContract(client.config)) {
      res.status(500).json({ error: 'On-chain guarantor contract must be configured' });
      return;
    }

    const read = getGuarantorReadContract(client.config);
    const write = getGuarantorWriteContract(client.config);
    if (!read || !write) {
      res.status(500).json({ error: 'On-chain repay requires rpcUrl, guarantor address, and privateKey' });
      return;
    }

    const [, used, cancelled, repaid] = await read.checkGuarantee(guaranteeId);
    if (!used) {
      res.status(400).json({ error: 'Guarantee is not marked used yet; cannot repay' });
      return;
    }
    if (cancelled || repaid) {
      res.status(400).json({ error: 'Guarantee is already finalized' });
      return;
    }

    const guarantee = await read.guarantees(guaranteeId);
    const requiredWei = guarantee[2] + guarantee[3];
    const providedWei = parseEther(String(amount));
    if (providedWei < requiredWei) {
      res.status(400).json({
        error: 'amount is below required repayment',
        requiredAmount: `${formatEther(requiredWei)} OKB`,
      });
      return;
    }

    const beforeScore = await client.credit.getScore();
    const beforeLimit = await client.credit.getLimit();

    const tx = await write.repayGuarantee(guaranteeId, { value: providedWei });
    await tx.wait();

    const repayment = await client.credit.repay({
      creditId: guaranteeId,
      amount: `${amount} OKB`,
    });

    const afterScore = await client.credit.getScore();
    const afterLimit = await client.credit.getLimit();

    res.json({
      success: repayment.success,
      repayment: {
        ...repayment,
        txHash: tx.hash,
      },
      growth: {
        scoreBefore: beforeScore.value,
        scoreAfter: afterScore.value,
        lineBefore: beforeLimit.current,
        lineAfter: afterLimit.current,
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/credit/settle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      agentId,
      creditId,
      x402PayloadHash,
    } = req.body as { agentId?: string; creditId?: string; x402PayloadHash?: string };

    if (!agentId || typeof agentId !== 'string') {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }
    if (!creditId || typeof creditId !== 'string') {
      res.status(400).json({ error: 'creditId is required' });
      return;
    }
    const guaranteeId = creditId.trim();
    if (!isHexString(guaranteeId, 32)) {
      res.status(400).json({ error: 'creditId must be a 32-byte hex guarantee id (0x...)' });
      return;
    }
    const payloadHash = (() => {
      if (typeof x402PayloadHash === 'string' && isHexString(x402PayloadHash, 32)) {
        return x402PayloadHash;
      }
      if (x402PayloadHash !== undefined) {
        return null;
      }

      // Deterministic fallback for simplified API usage in demo flows.
      return keccak256(toUtf8Bytes(`bondcredit:settle:${agentId}:${guaranteeId}`));
    })();

    if (!payloadHash) {
      res.status(400).json({ error: 'x402PayloadHash must be a 32-byte hex string (0x...) when provided' });
      return;
    }

    const client = createClient(agentId);
    if (!hasGuarantorContract(client.config)) {
      res.status(500).json({ error: 'On-chain guarantor contract must be configured' });
      return;
    }

    const read = getGuarantorReadContract(client.config);
    const write = getGuarantorWriteContract(client.config);
    if (!read || !write) {
      res.status(500).json({ error: 'On-chain settle requires rpcUrl, guarantor address, and privateKey' });
      return;
    }

    const [active, used, cancelled, repaid] = await read.checkGuarantee(guaranteeId);
    if (!active) {
      res.status(400).json({ error: 'Guarantee is not active and cannot be settled' });
      return;
    }
    if (used || cancelled || repaid) {
      res.status(400).json({ error: 'Guarantee is already finalized' });
      return;
    }

    const guarantee = await read.guarantees(guaranteeId);
    const tx = await write.settleGuarantee(guaranteeId, payloadHash);
    await tx.wait();

    res.json({
      settled: true,
      txHash: tx.hash,
      guarantee: {
        guaranteeId,
        recipient: guarantee[1],
        paidAmount: `${formatEther(guarantee[2])} OKB`,
        x402PayloadHash: payloadHash,
      },
    });
  } catch (error) {
    const message = decodeGuarantorErrorMessage(error);
    res.status(400).json({ settled: false, reason: message });
  }
});

router.post('/subscription/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.body as { agentId?: string };
    if (!agentId || typeof agentId !== 'string') {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }

    const client = createClient(agentId);
    const status = await client.subscription.checkStatus();
    res.json({ subscription: status });
  } catch (error) {
    next(error);
  }
});

router.get('/pool/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const client = createClient(process.env.BONDCREDIT_REBALANCE_AGENT_ID ?? 'pool-operator');
    if (!hasGuarantorContract(client.config)) {
      res.status(500).json({ error: 'On-chain guarantor contract must be configured' });
      return;
    }

    const read = getGuarantorReadContract(client.config);
    if (!read) {
      res.status(500).json({ error: 'On-chain pool status requires rpcUrl and guarantor address' });
      return;
    }

    const [freeLiquidityWei, totalOutstandingWei, feeBps] = await Promise.all([
      read.freeLiquidityWei(),
      read.totalOutstandingWei(),
      read.feeBps(),
    ]);

    const poolBalanceWei = freeLiquidityWei + totalOutstandingWei;
    res.json({
      pool: {
        guarantor: client.config.contracts?.paymentGuarantor,
        balance: `${formatEther(poolBalanceWei)} OKB`,
        freeLiquidity: `${formatEther(freeLiquidityWei)} OKB`,
        reservedOutstanding: `${formatEther(totalOutstandingWei)} OKB`,
        feeBps: Number(feeBps),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/pool/fund', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      agentId,
      amount,
    } = req.body as { agentId?: string; amount?: number };

    if (!agentId || typeof agentId !== 'string') {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'amount must be a positive number' });
      return;
    }

    const client = createClient(agentId);
    if (!hasGuarantorContract(client.config)) {
      res.status(500).json({ error: 'On-chain guarantor contract must be configured' });
      return;
    }

    const read = getGuarantorReadContract(client.config);
    const write = getGuarantorWriteContract(client.config);
    if (!read || !write) {
      res.status(500).json({ error: 'On-chain pool funding requires rpcUrl, guarantor address, and privateKey' });
      return;
    }

    const amountWei = parseEther(String(amount));
    const tx = await write.fundPool({ value: amountWei });
    await tx.wait();

    const [freeLiquidityWei, totalOutstandingWei] = await Promise.all([
      read.freeLiquidityWei(),
      read.totalOutstandingWei(),
    ]);

    res.json({
      funded: true,
      amount: `${formatEther(amountWei)} OKB`,
      txHash: tx.hash,
      pool: {
        freeLiquidity: `${formatEther(freeLiquidityWei)} OKB`,
        reservedOutstanding: `${formatEther(totalOutstandingWei)} OKB`,
      },
    });
  } catch (error) {
    const message = decodeGuarantorErrorMessage(error);
    res.status(400).json({ funded: false, reason: message });
  }
});

export default router;
