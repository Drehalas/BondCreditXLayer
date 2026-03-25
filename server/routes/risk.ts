import { NextFunction, Request, Response, Router } from 'express';
import { createClient } from '../client.js';

const router = Router();

router.post('/risk-score', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.body as { agentId?: string };
    if (!agentId || typeof agentId !== 'string') {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }

    const client = createClient(agentId);
    const score = await client.credit.getScore();

    res.json({ riskScore: score.value });
  } catch (error) {
    next(error);
  }
});

export default router;
