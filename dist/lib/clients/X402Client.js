import { CreditScoreTooLowError, GuaranteeNotFoundError, InsufficientCreditError, SubscriptionInactiveError } from '../errors.js';
import { parseAmount, randomHex } from '../util.js';
import { getGuarantorReadContract, getGuarantorWriteContract, hasGuarantorContract, minutesRemainingFromUnixSec, parseAmountToWei } from '../onchain.js';
import { isAddress, isHexString } from 'ethers';
export class X402Client {
    cfg;
    deps;
    guaranteeState = new Map();
    constructor(cfg, deps) {
        this.cfg = cfg;
        this.deps = deps;
    }
    async guaranteePayment(input) {
        const subscription = await this.deps.subscription.check();
        if (!subscription.active)
            throw new SubscriptionInactiveError('Active subscription required');
        const score = await this.deps.credit.getScore();
        if (score.value <= 500)
            throw new CreditScoreTooLowError('Credit score must be > 500');
        const { value: amountValue, currency } = parseAmount(input.amount);
        if (!Number.isFinite(amountValue) || amountValue <= 0) {
            throw new InsufficientCreditError('Invalid amount');
        }
        const available = await this.deps.credit.getAvailableCredit(currency);
        if (available.value < amountValue)
            throw new InsufficientCreditError('Available credit is insufficient');
        if (hasGuarantorContract(this.cfg)) {
            const write = getGuarantorWriteContract(this.cfg);
            const read = getGuarantorReadContract(this.cfg);
            if (!write || !read) {
                throw new Error('On-chain x402 mode requires rpcUrl, guarantor address, and privateKey');
            }
            if (!isAddress(input.recipient)) {
                throw new Error('Recipient must be a valid EVM address in on-chain x402 mode');
            }
            const amountWei = parseAmountToWei(input.amount);
            const ttlSeconds = Math.max(60, this.cfg.x402?.defaultGuaranteeTtlSeconds ?? 25 * 60);
            const guaranteeId = await write.createGuarantee.staticCall(input.recipient, amountWei, ttlSeconds);
            const tx = await write.createGuarantee(input.recipient, amountWei, ttlSeconds);
            await tx.wait();
            const status = await read.checkGuarantee(guaranteeId);
            const expiresAt = new Date(Number(status[4]) * 1000).toISOString();
            return {
                guaranteeId,
                proof: tx.hash,
                expiresAt,
                x402Payload: {
                    amount: input.amount,
                    recipient: input.recipient,
                    guarantor: this.cfg.contracts?.paymentGuarantor ?? '0x0'
                }
            };
        }
        const guaranteeId = 'guar_' + randomHex(12).slice(2);
        const expiresAt = new Date(Date.now() + 25 * 60_000).toISOString();
        const proof = randomHex(32);
        const x402Payload = {
            amount: input.amount,
            recipient: input.recipient,
            guarantor: '0xBondCredit...'
        };
        const res = {
            guaranteeId,
            proof,
            expiresAt,
            x402Payload
        };
        const status = {
            active: true,
            used: false,
            expiresIn: '25 minutes'
        };
        this.guaranteeState.set(guaranteeId, { req: input, res, status });
        return res;
    }
    async checkGuarantee(guaranteeId) {
        if (hasGuarantorContract(this.cfg) && isHexString(guaranteeId, 32)) {
            const read = getGuarantorReadContract(this.cfg);
            if (!read)
                throw new Error('On-chain x402 mode requires rpcUrl and guarantor address');
            const [active, used, cancelled, repaid, expiresAt] = await read.checkGuarantee(guaranteeId);
            return {
                active: Boolean(active),
                used: Boolean(used),
                cancelled: Boolean(cancelled || repaid),
                expiresIn: minutesRemainingFromUnixSec(expiresAt)
            };
        }
        const record = this.guaranteeState.get(guaranteeId);
        if (!record) {
            // For scaffolding, treat unknown as inactive + not used.
            return { active: false, used: false, expiresIn: '0 minutes', cancelled: true };
        }
        // Expiry isn't enforced yet; update expiresIn to something stable.
        return record.status;
    }
    async cancelGuarantee(guaranteeId) {
        if (hasGuarantorContract(this.cfg) && isHexString(guaranteeId, 32)) {
            const write = getGuarantorWriteContract(this.cfg);
            if (!write)
                throw new Error('On-chain x402 mode requires rpcUrl, guarantor address, and privateKey');
            const tx = await write.cancelGuarantee(guaranteeId);
            await tx.wait();
            return { ok: true };
        }
        const record = this.guaranteeState.get(guaranteeId);
        if (!record)
            throw new GuaranteeNotFoundError('Guarantee not found');
        record.status.active = false;
        record.status.cancelled = true;
        this.guaranteeState.set(guaranteeId, record);
        return { ok: true };
    }
}
//# sourceMappingURL=X402Client.js.map