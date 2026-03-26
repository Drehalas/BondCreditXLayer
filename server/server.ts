import 'dotenv/config';
import express from 'express';
import riskRoutes from './routes/risk.js';
import guaranteeRoutes from './routes/guarantee.js';
import rebalanceRoutes from './routes/rebalance.js';
import analyticsRoutes from './routes/analytics.js';
import agentFlowRoutes from './routes/agentFlow';
import type { NextFunction, Request, Response } from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const app = express();
const PORT = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const skillPath = join(__dirname, '../.well-known/skill.md');

app.use(express.json());
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[server] ${req.method} ${req.path}`);
  next();
});

app.get('/.well-known/skill.md', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const skillMd = await readFile(skillPath, 'utf-8');
    res.type('text/markdown').send(skillMd);
  } catch (error) {
    next(error);
  }
});

app.use(riskRoutes);
app.use(guaranteeRoutes);
app.use(rebalanceRoutes);
app.use(analyticsRoutes);
app.use(agentFlowRoutes);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error('[server] error', message);
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`[server] BondCredit wrapper listening on ${PORT}`);
});
