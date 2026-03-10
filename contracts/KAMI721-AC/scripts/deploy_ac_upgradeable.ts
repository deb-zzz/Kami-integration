import { ethers, upgrades } from 'hardhat';

async function main() {
	console.log('🚀 Starting KAMI721ACUpgradable deployment...');

	const [deployer] = await ethers.getSigners();
	console.log('📝 Deployer:', deployer.address);

	// Deploy MockERC20 payment token
	console.log('💰 Deploying MockERC20 payment token...');
	const MockERC20 = await ethers.getContractFactory('MockERC20');
	const paymentToken = await MockERC20.deploy('Mock USDC', 'USDC', 6);
	await paymentToken.waitForDeployment();
	const paymentTokenAddress = await paymentToken.getAddress();
	console.log('✅ Payment token deployed:', paymentTokenAddress);

	// Deploy KAMI721ACUpgradable
	console.log('🎨 Deploying KAMI721ACUpgradable contract...');
	const KAMI721ACUpgradable = await ethers.getContractFactory('KAMI721ACUpgradable');

	const kami721acUpgradable = await upgrades.deployProxy(
		KAMI721ACUpgradable,
		[
			paymentTokenAddress,
			'KAMI NFT Collection AC Upgradeable',
			'KAMI-AC-UP',
			'https://api.kami.com/token/',
			ethers.parseUnits('100', 6), // 100 USDC
			deployer.address, // Platform address
			500, // 5% platform commission
		],
		{
			initializer: 'initialize',
			kind: 'uups',
		}
	);

	await kami721acUpgradable.waitForDeployment();
	const contractAddress = await kami721acUpgradable.getAddress();
	console.log('✅ KAMI721ACUpgradable deployed:', contractAddress);

	// Display contract details
	console.log('\n📋 Contract Details:');
	console.log('   Name:', await kami721acUpgradable.name());
	console.log('   Symbol:', await kami721acUpgradable.symbol());
	console.log('   Claim Price:', ethers.formatUnits(await kami721acUpgradable.mintPrice(), 6), 'tokens');
	console.log('   Platform Address:', await kami721acUpgradable.platformAddress());
	console.log('   Platform Commission:', (await kami721acUpgradable.platformCommissionPercentage()).toString(), 'basis points');

	console.log('\n🎉 Deployment completed successfully!');
	console.log('Contract Address:', contractAddress);
	console.log('Payment Token:', paymentTokenAddress);
	console.log('Proxy Admin:', await upgrades.erc1967.getAdminAddress(contractAddress));
	console.log('Implementation:', await upgrades.erc1967.getImplementationAddress(contractAddress));
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('❌ Deployment failed:', error);
		process.exit(1);
	});
