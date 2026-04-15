const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log('Deploying with account:', deployer.address);

  const pricePerDayWei = hre.ethers.parseEther('0.001');
  const feeBps = 50;
  const maxGuaranteeTtlSeconds = 25 * 60;

  const SubscriptionManager = await hre.ethers.getContractFactory('SubscriptionManager');
  const subscription = await SubscriptionManager.deploy(pricePerDayWei);
  await subscription.waitForDeployment();

  const subscriptionAddress = await subscription.getAddress();
  console.log('SubscriptionManager:', subscriptionAddress);

  const PaymentGuarantor = await hre.ethers.getContractFactory('PaymentGuarantor');
  const guarantor = await PaymentGuarantor.deploy(
    subscriptionAddress,
    feeBps,
    maxGuaranteeTtlSeconds,
    deployer.address
  );
  await guarantor.waitForDeployment();

  const guarantorAddress = await guarantor.getAddress();
  console.log('PaymentGuarantor:', guarantorAddress);

  const network = await hre.ethers.provider.getNetwork();

  const out = {
    network: hre.network.name,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    contracts: {
      subscriptionManager: subscriptionAddress,
      paymentGuarantor: guarantorAddress
    }
  };

  console.log('Deployment summary:', JSON.stringify(out, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
