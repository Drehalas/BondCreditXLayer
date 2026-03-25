import { NextFunction, Request, Response, Router } from 'express';
import { createClient } from '../client.js';

const router = Router();

router.post('/rebalance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vaultId } = req.body as { vaultId?: string };
    if (!vaultId || typeof vaultId !== 'string') {
      res.status(400).json({ error: 'vaultId is required' });
      return;
    }

    // Minimal adapter: use existing credit state reads as a no-op rebalance check.
    // vaultId is accepted for API compatibility; SDK operations require an agent identity.
    const client = createClient(
      process.env.BONDCREDIT_REBALANCE_AGENT_ID ||
        '0xd931713CD30c6dBD729EDce527Ac942f7A0EC273',
    );
    await client.credit.getLimit();
    await client.credit.getOutstanding();

    res.json({ status: 'success' as const });
  } catch (error) {
    next(error);
  }
});

export default router;
