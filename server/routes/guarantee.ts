import { NextFunction, Request, Response, Router } from 'express';
import { createClient } from '../client.js';
import {
  CreditScoreTooLowError,
  InsufficientCreditError,
  SubscriptionInactiveError,
} from '../../src/lib/errors.js';

const router = Router();

router.post('/guarantee', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId, amount } = req.body as { agentId?: string; amount?: number };
    if (!agentId || typeof agentId !== 'string') {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'amount must be a positive number' });
      return;
    }

    const client = createClient(agentId);
    const guarantee = await client.x402.guaranteePayment({
      recipient: agentId,
      amount: `${amount} OKB`,
      service: 'credit-guarantee',
      endpoint: 'bondcredit://guarantee',
    });

    res.json({
      guaranteeId: guarantee.guaranteeId,
      status: 'approved' as const,
    });
  } catch (error) {
    if (
      error instanceof SubscriptionInactiveError ||
      error instanceof CreditScoreTooLowError ||
      error instanceof InsufficientCreditError ||
      (error instanceof Error &&
        (error.message.includes('Recipient must be a valid EVM address') ||
          error.message.includes('requires rpcUrl, guarantor address, and privateKey')))
    ) {
      res.json({ guaranteeId: '', status: 'rejected' as const });
      return;
    }
    next(error);
  }
});

export default router;
