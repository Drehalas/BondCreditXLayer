import { NextFunction, Request, Response, Router } from 'express';
import { createClient } from '../client.js';

const router = Router();

router.post('/risk-score', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Always use backend signer as agentId
    const backendAgentId = process.env.BONDCREDIT_RISK_AGENT_ID ||
      '0xd931713CD30c6dBD729EDce527Ac942f7A0EC273';
    const client = createClient(backendAgentId);
    const score = await client.credit.getScore();

    res.json({ riskScore: score.value, agentId: backendAgentId });
  } catch (error) {
    next(error);
  }
});

export default router;
