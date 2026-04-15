import { BondCreditClient } from '../src/index.js';
import type { BondCreditClientConfig } from '../src/index.js';

const DEFAULT_MAINNET_SUBSCRIPTION_MANAGER = '0xCEa6DF320e3233e17e3f66949F51D0ef10ad4a08';
const DEFAULT_MAINNET_PAYMENT_GUARANTOR = '0xD10f3D2790EAED337DB04690D9F02B4Be04400da';
const DEFAULT_TESTNET_SUBSCRIPTION_MANAGER = '0xAEA215B9F67E0d87B9B89828A1F2dE365Ef1EAd5';
const DEFAULT_TESTNET_PAYMENT_GUARANTOR = '0x137bee465E12A5F82e051ec2185F2477a32c4f70';

function resolveNetwork(): BondCreditClientConfig['network'] {
  return (process.env.BONDCREDIT_NETWORK as BondCreditClientConfig['network']) ?? 'xlayer-mainnet';
}

function resolveRpcUrl(network: BondCreditClientConfig['network']): string {
  if (network === 'xlayer-mainnet') {
    return process.env.XLAYER_MAINNET_RPC_URL || 'https://rpc.xlayer.tech';
  }

  return process.env.XLAYER_TESTNET_RPC_URL || 'https://testrpc.xlayer.tech';
}

function resolveContracts(network: BondCreditClientConfig['network']) {
  if (network === 'xlayer-mainnet') {
    return {
      subscriptionManager:
        process.env.BONDCREDIT_MAINNET_SUBSCRIPTION_MANAGER ||
        process.env.BONDCREDIT_SUBSCRIPTION_MANAGER ||
        DEFAULT_MAINNET_SUBSCRIPTION_MANAGER,
      paymentGuarantor:
        process.env.BONDCREDIT_MAINNET_PAYMENT_GUARANTOR ||
        process.env.BONDCREDIT_PAYMENT_GUARANTOR ||
        DEFAULT_MAINNET_PAYMENT_GUARANTOR,
    };
  }

  return {
    subscriptionManager: process.env.BONDCREDIT_SUBSCRIPTION_MANAGER || DEFAULT_TESTNET_SUBSCRIPTION_MANAGER,
    paymentGuarantor: process.env.BONDCREDIT_PAYMENT_GUARANTOR || DEFAULT_TESTNET_PAYMENT_GUARANTOR,
  };
}

export function createClient(agentId: string): BondCreditClient {
  const network = resolveNetwork();

  const config: BondCreditClientConfig = {
    network,
    agentId,
    privateKey: process.env.DEPLOYER_PRIVATE_KEY || process.env.VITE_DEPLOYER_PRIVATE_KEY || undefined,
    rpcUrl: resolveRpcUrl(network),
    contracts: resolveContracts(network),
  };

  return new BondCreditClient(config);
}
