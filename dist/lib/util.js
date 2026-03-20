export function nowIso() {
    return new Date().toISOString();
}
export function randomId(prefix) {
    const rand = Math.random().toString(16).slice(2);
    const time = Date.now().toString(16);
    return `${prefix}_${time}_${rand}`;
}
export function clampInt(n, min, max) {
    const x = Math.trunc(n);
    return Math.max(min, Math.min(max, x));
}
export function parseAmount(amount) {
    // Expected format: "<number> <CURRENCY>" (e.g. "0.01 OKB")
    const parts = amount.trim().split(/\s+/);
    const value = Number(parts[0]);
    const currency = parts[1] ?? 'XLAYER';
    return { value, currency };
}
export function randomHex(bytes) {
    const arr = new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++)
        arr[i] = Math.floor(Math.random() * 256);
    return '0x' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}
//# sourceMappingURL=util.js.map