import { clampInt, nowIso, randomId } from '../util.js';
import { formatWeiAmount, getGuarantorReadContract, hasGuarantorContract, resolveAgentAddress } from '../onchain.js';
import { formatEther } from 'ethers';
export class CreditClient {
    cfg;
    constructor(cfg) {
        this.cfg = cfg;
    }
    async getScore() {
        // Scaffold default: treat the agent as reasonably healthy.
        // Replace with real indexed score retrieval when wiring to on-chain/indexer.
        return {
            value: 705,
            tier: 'Prime',
            updatedAt: nowIso(),
            factors: {
                subscription: 85,
                payments: 92,
                volume: 78,
                speed: 95,
            }
        };
    }
    async getAvailableCredit(currency) {
        if (hasGuarantorContract(this.cfg)) {
            const read = getGuarantorReadContract(this.cfg);
            const agent = resolveAgentAddress(this.cfg);
            if (!read || !agent) {
                throw new Error('On-chain credit mode requires rpcUrl, guarantor address, and resolvable agent address');
            }
            const freeLiquidityWei = (await read.freeLiquidityWei());
            const outstandingWei = (await read.outstandingByAgent(agent));
            // Phase-1 heuristic: agent can use free liquidity net of current outstanding debt.
            const availableWei = freeLiquidityWei > outstandingWei ? (freeLiquidityWei - outstandingWei) : 0n;
            const cur = currency ?? 'OKB';
            return { value: Number(formatEther(availableWei)), currency: cur, updatedAt: nowIso() };
        }
        // Scaffold default: provide a large allowance.
        // Real implementation should query ProgressiveLimits / outstanding position.
        const cur = currency ?? 'OKB';
        return { value: 1_000, currency: cur, updatedAt: nowIso() };
    }
    async request(inputOrAmount, purpose) {
        const input = typeof inputOrAmount === 'string'
            ? { amount: inputOrAmount, purpose }
            : inputOrAmount;
        // Scaffold approval based on available credit (very rough).
        const { value: availableValue, currency } = await this.getAvailableCredit(undefined);
        const requestedCurrency = input.amount.split(/\s+/)[1] ?? currency;
        const amountValue = Number(input.amount.split(/\s+/)[0]);
        if (!Number.isFinite(amountValue) || amountValue <= 0) {
            return { approved: false, reason: 'Invalid amount' };
        }
        if (requestedCurrency !== currency && requestedCurrency !== 'OKB') {
            return { approved: false, reason: 'Unsupported currency' };
        }
        if (amountValue > availableValue) {
            return { approved: false, reason: 'Insufficient available credit' };
        }
        const creditId = 'cred_' + randomId('id').slice(0, 12);
        const feeBps = clampInt(5, 0, 1000); // Scaffold: 0.05% fee
        const fee = `0.${Math.floor(Math.random() * 9999).toString().padStart(4, '0')} OKB`;
        const deadline = new Date(Date.now() + 60 * 60_000).toISOString();
        return {
            approved: true,
            creditId,
            amount: input.amount,
            fee,
            deadline
        };
    }
    async repay(arg1, arg2) {
        const input = typeof arg1 === 'string' ? { creditId: arg1, amount: arg2 ?? '' } : arg1;
        if (!input.creditId)
            return { success: false, newScore: 0 };
        if (!input.amount)
            return { success: false, newScore: 0 };
        // Scaffold: pretend repayment increases score by +5.
        return {
            success: true,
            newScore: 710,
            txHash: '0x' + randomId('tx').slice(0, 16)
        };
    }
    async checkEligibility(amount) {
        const amountValue = Number(amount.split(/\s+/)[0]);
        if (!Number.isFinite(amountValue) || amountValue <= 0) {
            return { eligible: false, reason: 'Invalid amount' };
        }
        const score = await this.getScore();
        if (score.value <= 500) {
            return { eligible: false, reason: 'Credit score too low' };
        }
        const limit = await this.getLimit();
        const maxAmountValue = Number(limit.available.split(/\s+/)[0]);
        if (amountValue > maxAmountValue) {
            return { eligible: false, reason: 'Amount exceeds max eligible' };
        }
        return { eligible: true, maxAmount: limit.available, reason: null };
    }
    async getLimit() {
        if (hasGuarantorContract(this.cfg)) {
            const read = getGuarantorReadContract(this.cfg);
            const agent = resolveAgentAddress(this.cfg);
            if (!read || !agent) {
                throw new Error('On-chain credit mode requires rpcUrl, guarantor address, and resolvable agent address');
            }
            const freeLiquidityWei = (await read.freeLiquidityWei());
            const outstandingWei = (await read.outstandingByAgent(agent));
            // Conservative Phase-1 cap: up to 55% of free liquidity as current limit.
            const currentWei = (freeLiquidityWei * 55n) / 100n;
            const availableWei = currentWei > outstandingWei ? (currentWei - outstandingWei) : 0n;
            const nextTierWei = (currentWei * 125n) / 100n;
            return {
                current: formatWeiAmount(currentWei),
                used: formatWeiAmount(outstandingWei),
                available: formatWeiAmount(availableWei),
                nextTier: formatWeiAmount(nextTierWei)
            };
        }
        // Scaffold: align with available credit scaffold
        const available = await this.getAvailableCredit('OKB');
        const used = 0.1 * (available.value / 10);
        const current = available.value * 0.55;
        const availableValue = Math.max(0, current - used);
        const nextTier = available.value * 0.75;
        return {
            current: `${current.toFixed(2)} OKB`,
            used: `${used.toFixed(2)} OKB`,
            available: `${availableValue.toFixed(2)} OKB`,
            nextTier: `${nextTier.toFixed(2)} OKB`
        };
    }
    // Kept for future compatibility with older scaffold.
    async getOutstanding() {
        if (hasGuarantorContract(this.cfg)) {
            const read = getGuarantorReadContract(this.cfg);
            const agent = resolveAgentAddress(this.cfg);
            if (!read || !agent) {
                throw new Error('On-chain credit mode requires rpcUrl, guarantor address, and resolvable agent address');
            }
            const outstandingWei = (await read.outstandingByAgent(agent));
            return {
                agentId: this.cfg.agentId,
                outstanding: formatWeiAmount(outstandingWei),
                currency: 'OKB',
                updatedAt: nowIso()
            };
        }
        return {
            agentId: this.cfg.agentId,
            outstanding: '0',
            currency: 'OKB',
            updatedAt: nowIso()
        };
    }
}
//# sourceMappingURL=CreditClient.js.map