import { NextFunction, Request, Response, Router } from 'express';
import { createClient } from '../client.js';

const router = Router();

function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

router.get('/volatility', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const client = createClient(process.env.BONDCREDIT_ANALYTICS_AGENT_ID || 'analytics-agent');
    const history = await client.analytics.getHistory('30d');
    const scores = history.scores.map((entry) => entry.score);
    const volatility = Number(stdDev(scores).toFixed(4));

    res.json({ volatility });
  } catch (error) {
    next(error);
  }
});

export default router;
