import express from 'express';
import riskRoutes from './routes/risk.js';
import guaranteeRoutes from './routes/guarantee.js';
import rebalanceRoutes from './routes/rebalance.js';
import analyticsRoutes from './routes/analytics.js';
import type { NextFunction, Request, Response } from 'express';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[server] ${req.method} ${req.path}`);
  next();
});

app.get('/.well-known/skill.md', (_req: Request, res: Response) => {
  const skillMd = `# BondCredit Agent

## Description

Hybrid on-chain/off-chain agent providing credit guarantees, risk scoring, and vault management.

## Base URL

http://localhost:3000

## Authentication

None (can be extended to API key)

---

## Capabilities

### Assess Risk

Endpoint:
POST /risk-score

Request:
{
"agentId": "string"
}

Response:
{
"riskScore": number
}

---

### Issue Credit Guarantee

Endpoint:
POST /guarantee

Request:
{
"agentId": "string",
"amount": number
}

Response:
{
"guaranteeId": "string",
"status": "approved | rejected"
}

---

### Rebalance Vault

Endpoint:
POST /rebalance

Request:
{
"vaultId": "string"
}

Response:
{
"status": "success"
}

---

### Get Volatility

Endpoint:
GET /volatility

Response:
{
"volatility": number
}
`;

  res.type('text/markdown').send(skillMd);
});

app.use(riskRoutes);
app.use(guaranteeRoutes);
app.use(rebalanceRoutes);
app.use(analyticsRoutes);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error('[server] error', message);
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`[server] BondCredit wrapper listening on http://localhost:${PORT}`);
});
