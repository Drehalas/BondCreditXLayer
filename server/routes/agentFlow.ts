import { NextFunction, Request, Response, Router } from 'express';
import { Interface, formatEther, isAddress, isHexString, keccak256, parseEther, toUtf8Bytes } from 'ethers';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createClient } from '../client.js';
import { getDbClient } from '../db/client.js';
import {
  getGuarantorReadContract,
  getGuarantorWriteContract,
  getSubscriptionReadContract,
  hasGuarantorContract,
  hasSubscriptionContract,
  subscriptionManagerAbi,
} from '../../src/lib/onchain.js';
import { submitOkxManagedSubscriptionTx } from '../services/okxSubscriptionService.js';
import { verifySubscriptionTransaction } from '../services/subscriptionTxVerification.js';

const router = Router();

type AutonomousStageStatus = 'completed' | 'failed';

interface AutonomousStage<T = Record<string, unknown>> {
  status: AutonomousStageStatus;
  data?: T;
  error?: string;
}

type AutonomousFinalStatus = 'approved' | 'rejected' | 'failed';

interface AutonomousWorkflowResponse {
  workflowId: string;
  idempotencyKey: string;
  mode: 'autonomous';
  stages: {
    enroll: AutonomousStage;
    profileUpdate: AutonomousStage;
    subscriptionDecision: AutonomousStage;
    creditApply: AutonomousStage;
  };
  finalStatus: AutonomousFinalStatus;
  reason?: string;
  idempotentReplay: boolean;
}

const autonomousInFlight = new Map<string, Promise<AutonomousWorkflowResponse>>();
const autonomousCompleted = new Map<string, AutonomousWorkflowResponse>();

function getCreditAmountForTier(tier: string): number {
  if (tier === 'free') return 0.01;
  if (tier === 'enterprise') return 0.2;
  return 0.0001;
}

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

  const selectorMatch = /data="(0x[0-9a-fA-F]{8})/.exec(error.message);
  if (!selectorMatch?.[1]) return error.message;

  const selector = selectorMatch[1].toLowerCase();
  return GUARANTOR_ERROR_BY_SELECTOR[selector] ?? error.message;
}

router.post('/enroll', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      email,
      walletAddress,
      agentName,
      description,
      agentType,
      serviceUrl,
      tools,
    } = req.body as {
      email?: string;
      walletAddress?: string;
      agentName?: string;
      description?: string;
      agentType?: string;
      serviceUrl?: string;
      tools?: unknown;
    };

    // Always use backend signer as agentId
    const backendAgentId = process.env.BONDCREDIT_AGENTFLOW_AGENT_ID ||
      '0xd931713CD30c6dBD729EDce527Ac942f7A0EC273';

    const normalizedAgentId = backendAgentId.trim();
    if (!isAddress(normalizedAgentId)) {
      res.status(500).json({ error: 'Configured backend agentId must be a valid EVM address' });
      return;
    }

    const hasEmail = typeof email === 'string' && email.trim().length > 0;
    const hasWallet = typeof walletAddress === 'string' && walletAddress.trim().length > 0;
    const hasAgentName = typeof agentName === 'string' && agentName.trim().length > 0;
    const hasDescription = typeof description === 'string' && description.trim().length > 0;
    const hasAgentType = typeof agentType === 'string' && agentType.trim().length > 0;
    const hasServiceUrl = typeof serviceUrl === 'string' && serviceUrl.trim().length > 0;
    const hasTools = tools !== undefined;

    const normalizedEmail = hasEmail ? email.trim() : null;
    const providedWalletAddress = hasWallet ? walletAddress.trim() : null;
    const normalizedAgentName = hasAgentName ? agentName.trim() : null;
    const normalizedDescription = hasDescription ? description.trim() : null;
    const normalizedAgentType = hasAgentType ? agentType.trim() : null;
    const normalizedServiceUrl = hasServiceUrl ? serviceUrl.trim() : null;

    const normalizedTools = (() => {
      if (!hasTools) return undefined;
      if (typeof tools === 'string') {
        const values = tools
          .split(',')
          .map(item => item.trim())
          .filter(Boolean);
        return values as Prisma.InputJsonValue;
      }

      if (Array.isArray(tools)) return tools as Prisma.InputJsonValue;
      if (tools && typeof tools === 'object') return tools as Prisma.InputJsonValue;
      return undefined;
    })();

    if (providedWalletAddress && !isAddress(providedWalletAddress)) {
      res.status(400).json({ error: 'walletAddress must be a valid EVM address' });
      return;
    }

    const normalizedWalletAddress = providedWalletAddress ?? (isAddress(normalizedAgentId) ? normalizedAgentId : null);
    if (!normalizedWalletAddress) {
      res.status(400).json({ error: 'walletAddress is required' });
      return;
    }

    const db = getDbClient();
    console.log('[agentFlow.enroll] Attempting upsert with walletAddress:', normalizedWalletAddress);
    
    try {
      const persistedAgent = await db.agent.upsert({
        where: { walletAddress: normalizedWalletAddress },
        update: {
          ...(hasEmail ? { email: normalizedEmail } : {}),
          ...(hasAgentName ? { agentName: normalizedAgentName } : {}),
          ...(hasDescription ? { description: normalizedDescription } : {}),
          ...(hasAgentType ? { agentType: normalizedAgentType } : {}),
          ...(hasServiceUrl ? { serviceUrl: normalizedServiceUrl } : {}),
          ...(hasTools ? { tools: normalizedTools } : {}),
          agenticWalletRegistered: true,
        },
        create: {
          walletAddress: normalizedWalletAddress,
          email: normalizedEmail,
          agentName: normalizedAgentName,
          description: normalizedDescription,
          agentType: normalizedAgentType,
          serviceUrl: normalizedServiceUrl,
          tools: normalizedTools,
          agenticWalletRegistered: true,
        },
      });
      
      console.log('[agentFlow.enroll] Upsert successful, agent ID:', persistedAgent.id);

      const client = createClient(normalizedWalletAddress);
      if (!hasSubscriptionContract(client.config) || !hasGuarantorContract(client.config)) {
        res.status(500).json({ error: 'On-chain subscription and guarantor contracts must be configured' });
        return;
      }
      const score = await client.credit.getScore();
      const limit = await client.credit.getLimit();

      res.json({
        enrolled: true,
        agentId: persistedAgent.id,
        email: normalizedEmail,
        walletAddress: normalizedWalletAddress,
        agent: persistedAgent,
        credit: {
          score: score.value,
          tier: score.tier,
          line: limit.current,
        },
        message: 'Enrollment complete. Download skill.md and connect it to your agent.'
      });
    } catch (dbError) {
      console.error('[agentFlow.enroll] Database error:', dbError instanceof Error ? dbError.message : String(dbError));
      throw dbError;
    }
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────────
// POST /agent/update - Update existing agent profile (Step 2)
// ──────────────────────────────────────────────────────────────────
router.post('/agent/update', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      agentId,
      email,
      agentName,
      description,
      agentType,
      serviceUrl,
      tools,
    } = req.body as {
      agentId?: number | string;
      email?: string;
      agentName?: string;
      description?: string;
      agentType?: string;
      serviceUrl?: string;
      tools?: unknown;
    };

    // Validate agentId (database ID from Step 1)
    if (agentId === undefined || agentId === null) {
      res.status(400).json({ error: 'agentId (database ID from Step 1) is required' });
      return;
    }
    const numericAgentId = typeof agentId === 'string' ? parseInt(agentId, 10) : agentId;
    if (!Number.isFinite(numericAgentId) || numericAgentId < 1) {
      res.status(400).json({ error: 'agentId must be a valid positive number' });
      return;
    }

    // Validate required fields for profile update
    const hasAgentName = agentName && typeof agentName === 'string' && agentName.trim().length > 0;
    if (!hasAgentName) {
      res.status(400).json({ error: 'agentName is required' });
      return;
    }

    const hasAgentType = agentType && typeof agentType === 'string' && agentType.trim().length > 0;
    if (!hasAgentType) {
      res.status(400).json({ error: 'agentType is required' });
      return;
    }

    // Normalize optional fields
    const normalizedEmail = email ? String(email).trim() : undefined;
    const normalizedAgentName = agentName ? String(agentName).trim() : undefined;
    const normalizedDescription = description ? String(description).trim() : undefined;
    const normalizedAgentType = agentType ? String(agentType).trim() : undefined;
    const normalizedServiceUrl = serviceUrl ? String(serviceUrl).trim() : undefined;
    const normalizedTools = tools ? (typeof tools === 'string' ? tools.trim() : tools) : undefined;

    const db = getDbClient();

    // Update agent by database ID (from Step 1)
    console.log('[agentFlow.update] Attempting update with agentId:', numericAgentId);
    
    try {
      const updatedAgent = await db.agent.update({
        where: { id: numericAgentId },
        data: {
          ...(normalizedEmail ? { email: normalizedEmail } : {}),
          ...(normalizedAgentName ? { agentName: normalizedAgentName } : {}),
          ...(normalizedDescription ? { description: normalizedDescription } : {}),
          ...(normalizedAgentType ? { agentType: normalizedAgentType } : {}),
          ...(normalizedServiceUrl ? { serviceUrl: normalizedServiceUrl } : {}),
          ...(normalizedTools ? { tools: normalizedTools } : {}),
        },
      });
      
      console.log('[agentFlow.update] Update successful for agentId:', numericAgentId);

      res.json({
        updated: true,
        agentId: updatedAgent.id,
        walletAddress: updatedAgent.walletAddress,
        agent: updatedAgent,
        message: 'Agent profile updated successfully.'
      });
    } catch (dbError) {
      console.error('[agentFlow.update] Database error:', dbError instanceof Error ? dbError.message : String(dbError));
      throw dbError;
    }
  } catch (error) {
    next(error);
  }
});

router.post('/autonomous/onboard-subscribe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      idempotencyKey,
      walletAddress,
      email,
      agentName,
      description,
      agentType,
      serviceUrl,
      tools,
      subscriptionTier,
      amount,
      recipient,
    } = req.body as {
      idempotencyKey?: string;
      walletAddress?: string;
      email?: string;
      agentName?: string;
      description?: string;
      agentType?: string;
      serviceUrl?: string;
      tools?: unknown;
      subscriptionTier?: string;
      amount?: number;
      recipient?: string;
    };

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      res.status(400).json({ error: 'idempotencyKey is required' });
      return;
    }

    if (!walletAddress || typeof walletAddress !== 'string' || !isAddress(walletAddress.trim())) {
      res.status(400).json({ error: 'walletAddress is required and must be a valid EVM address' });
      return;
    }

    if (!agentName || typeof agentName !== 'string' || !agentName.trim()) {
      res.status(400).json({ error: 'agentName is required' });
      return;
    }

    if (!agentType || typeof agentType !== 'string' || !agentType.trim()) {
      res.status(400).json({ error: 'agentType is required' });
      return;
    }

    const normalizedIdempotencyKey = idempotencyKey.trim();

    const cached = autonomousCompleted.get(normalizedIdempotencyKey);
    if (cached) {
      res.json({ ...cached, idempotentReplay: true });
      return;
    }

    const inFlight = autonomousInFlight.get(normalizedIdempotencyKey);
    if (inFlight !== undefined) {
      const replay = await inFlight;
      res.json({ ...replay, idempotentReplay: true });
      return;
    }

    const workflowPromise = (async (): Promise<AutonomousWorkflowResponse> => {
      const workflowId = randomUUID();
      const normalizedWalletAddress = walletAddress.trim();
      const normalizedEmail = typeof email === 'string' && email.trim() ? email.trim() : null;
      const normalizedAgentName = agentName.trim();
      const normalizedDescription = typeof description === 'string' && description.trim() ? description.trim() : null;
      const normalizedAgentType = agentType.trim();
      const normalizedServiceUrl = typeof serviceUrl === 'string' && serviceUrl.trim() ? serviceUrl.trim() : null;
      const normalizedRecipient =
        typeof recipient === 'string' && recipient.trim().length > 0
          ? recipient.trim()
          : normalizedWalletAddress;

      const fallbackTier = typeof subscriptionTier === 'string' ? subscriptionTier : 'pro';
      const requestedAmount =
        typeof amount === 'number' && Number.isFinite(amount) && amount > 0
          ? amount
          : getCreditAmountForTier(fallbackTier);

      const stages: AutonomousWorkflowResponse['stages'] = {
        enroll: { status: 'failed' },
        profileUpdate: { status: 'failed' },
        subscriptionDecision: { status: 'failed' },
        creditApply: { status: 'failed' },
      };

      try {
        const db = getDbClient();

        const normalizedTools = (() => {
          if (tools === undefined) return undefined;
          if (typeof tools === 'string') {
            const values = tools
              .split(',')
              .map(item => item.trim())
              .filter(Boolean);
            return values as Prisma.InputJsonValue;
          }
          if (Array.isArray(tools)) return tools as Prisma.InputJsonValue;
          if (tools && typeof tools === 'object') return tools as Prisma.InputJsonValue;
          return undefined;
        })();

        const toolsPatch = normalizedTools === undefined ? {} : { tools: normalizedTools };

        const persistedAgent = await db.agent.upsert({
          where: { walletAddress: normalizedWalletAddress },
          update: {
            email: normalizedEmail,
            agentName: normalizedAgentName,
            description: normalizedDescription,
            agentType: normalizedAgentType,
            serviceUrl: normalizedServiceUrl,
            agenticWalletRegistered: true,
            ...toolsPatch,
          },
          create: {
            walletAddress: normalizedWalletAddress,
            email: normalizedEmail,
            agentName: normalizedAgentName,
            description: normalizedDescription,
            agentType: normalizedAgentType,
            serviceUrl: normalizedServiceUrl,
            agenticWalletRegistered: true,
            ...toolsPatch,
          },
        });

        const client = createClient(normalizedWalletAddress);
        if (!hasSubscriptionContract(client.config) || !hasGuarantorContract(client.config)) {
          const reason = 'On-chain subscription and guarantor contracts must be configured';
          stages.enroll = { status: 'failed', error: reason };
          stages.profileUpdate = { status: 'failed', error: reason };
          stages.subscriptionDecision = { status: 'failed', error: reason };
          stages.creditApply = { status: 'failed', error: reason };
          return {
            workflowId,
            idempotencyKey: normalizedIdempotencyKey,
            mode: 'autonomous',
            stages,
            finalStatus: 'failed',
            reason,
            idempotentReplay: false,
          };
        }

        const scoreAfterEnroll = await client.credit.getScore();
        const limitAfterEnroll = await client.credit.getLimit();
        stages.enroll = {
          status: 'completed',
          data: {
            agentId: persistedAgent.id,
            walletAddress: persistedAgent.walletAddress,
            score: scoreAfterEnroll.value,
            tier: scoreAfterEnroll.tier,
            line: limitAfterEnroll.current,
          },
        };

        stages.profileUpdate = {
          status: 'completed',
          data: {
            agentId: persistedAgent.id,
            agentName: persistedAgent.agentName,
            agentType: persistedAgent.agentType,
          },
        };

        const subscriptionBefore = await client.subscription.checkStatus();
        let subscribedNow = false;
        if (!subscriptionBefore.active) {
          await client.subscription.subscribe({ duration: '30 days', autoRenew: true });
          subscribedNow = true;
        }
        const subscriptionAfter = await client.subscription.checkStatus();
        stages.subscriptionDecision = {
          status: 'completed',
          data: {
            activeBefore: subscriptionBefore.active,
            subscribedNow,
            activeAfter: subscriptionAfter.active,
            daysLeft: subscriptionAfter.daysLeft,
          },
        };

        if (!isAddress(normalizedRecipient)) {
          const reason = 'recipient is required and must be a valid EVM address';
          stages.creditApply = { status: 'failed', error: reason };
          return {
            workflowId,
            idempotencyKey: normalizedIdempotencyKey,
            mode: 'autonomous',
            stages,
            finalStatus: 'failed',
            reason,
            idempotentReplay: false,
          };
        }

        const read = getGuarantorReadContract(client.config);
        const write = getGuarantorWriteContract(client.config);
        if (!read || !write) {
          const reason = 'On-chain apply requires rpcUrl, guarantor address, and privateKey';
          stages.creditApply = { status: 'failed', error: reason };
          return {
            workflowId,
            idempotencyKey: normalizedIdempotencyKey,
            mode: 'autonomous',
            stages,
            finalStatus: 'failed',
            reason,
            idempotentReplay: false,
          };
        }

        const amountWei = parseEther(String(requestedAmount));
        const ttlSeconds = Math.max(
          60,
          Number(process.env.BONDCREDIT_DEFAULT_GUARANTEE_TTL_SECONDS ?? 25 * 60),
        );

        const freeLiquidityWei = await read.freeLiquidityWei();
        if (amountWei > freeLiquidityWei) {
          const score = await client.credit.getScore();
          const limit = await client.credit.getLimit();
          const reason = `Insufficient liquidity in guarantor pool (requested ${formatEther(amountWei)} OKB, available ${formatEther(freeLiquidityWei)} OKB)`;

          stages.creditApply = {
            status: 'completed',
            data: {
              approved: false,
              reason,
              score,
              limit,
            },
          };

          return {
            workflowId,
            idempotencyKey: normalizedIdempotencyKey,
            mode: 'autonomous',
            stages,
            finalStatus: 'rejected',
            reason,
            idempotentReplay: false,
          };
        }

        try {
          const guaranteeId = await write.createGuarantee.staticCall(normalizedRecipient, amountWei, ttlSeconds);
          const tx = await write.createGuarantee(normalizedRecipient, amountWei, ttlSeconds);
          await tx.wait();

          const status = await read.checkGuarantee(guaranteeId);
          const expiresAt = new Date(Number(status[4]) * 1000).toISOString();
          const score = await client.credit.getScore();
          const limit = await client.credit.getLimit();

          stages.creditApply = {
            status: 'completed',
            data: {
              approved: true,
              amount: requestedAmount,
              score,
              limit,
              guarantee: {
                guaranteeId,
                proof: tx.hash,
                expiresAt,
              },
            },
          };

          return {
            workflowId,
            idempotencyKey: normalizedIdempotencyKey,
            mode: 'autonomous',
            stages,
            finalStatus: 'approved',
            idempotentReplay: false,
          };
        } catch (error) {
          const reason = decodeGuarantorErrorMessage(error);
          const score = await client.credit.getScore();
          const limit = await client.credit.getLimit();

          stages.creditApply = {
            status: 'completed',
            data: {
              approved: false,
              reason,
              score,
              limit,
            },
          };

          return {
            workflowId,
            idempotencyKey: normalizedIdempotencyKey,
            mode: 'autonomous',
            stages,
            finalStatus: 'rejected',
            reason,
            idempotentReplay: false,
          };
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Autonomous orchestration failed';
        if (stages.enroll.status !== 'completed') stages.enroll = { status: 'failed', error: reason };
        if (stages.profileUpdate.status !== 'completed') stages.profileUpdate = { status: 'failed', error: reason };
        if (stages.subscriptionDecision.status !== 'completed') stages.subscriptionDecision = { status: 'failed', error: reason };
        if (stages.creditApply.status !== 'completed') stages.creditApply = { status: 'failed', error: reason };

        return {
          workflowId,
          idempotencyKey: normalizedIdempotencyKey,
          mode: 'autonomous',
          stages,
          finalStatus: 'failed',
          reason,
          idempotentReplay: false,
        };
      }
    })();

    autonomousInFlight.set(normalizedIdempotencyKey, workflowPromise);

    const result = await workflowPromise;
    autonomousInFlight.delete(normalizedIdempotencyKey);
    autonomousCompleted.set(normalizedIdempotencyKey, result);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

const handleCreditApply = async (req: Request, res: Response, next: NextFunction) => {
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
};

router.post('/credit/apply', handleCreditApply);
router.post('/apply', handleCreditApply);

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

router.post('/agent/subscribe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.body as { agentId?: string };
    if (!agentId || typeof agentId !== 'string' || !isAddress(agentId.trim())) {
      res.status(400).json({ error: 'agentId is required and must be a valid EVM address' });
      return;
    }

    const normalizedAgentId = agentId.trim();
    const db = getDbClient();
    const agent = await db.agent.findFirst({
      where: {
        walletAddress: {
          equals: normalizedAgentId,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        walletAddress: true,
      },
    });

    if (!agent) {
      res.status(404).json({ error: 'Agent not found for provided wallet address' });
      return;
    }

    const client = createClient(agent.walletAddress);
    if (!hasSubscriptionContract(client.config)) {
      res.status(500).json({ error: 'On-chain subscription contract must be configured' });
      return;
    }

    const subscriptionManagerAddress = client.config.contracts?.subscriptionManager;
    if (!client.config.rpcUrl || !subscriptionManagerAddress) {
      res.status(500).json({ error: 'rpcUrl and subscription manager contract must be configured' });
      return;
    }

    const chainIdRaw = process.env.BONDCREDIT_CHAIN_ID ?? process.env.VITE_BONDCREDIT_CHAIN_ID ?? '195';
    const chainId = Number(chainIdRaw);
    if (!Number.isFinite(chainId) || chainId < 1) {
      res.status(500).json({ error: 'BONDCREDIT_CHAIN_ID must be a valid positive integer' });
      return;
    }

    const defaultDays = Number(process.env.BONDCREDIT_DEFAULT_SUBSCRIPTION_DAYS ?? 30);
    const daysToBuy = Math.max(1, Math.trunc(Number.isFinite(defaultDays) ? defaultDays : 30));

    const subscriptionRead = getSubscriptionReadContract(client.config);
    if (!subscriptionRead) {
      res.status(500).json({ error: 'Unable to initialize subscription read contract' });
      return;
    }

    const pricePerDayWei = (await subscriptionRead.pricePerDayWei()) as bigint;
    const totalValueWei = pricePerDayWei * BigInt(daysToBuy);

    const iface = new Interface(subscriptionManagerAbi);
    const calldata = iface.encodeFunctionData('subscribe', [daysToBuy]);

    const txHash = await submitOkxManagedSubscriptionTx({
      agentWalletAddress: agent.walletAddress,
      contractAddress: subscriptionManagerAddress,
      chainId,
      data: calldata,
      valueWei: totalValueWei,
    });

    await verifySubscriptionTransaction({
      rpcUrl: client.config.rpcUrl,
      txHash,
      expectedContractAddress: subscriptionManagerAddress,
      expectedFromAddress: agent.walletAddress,
      expectedValueWei: totalValueWei,
      expectedDaysToBuy: daysToBuy,
    });

    const updatedAgent = await db.agent.update({
      where: { id: agent.id },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionTxHash: txHash,
      },
      select: {
        walletAddress: true,
      },
    });

    res.json({
      status: 'SUCCESS',
      txHash,
      agentId: updatedAgent.walletAddress,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/subscription/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Always use backend signer as agentId
    const backendAgentId = process.env.BONDCREDIT_SUBSCRIPTION_AGENT_ID ||
      '0xd931713CD30c6dBD729EDce527Ac942f7A0EC273';
    const client = createClient(backendAgentId);
    const status = await client.subscription.checkStatus();
    res.json({ subscription: status, agentId: backendAgentId });
  } catch (error) {
    next(error);
  }
});

router.post('/subscription/subscribe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { duration, autoRenew } = req.body as {
      duration?: string;
      autoRenew?: boolean;
    };

    // Always use backend signer as agentId
    const backendAgentId = process.env.BONDCREDIT_SUBSCRIPTION_AGENT_ID ||
      '0xd931713CD30c6dBD729EDce527Ac942f7A0EC273';
    const client = createClient(backendAgentId);
    const result = await client.subscription.subscribe({
      duration: typeof duration === 'string' && duration.trim() ? duration.trim() : undefined,
      autoRenew: typeof autoRenew === 'boolean' ? autoRenew : undefined,
    });

    res.json({ subscription: result, agentId: backendAgentId });
  } catch (error) {
    next(error);
  }
});

router.post('/subscription/renew', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Always use backend signer as agentId
    const backendAgentId = process.env.BONDCREDIT_SUBSCRIPTION_AGENT_ID ||
      '0xd931713CD30c6dBD729EDce527Ac942f7A0EC273';
    const client = createClient(backendAgentId);
    const result = await client.subscription.renew();
    res.json({ subscription: result, agentId: backendAgentId });
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
