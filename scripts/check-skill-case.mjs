import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const canonicalSkill = resolve(repoRoot, '.well-known/skill.md');
const wrongCaseAtRoot = resolve(repoRoot, '.well-known/SKILL.md');
const mirrorSkill = resolve(repoRoot, 'frontend/public/.well-known/SKILL.md');
const serverPath = resolve(repoRoot, 'server/server.ts');

if (!existsSync(canonicalSkill)) {
  console.error('[skill:check-case] Missing canonical .well-known/skill.md');
  process.exit(1);
}

if (existsSync(wrongCaseAtRoot)) {
  console.error('[skill:check-case] Root uppercase .well-known/SKILL.md should not exist. Use lowercase canonical file.');
  process.exit(1);
}

if (!existsSync(mirrorSkill)) {
  console.error('[skill:check-case] Missing frontend compatibility mirror frontend/public/.well-known/SKILL.md');
  process.exit(1);
}

if (!existsSync(serverPath)) {
  console.error('[skill:check-case] Missing server/server.ts');
  process.exit(1);
}

const serverSource = readFileSync(serverPath, 'utf8');
if (!serverSource.includes("'/.well-known/skill.md'")) {
  console.error('[skill:check-case] Canonical route /.well-known/skill.md not found in server/server.ts');
  process.exit(1);
}
if (!serverSource.includes("'/.well-known/SKILL.md'")) {
  console.error('[skill:check-case] Compatibility alias /.well-known/SKILL.md not found in server/server.ts');
  process.exit(1);
}

console.log('[skill:check-case] Passed');
