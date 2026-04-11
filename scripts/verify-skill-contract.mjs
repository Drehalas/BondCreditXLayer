import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const canonicalPath = resolve(repoRoot, '.well-known/skill.md');
const mirrorPath = resolve(repoRoot, 'frontend/public/.well-known/SKILL.md');

if (!existsSync(canonicalPath)) {
  console.error('[skill:verify-contract] Missing canonical file:', canonicalPath);
  process.exit(1);
}

const canonical = readFileSync(canonicalPath, 'utf8');
const endpointMatches = [...canonical.matchAll(/Endpoint:\s*(GET|POST)\s+([^\s]+)/g)];
const documented = new Set(endpointMatches.map((m) => `${m[1]} ${m[2]}`));

const expected = new Set([
  'GET /.well-known/skill.md',
  'GET /.well-known/SKILL.md',
  'POST /enroll',
  'POST /agent/update',
  'POST /autonomous/onboard-subscribe',
  'POST /credit/apply',
  'POST /apply',
  'GET /trade/tokens',
  'POST /trade/execute',
  'GET /score/status/:agentId',
  'GET /trades/history/:agentId?limit=20',
  'GET /trades/history/:agentId',
  'GET /unlocks/:agentId',
  'POST /demo/run-3-trades',
  'POST /credit/repay',
  'POST /credit/settle',
  'POST /subscription/status',
  'POST /subscription/subscribe',
  'POST /subscription/renew',
  'POST /guarantee',
  'GET /pool/status',
  'POST /pool/fund',
  'POST /rebalance',
  'POST /risk-score',
  'GET /volatility',
]);

const missing = [...expected].filter((e) => !documented.has(e));
const unexpected = [...documented].filter((e) => !expected.has(e));

if (missing.length > 0) {
  console.error('[skill:verify-contract] Missing endpoints in canonical skill.md:');
  for (const endpoint of missing) console.error(`- ${endpoint}`);
  process.exit(1);
}

if (unexpected.length > 0) {
  console.error('[skill:verify-contract] Unexpected endpoints in canonical skill.md:');
  for (const endpoint of unexpected) console.error(`- ${endpoint}`);
  process.exit(1);
}

if (!existsSync(mirrorPath)) {
  console.error('[skill:verify-contract] Missing compatibility mirror file:', mirrorPath);
  process.exit(1);
}

const mirror = readFileSync(mirrorPath, 'utf8');
if (mirror !== canonical) {
  console.error('[skill:verify-contract] Mirror SKILL.md does not match canonical .well-known/skill.md');
  process.exit(1);
}

console.log('[skill:verify-contract] Passed');
