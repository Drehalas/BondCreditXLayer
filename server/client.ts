import { BondCreditClient } from '../src/index.js';
import type { BondCreditClientConfig } from '../src/index.js';

const DEFAULT_SUBSCRIPTION_MANAGER =
  process.env.BONDCREDIT_SUBSCRIPTION_MANAGER ??
  '0xAEA215B9F67E0d87B9B89828A1F2dE365Ef1EAd5';
const DEFAULT_PAYMENT_GUARANTOR =
  process.env.BONDCREDIT_PAYMENT_GUARANTOR ??
  '0x137bee465E12A5F82e051ec2185F2477a32c4f70';

export function createClient(agentId: string): BondCreditClient {
  const config: BondCreditClientConfig = {
    network: (process.env.BONDCREDIT_NETWORK as BondCreditClientConfig['network']) ?? 'xlayer-testnet',
    agentId,
    privateKey: process.env.DEPLOYER_PRIVATE_KEY || process.env.VITE_DEPLOYER_PRIVATE_KEY || undefined,
    rpcUrl: process.env.XLAYER_TESTNET_RPC_URL || 'https://testrpc.xlayer.tech',
    contracts: {
      subscriptionManager: DEFAULT_SUBSCRIPTION_MANAGER,
      paymentGuarantor: DEFAULT_PAYMENT_GUARANTOR,
    },
  };

  return new BondCreditClient(config);
}
