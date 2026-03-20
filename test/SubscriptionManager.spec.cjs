const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('SubscriptionManager', function () {
  it('subscribes and reports active status', async function () {
    const [agent] = await ethers.getSigners();
    const price = ethers.parseEther('0.001');

    const Factory = await ethers.getContractFactory('SubscriptionManager');
    const sub = await Factory.deploy(price);
    await sub.waitForDeployment();

    await sub.connect(agent).subscribe(30, { value: price * 30n });

    const status = await sub.checkStatus(agent.address);
    expect(status.active).to.equal(true);
    expect(status.daysLeft > 0n).to.equal(true);
    expect(status.paymentCount).to.equal(1n);
  });

  it('reverts on underpayment', async function () {
    const [agent] = await ethers.getSigners();
    const price = ethers.parseEther('0.001');

    const Factory = await ethers.getContractFactory('SubscriptionManager');
    const sub = await Factory.deploy(price);
    await sub.waitForDeployment();

    await expect(sub.connect(agent).subscribe(10, { value: price * 9n })).to.be.reverted;
  });
});
