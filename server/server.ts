import 'dotenv/config';
import express from 'express';
import riskRoutes from './routes/risk.js';
import guaranteeRoutes from './routes/guarantee.js';
import rebalanceRoutes from './routes/rebalance.js';
import analyticsRoutes from './routes/analytics.js';
import agentFlowRoutes from './routes/agentFlow';
import tradeRoutes from './routes/trade.js';
import type { NextFunction, Request, Response } from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { disconnectDbClient, getDbClient } from './db/client.js';

const app = express();
const PORT = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const skillPath = join(__dirname, '../.well-known/skill.md');

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return 'unknown error';
  }
}

async function readCanonicalSkillMd(): Promise<string> {
  return readFile(skillPath, 'utf-8');
}

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
    const skillMd = await readCanonicalSkillMd();
    res.type('text/markdown').send(skillMd);
  } catch (error) {
    next(error);
  }
});

// Backward-compatible alias for older clients that request uppercase SKILL path.
app.get('/.well-known/SKILL.md', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const skillMd = await readCanonicalSkillMd();
    res.setHeader('x-bondcredit-skill-path', '/.well-known/skill.md');
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
app.use(tradeRoutes);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error('[server] error', message);
  res.status(500).json({ error: message });
});

if (process.env.DATABASE_URL) {
  // Warm up Prisma early only when DATABASE_URL is configured.
  try {
    await getDbClient().$connect();
  } catch (error: unknown) {
    const message = formatUnknownError(error);
    console.error('[server] database connection failed', message);
  }
} else {
  console.warn('[server] DATABASE_URL not set; database layer is disabled');
}

const shutdown = async (signal: string) => {
  try {
    await disconnectDbClient();
  } catch (error) {
    const message = formatUnknownError(error);
    console.error('[server] database disconnect failed', message);
  } finally {
    process.exit(signal === 'SIGINT' ? 130 : 143);
  }
};

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

app.listen(PORT, () => {
  console.log(`[server] BondCredit wrapper listening on ${PORT}`);
});
