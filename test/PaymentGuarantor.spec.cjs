const { expect } = require('chai');
const { ethers } = require('hardhat');

async function setup() {
  const [admin, agent, recipient] = await ethers.getSigners();

  const SubscriptionFactory = await ethers.getContractFactory('SubscriptionManager');
  const subscription = await SubscriptionFactory.deploy(ethers.parseEther('0.001'));
  await subscription.waitForDeployment();

  await subscription.connect(agent).subscribe(30, { value: ethers.parseEther('0.03') });

  const GuarantorFactory = await ethers.getContractFactory('PaymentGuarantor');
  const guarantor = await GuarantorFactory.deploy(
    await subscription.getAddress(),
    50,
    25 * 60,
    admin.address
  );
  await guarantor.waitForDeployment();

  await guarantor.connect(admin).fundPool({ value: ethers.parseEther('5') });

  return { admin, agent, recipient, guarantor };
}

describe('PaymentGuarantor', function () {
  it('creates and checks a guarantee', async function () {
    const { agent, recipient, guarantor } = await setup();

    const amount = ethers.parseEther('0.1');
    const ttl = 10 * 60;

    const id = await guarantor.connect(agent).createGuarantee.staticCall(recipient.address, amount, ttl);
    await guarantor.connect(agent).createGuarantee(recipient.address, amount, ttl);

    const status = await guarantor.checkGuarantee(id);
    expect(status.active).to.equal(true);
    expect(status.used).to.equal(false);
  });

  it('marks used then repays', async function () {
    const { admin, agent, recipient, guarantor } = await setup();

    const amount = ethers.parseEther('0.1');
    const ttl = 10 * 60;

    const id = await guarantor.connect(agent).createGuarantee.staticCall(recipient.address, amount, ttl);
    await guarantor.connect(agent).createGuarantee(recipient.address, amount, ttl);

    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes('x402-payload'));
    await guarantor.connect(admin).markGuaranteeUsed(id, payloadHash);

    const fee = (amount * 50n) / 10_000n;
    await guarantor.connect(agent).repayGuarantee(id, { value: amount + fee });

    const status = await guarantor.checkGuarantee(id);
    expect(status.repaid).to.equal(true);
  });

  it('rejects guarantee creation without enough free liquidity', async function () {
    const { agent, recipient, guarantor } = await setup();

    const tooLarge = ethers.parseEther('50');
    await expect(guarantor.connect(agent).createGuarantee(recipient.address, tooLarge, 300)).to.be.reverted;
  });
});
