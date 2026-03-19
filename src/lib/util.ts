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

export function parseAmount(amount: string): { value: number; currency: string } {
  // Expected format: "<number> <CURRENCY>" (e.g. "0.01 OKB")
  const parts = amount.trim().split(/\s+/);
  const value = Number(parts[0]);
  const currency = parts[1] ?? 'XLAYER';
  return { value, currency };
}

export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  return '0x' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

