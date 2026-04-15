require('dotenv').config();
const { ethers } = require('ethers');

const EXPECTED_CHAIN_ID = 196;
const DEFAULT_RPC = 'https://rpc.xlayer.tech';

function fail(message) {
  console.error(`\n[preflight:mainnet] ERROR: ${message}`);
  process.exit(1);
}

function looksLikePlaceholder(url) {
  const lowered = url.toLowerCase();
  return (
    lowered.includes('your-mainnet-rpc-url') ||
    lowered.includes('example.com') ||
    lowered.includes('changeme')
  );
}

function normalizeRpcUrl() {
  const raw = (process.env.XLAYER_MAINNET_RPC_URL || '').trim();
  const url = raw || DEFAULT_RPC;

  if (looksLikePlaceholder(url)) {
    fail(
      'XLAYER_MAINNET_RPC_URL is still a placeholder in .env. Set it to a real X Layer mainnet RPC URL.',
    );
  }

  if (!URL.canParse(url)) {
    fail(`XLAYER_MAINNET_RPC_URL is not a valid URL: ${url}`);
  }

  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    fail(`XLAYER_MAINNET_RPC_URL must use http/https, got protocol: ${parsed.protocol}`);
  }

  return url;
}

function summarize(url) {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

async function probeChainId(url) {
  const timeoutMs = 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      fail(`RPC responded with HTTP ${res.status}. Check endpoint validity or provider permissions.`);
    }

    const payload = await res.json();
    if (!payload || typeof payload.result !== 'string') {
      fail('RPC response did not include jsonrpc result for eth_chainId.');
    }

    const chainId = Number(BigInt(payload.result));
    if (chainId !== EXPECTED_CHAIN_ID) {
      fail(`RPC chainId mismatch. Expected ${EXPECTED_CHAIN_ID}, got ${chainId}.`);
    }

    return chainId;
  } catch (err) {
    if (err?.name === 'AbortError') {
      fail(`RPC connect/request timed out after ${timeoutMs}ms. Endpoint unreachable from this network.`);
    }
    fail(`RPC probe failed: ${err?.message ?? String(err)}`);
  } finally {
    clearTimeout(timer);
  }
}

async function checkDeployerBalance(url) {
  const privateKey = (process.env.DEPLOYER_PRIVATE_KEY || '').trim();
  if (!privateKey) {
    fail('DEPLOYER_PRIVATE_KEY is missing in .env.');
  }

  const provider = new ethers.JsonRpcProvider(url);
  const wallet = new ethers.Wallet(privateKey, provider);
  const balance = await provider.getBalance(wallet.address);

  console.log(`[preflight:mainnet] Deployer: ${wallet.address}`);
  console.log(`[preflight:mainnet] Balance: ${ethers.formatEther(balance)} OKB`);

  if (balance === 0n) {
    fail('Deployer balance is zero. Fund this wallet with mainnet OKB before deploying.');
  }
}

async function main() {
  const rpcUrl = normalizeRpcUrl();
  console.log(`[preflight:mainnet] RPC endpoint: ${summarize(rpcUrl)}`);

  const chainId = await probeChainId(rpcUrl);
  console.log(`[preflight:mainnet] RPC chainId: ${chainId}`);

  await checkDeployerBalance(rpcUrl);

  console.log('[preflight:mainnet] All checks passed. Ready to deploy.');
}

main().catch((err) => {
  fail(err?.message ?? String(err));
});
