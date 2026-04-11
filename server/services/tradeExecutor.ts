import { TradeExecutionStatus, TradeSide } from '@prisma/client';
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  isAddress,
  parseUnits,
} from 'ethers';
import { randomBytes } from 'node:crypto';

export interface ExecuteTradeInput {
  walletAddress: string;
  pair: string;
  side: TradeSide;
  amount: number;
  slippageBps?: number;
  tokenIn?: string;
  tokenOut?: string;
}

export interface TradeExecutionResult {
  status: TradeExecutionStatus;
  txHash?: string;
  pnlDelta?: number;
  executionVenue: 'uniswap-simulated' | 'uniswap-v2';
  errorMessage?: string;
  metadata: {
    adapter: 'uniswap-v1' | 'uniswap-v2';
    pair: string;
    side: TradeSide;
    amount: number;
    slippageBps: number;
    walletAddress: string;
    tokenIn?: string;
    tokenOut?: string;
    amountInWei?: string;
    amountOutMinWei?: string;
    estimatedAmountOutWei?: string;
  };
}

export interface TradeExecutor {
  execute(input: ExecuteTradeInput): Promise<TradeExecutionResult>;
}

class UniswapSimulatedExecutor implements TradeExecutor {
  async execute(input: ExecuteTradeInput): Promise<TradeExecutionResult> {
    const normalizedPair = input.pair.trim().toUpperCase();
    const slippageBps = Math.max(1, Math.trunc(input.slippageBps ?? 50));

    const seed = `${normalizedPair}:${input.side}:${input.amount.toFixed(6)}`;
    const pseudo = [...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const didSucceed = pseudo % 5 !== 0;

    if (!didSucceed) {
      return {
        status: TradeExecutionStatus.FAILED,
        executionVenue: 'uniswap-simulated',
        errorMessage: 'Simulated Uniswap execution failed due to route slippage',
        metadata: {
          adapter: 'uniswap-v1',
          pair: normalizedPair,
          side: input.side,
          amount: input.amount,
          slippageBps,
          walletAddress: input.walletAddress,
          tokenIn: input.tokenIn,
          tokenOut: input.tokenOut,
        },
      };
    }

    const direction = input.side === TradeSide.SELL || input.side === TradeSide.SHORT ? -1 : 1;
    const pnlRaw = Number(((pseudo % 37) / 1000).toFixed(4));
    const pnlDelta = Number((pnlRaw * direction).toFixed(4));
    const txHash = `0x${randomBytes(32).toString('hex')}`;

    return {
      status: TradeExecutionStatus.SUCCESS,
      txHash,
      pnlDelta,
      executionVenue: 'uniswap-simulated',
      metadata: {
        adapter: 'uniswap-v1',
        pair: normalizedPair,
        side: input.side,
        amount: input.amount,
        slippageBps,
        walletAddress: input.walletAddress,
        tokenIn: input.tokenIn,
        tokenOut: input.tokenOut,
      },
    };
  }
}

const UNISWAP_V2_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
] as const;

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
] as const;

type UniswapV2RouterContract = Contract & {
  getAmountsOut(amountIn: bigint, path: string[]): Promise<bigint[]>;
  swapExactTokensForTokens(
    amountIn: bigint,
    amountOutMin: bigint,
    path: string[],
    to: string,
    deadline: number,
  ): Promise<{ hash: string; wait(): Promise<{ hash: string }> }>;
  getAddress(): Promise<string>;
};

type Erc20Contract = Contract & {
  decimals(): Promise<number>;
  allowance(owner: string, spender: string): Promise<bigint>;
  approve(spender: string, value: bigint): Promise<{ wait(): Promise<unknown> }>;
};

class UniswapV2OnchainExecutor implements TradeExecutor {
  private readonly provider: JsonRpcProvider;
  private readonly signer: Wallet;
  private readonly router: UniswapV2RouterContract;

  constructor() {
    const rpcUrl = process.env.XLAYER_TESTNET_RPC_URL;
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.VITE_DEPLOYER_PRIVATE_KEY;
    const routerAddress = process.env.BONDCREDIT_UNISWAP_V2_ROUTER;

    if (!rpcUrl || !privateKey || !routerAddress) {
      throw new Error(
        'BONDCREDIT_UNISWAP_V2_ROUTER, XLAYER_TESTNET_RPC_URL, and DEPLOYER_PRIVATE_KEY are required for uniswap-v2 mode',
      );
    }
    if (!isAddress(routerAddress)) {
      throw new Error('BONDCREDIT_UNISWAP_V2_ROUTER must be a valid address');
    }

    this.provider = new JsonRpcProvider(rpcUrl);
    this.signer = new Wallet(privateKey, this.provider);
    this.router = new Contract(routerAddress, UNISWAP_V2_ROUTER_ABI, this.signer) as UniswapV2RouterContract;
  }

  async execute(input: ExecuteTradeInput): Promise<TradeExecutionResult> {
    if (!input.tokenIn || !isAddress(input.tokenIn)) {
      throw new Error('tokenIn is required and must be a valid address in uniswap-v2 mode');
    }
    if (!input.tokenOut || !isAddress(input.tokenOut)) {
      throw new Error('tokenOut is required and must be a valid address in uniswap-v2 mode');
    }
    if (input.tokenIn.toLowerCase() === input.tokenOut.toLowerCase()) {
      throw new Error('tokenIn and tokenOut must be different addresses');
    }

    const slippageBps = Math.max(1, Math.min(5_000, Math.trunc(input.slippageBps ?? 50)));
    const tokenInContract = new Contract(input.tokenIn, ERC20_ABI, this.signer) as Erc20Contract;
    const decimals = Number(await tokenInContract.decimals());
    const amountInWei = parseUnits(String(input.amount), decimals);
    const path = [input.tokenIn, input.tokenOut];

    const quoted = (await this.router.getAmountsOut(amountInWei, path)) as bigint[];
    const estimatedAmountOut = quoted[quoted.length - 1] ?? 0n;
    const amountOutMin = (estimatedAmountOut * BigInt(10_000 - slippageBps)) / 10_000n;

    const signerAddress = await this.signer.getAddress();
    const routerAddress = await this.router.getAddress();
    const allowance = (await tokenInContract.allowance(signerAddress, routerAddress)) as bigint;
    if (allowance < amountInWei) {
      const approveTx = await tokenInContract.approve(routerAddress, amountInWei);
      await approveTx.wait();
    }

    const deadline = Math.floor(Date.now() / 1000) + 10 * 60;
    try {
      const tx = await this.router.swapExactTokensForTokens(
        amountInWei,
        amountOutMin,
        path,
        signerAddress,
        deadline,
      );
      const receipt = await tx.wait();
      const txHash = receipt?.hash ?? tx.hash;

      // Lightweight pnl proxy for hackathon telemetry.
      const pnlDelta = Number(((input.amount * slippageBps) / 10_000).toFixed(6));

      return {
        status: TradeExecutionStatus.SUCCESS,
        txHash,
        pnlDelta,
        executionVenue: 'uniswap-v2',
        metadata: {
          adapter: 'uniswap-v2',
          pair: input.pair.trim().toUpperCase(),
          side: input.side,
          amount: input.amount,
          slippageBps,
          walletAddress: input.walletAddress,
          tokenIn: input.tokenIn,
          tokenOut: input.tokenOut,
          amountInWei: amountInWei.toString(),
          amountOutMinWei: amountOutMin.toString(),
          estimatedAmountOutWei: estimatedAmountOut.toString(),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Uniswap on-chain trade failed';
      return {
        status: TradeExecutionStatus.FAILED,
        executionVenue: 'uniswap-v2',
        errorMessage: message,
        metadata: {
          adapter: 'uniswap-v2',
          pair: input.pair.trim().toUpperCase(),
          side: input.side,
          amount: input.amount,
          slippageBps,
          walletAddress: input.walletAddress,
          tokenIn: input.tokenIn,
          tokenOut: input.tokenOut,
          amountInWei: amountInWei.toString(),
          amountOutMinWei: amountOutMin.toString(),
          estimatedAmountOutWei: estimatedAmountOut.toString(),
        },
      };
    }
  }
}

export function getTradeExecutor(): TradeExecutor {
  const mode = (process.env.BONDCREDIT_TRADE_EXECUTOR_MODE ?? 'simulated').toLowerCase();
  if (mode === 'uniswap-v2') {
    return new UniswapV2OnchainExecutor();
  }
  return new UniswapSimulatedExecutor();
}
