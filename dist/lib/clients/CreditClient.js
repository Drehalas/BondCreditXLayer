import { clampInt, nowIso, randomId } from '../util.js';
import { formatWeiAmount, getGuarantorReadContract, getSubscriptionReadContract, hasGuarantorContract, hasSubscriptionContract, resolveAgentAddress, } from '../onchain.js';
import { formatEther } from 'ethers';
export class CreditClient {
    cfg;
    static stateByAgent = new Map();
    constructor(cfg) {
        this.cfg = cfg;
    }
    getState() {
        const existing = CreditClient.stateByAgent.get(this.cfg.agentId);
        if (existing)
            return existing;
        const created = {
            successfulPayments: 0,
            failedPayments: 0,
            totalRepays: 0,
            totalRepaymentMinutes: 0,
            uniquePurposes: new Set(),
            openCredits: new Map(),
            crossAgentRefs: 0
        };
        CreditClient.stateByAgent.set(this.cfg.agentId, created);
        return created;
    }
    static clampScore(value) {
        return Math.max(0, Math.min(1000, Math.round(value)));
    }
    scoreTier(score) {
        if (score >= 800)
            return 'Elite';
        if (score >= 700)
            return 'Prime';
        if (score >= 600)
            return 'Growth';
        if (score >= 500)
            return 'Building';
        return 'Starter';
    }
    repaymentSpeedFactor(avgRepaymentMinutes) {
        if (avgRepaymentMinutes <= 5)
            return 980;
        if (avgRepaymentMinutes <= 30)
            return 900;
        if (avgRepaymentMinutes <= 120)
            return 760;
        if (avgRepaymentMinutes <= 1_440)
            return 620;
        return 420;
    }
    async getSubscriptionSignals() {
        if (!hasSubscriptionContract(this.cfg)) {
            return { active: false, payments: 0, daysLeft: 0 };
        }
        const read = getSubscriptionReadContract(this.cfg);
        const agent = resolveAgentAddress(this.cfg);
        if (!read || !agent) {
            return { active: false, payments: 0, daysLeft: 0 };
        }
        const [active, , daysLeft, paymentCount] = await read.checkStatus(agent);
        return {
            active: Boolean(active),
            payments: Number(paymentCount),
            daysLeft: Number(daysLeft)
        };
    }
    async getScoreFactors() {
        const state = this.getState();
        const sub = await this.getSubscriptionSignals();
        const totalPaymentEvents = state.successfulPayments + state.failedPayments;
        const reliability = totalPaymentEvents > 0 ? (state.successfulPayments / totalPaymentEvents) : 0.8;
        const purposesCount = state.uniquePurposes.size;
        const observedPayments = Math.max(sub.payments, state.successfulPayments);
        // README weights need normalized factors in the 0..1000 range.
        const subscriptionFactor = CreditClient.clampScore((sub.active ? 500 : 100) +
            Math.min(300, observedPayments * 30) +
            Math.min(200, sub.daysLeft * 10));
        const paymentsFactor = CreditClient.clampScore((sub.active ? 250 : 100) + (reliability * 750));
        const activityCount = observedPayments + state.totalRepays + purposesCount;
        const volumeFactor = CreditClient.clampScore(150 + Math.min(850, activityCount * 24));
        const diversityFactor = CreditClient.clampScore(100 + Math.min(900, purposesCount * 120));
        const avgRepaymentMinutes = state.totalRepays > 0
            ? (state.totalRepaymentMinutes / state.totalRepays)
            : 240;
        const speedFactor = CreditClient.clampScore(this.repaymentSpeedFactor(avgRepaymentMinutes));
        const referencesFactor = CreditClient.clampScore(350 + (state.crossAgentRefs * 120) + Math.min(250, purposesCount * 50));
        return {
            subscription: subscriptionFactor,
            payments: paymentsFactor,
            volume: volumeFactor,
            diversity: diversityFactor,
            speed: speedFactor,
            references: referencesFactor,
            activityCount
        };
    }
    async getScoredLimitSnapshot(currency) {
        const score = await this.getScore();
        const factors = await this.getScoreFactors();
        const activityMultiplier = Math.min(1 + (factors.activityCount / 500), 3);
        // README progressive formula: creditLine = (baseScore * activityMultiplier) / 1000
        const current = (score.value * activityMultiplier) / 1000;
        const nextTierScore = Math.min(1000, score.value + 50);
        const nextTier = (nextTierScore * activityMultiplier) / 1000;
        const state = this.getState();
        let used = 0;
        for (const credit of state.openCredits.values())
            used += credit.amount;
        const available = Math.max(0, current - used);
        const cur = currency ?? 'XLAYER';
        return {
            current: Number(current.toFixed(4)),
            used: Number(used.toFixed(4)),
            available: Number(available.toFixed(4)),
            nextTier: Number(nextTier.toFixed(4)),
            currency: cur
        };
    }
    async getScore() {
        const factors = await this.getScoreFactors();
        const value = CreditClient.clampScore((factors.subscription * 0.25) +
            (factors.payments * 0.3) +
            (factors.volume * 0.15) +
            (factors.diversity * 0.1) +
            (factors.speed * 0.15) +
            (factors.references * 0.05));
        return {
            value,
            tier: this.scoreTier(value),
            updatedAt: nowIso(),
            factors: {
                subscription: factors.subscription,
                payments: factors.payments,
                volume: factors.volume,
                diversity: factors.diversity,
                speed: factors.speed,
                references: factors.references,
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
            const freeLiquidityWei = await read.freeLiquidityWei();
            const outstandingWei = await read.outstandingByAgent(agent);
            // Phase-1 heuristic: agent can use free liquidity net of current outstanding debt.
            const availableWei = freeLiquidityWei > outstandingWei ? (freeLiquidityWei - outstandingWei) : 0n;
            const cur = currency ?? 'OKB';
            return { value: Number(formatEther(availableWei)), currency: cur, updatedAt: nowIso() };
        }
        const snapshot = await this.getScoredLimitSnapshot(currency);
        return { value: snapshot.available, currency: snapshot.currency, updatedAt: nowIso() };
    }
    async request(inputOrAmount, purpose) {
        const input = typeof inputOrAmount === 'string'
            ? { amount: inputOrAmount, purpose }
            : inputOrAmount;
        // Scaffold approval based on available credit (very rough).
        const { value: availableValue, currency } = await this.getAvailableCredit();
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
        const feeBps = clampInt(5, 0, 1000); // 0.05%
        const feeValue = (amountValue * (feeBps / 10_000));
        const fee = `${feeValue.toFixed(6)} ${currency}`;
        const deadline = new Date(Date.now() + 60 * 60_000).toISOString();
        const state = this.getState();
        if (input.purpose) {
            state.uniquePurposes.add(input.purpose.trim().toLowerCase());
        }
        state.openCredits.set(creditId, {
            amount: amountValue,
            createdAtMs: Date.now(),
            purpose: input.purpose
        });
        return {
            approved: true,
            creditId,
            amount: input.amount,
            fee,
            deadline
        };
    }
    async repay(arg1, arg2) {
        const state = this.getState();
        const input = typeof arg1 === 'string' ? { creditId: arg1, amount: arg2 ?? '' } : arg1;
        if (!input.creditId) {
            state.failedPayments += 1;
            return { success: false, newScore: 0 };
        }
        if (!input.amount) {
            state.failedPayments += 1;
            return { success: false, newScore: 0 };
        }
        const parsedAmount = Number(input.amount.trim().split(/\s+/)[0]);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            state.failedPayments += 1;
            return { success: false, newScore: 0 };
        }
        state.successfulPayments += 1;
        const existing = state.openCredits.get(input.creditId);
        if (existing) {
            const elapsedMinutes = (Date.now() - existing.createdAtMs) / 60_000;
            state.totalRepays += 1;
            state.totalRepaymentMinutes += Math.max(1, elapsedMinutes);
            state.openCredits.delete(input.creditId);
        }
        const updatedScore = await this.getScore();
        return {
            success: true,
            newScore: updatedScore.value,
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
            const freeLiquidityWei = await read.freeLiquidityWei();
            const outstandingWei = await read.outstandingByAgent(agent);
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
        const snapshot = await this.getScoredLimitSnapshot('XLAYER');
        return {
            current: `${snapshot.current.toFixed(4)} ${snapshot.currency}`,
            used: `${snapshot.used.toFixed(4)} ${snapshot.currency}`,
            available: `${snapshot.available.toFixed(4)} ${snapshot.currency}`,
            nextTier: `${snapshot.nextTier.toFixed(4)} ${snapshot.currency}`
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
            const outstandingWei = await read.outstandingByAgent(agent);
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