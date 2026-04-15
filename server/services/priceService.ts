const OKX_MARKET_BASE_URL = process.env.BONDCREDIT_OKX_MARKET_BASE_URL ?? 'https://www.okx.com';
const OKX_TICKER_PATH = process.env.BONDCREDIT_OKX_MARKET_TICKER_PATH ?? '/api/v5/market/ticker';

function symbolToInstId(tokenSymbol: string): string {
  const normalized = tokenSymbol.trim().toUpperCase();
  if (!normalized) throw new Error('tokenSymbol is required');

  // Allow explicit instrument IDs like ETH-USDT.
  if (normalized.includes('-')) return normalized;
  return `${normalized}-USDT`;
}

export async function getPrice(tokenSymbol: string): Promise<number> {
  const instId = symbolToInstId(tokenSymbol);
  const url = new URL(OKX_TICKER_PATH, OKX_MARKET_BASE_URL);
  url.searchParams.set('instId', instId);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Network error reaching OKX market endpoint: ${reason}`);
  }

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`OKX market request failed with status ${response.status}: ${bodyText.slice(0, 320)}`);
  }

  const payload = JSON.parse(bodyText) as {
    data?: Array<{ last?: string | number }>;
  };
  const rawPrice = payload.data?.[0]?.last;
  const price = typeof rawPrice === 'string' ? Number(rawPrice) : rawPrice;

  if (!Number.isFinite(price) || (price ?? 0) <= 0) {
    throw new Error(`No valid price returned for instrument ${instId}`);
  }

  return Number(price);
}
