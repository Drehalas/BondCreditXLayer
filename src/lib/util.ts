export function nowIso(): string {
  return new Date().toISOString();
}

export function randomId(prefix: string): string {
  const rand = Math.random().toString(16).slice(2);
  const time = Date.now().toString(16);
  return `${prefix}_${time}_${rand}`;
}

export function clampInt(n: number, min: number, max: number): number {
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

