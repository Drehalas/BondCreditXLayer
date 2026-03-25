import { BondCreditClient } from '../src/index.js';
import type { BondCreditClientConfig } from '../src/index.js';

const DEFAULT_SUBSCRIPTION_MANAGER =
  process.env.BONDCREDIT_SUBSCRIPTION_MANAGER ??
  '0x963dceE3ee2861f8c32E9d727aaA2bFE934D0E7c';
const DEFAULT_PAYMENT_GUARANTOR =
  process.env.BONDCREDIT_PAYMENT_GUARANTOR ??
  '0x45565b125Dc284330d5fB4f85530346Adc3B2751';

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
