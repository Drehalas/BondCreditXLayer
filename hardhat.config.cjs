require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || '';
const XLAYER_TESTNET_RPC_URL = process.env.XLAYER_TESTNET_RPC_URL || '';
const XLAYER_MAINNET_RPC_URL = process.env.XLAYER_MAINNET_RPC_URL || '';

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    xlayerTestnet: {
      chainId: 1952,
      url: XLAYER_TESTNET_RPC_URL || 'https://testrpc.xlayer.tech',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },
    xlayerMainnet: {
      chainId: 196,
      url: XLAYER_MAINNET_RPC_URL || 'https://rpc.xlayer.tech',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  }
};
