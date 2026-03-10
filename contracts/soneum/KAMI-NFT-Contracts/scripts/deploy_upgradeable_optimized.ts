import { ethers, upgrades } from 'hardhat';

async function main() {
	console.log('🚀 Starting KAMI721CUpgradeable deployment...');

	const [deployer] = await ethers.getSigners();
	console.log('📝 Deployer:', deployer.address);

	// Deploy MockERC20 payment token
	console.log('💰 Deploying MockERC20 payment token...');
	const MockERC20 = await ethers.getContractFactory('MockERC20');
	const paymentToken = await MockERC20.deploy('Mock USDC', 'USDC', 6);
	await paymentToken.waitForDeployment();
	const paymentTokenAddress = await paymentToken.getAddress();
	console.log('✅ Payment token deployed:', paymentTokenAddress);

	// Deploy KAMI721CUpgradeable
	console.log('🎨 Deploying KAMI721CUpgradeable contract...');
	const KAMI721CUpgradeable = await ethers.getContractFactory('KAMI721CUpgradeable');

	const kami721cUpgradeable = await upgrades.deployProxy(
		KAMI721CUpgradeable,
		[
			paymentTokenAddress,
			'KAMI NFT Collection Upgradeable',
			'KAMI-UP',
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

	await kami721cUpgradeable.waitForDeployment();
	const contractAddress = await kami721cUpgradeable.getAddress();
	console.log('✅ KAMI721CUpgradeable deployed:', contractAddress);

	// Display contract details
	console.log('\n📋 Contract Details:');
	console.log('   Name:', await kami721cUpgradeable.name());
	console.log('   Symbol:', await kami721cUpgradeable.symbol());
	console.log('   Mint Price:', ethers.formatUnits(await kami721cUpgradeable.mintPrice(), 6), 'tokens');
	console.log('   Platform Address:', await kami721cUpgradeable.platformAddress());
	console.log('   Platform Commission:', (await kami721cUpgradeable.platformCommission()).toString(), 'basis points');

	// Set up royalty configuration
	console.log('\n👑 Setting up royalty configuration...');

	// Set global royalty percentage (5%)
	const setRoyaltyTx = await kami721cUpgradeable.setRoyaltyPercentage(500);
	await setRoyaltyTx.wait();
	console.log('✅ Royalty percentage set to 5%');

	// Set up mint royalties
	const mintRoyalties = [
		{
			receiver: deployer.address,
			feeNumerator: 250, // 2.5%
		},
		{
			receiver: contractAddress, // Platform
			feeNumerator: 250, // 2.5%
		},
	];

	const setMintRoyaltiesTx = await kami721cUpgradeable.setMintRoyalties(0, mintRoyalties);
	await setMintRoyaltiesTx.wait();
	console.log('✅ Mint royalties configured');

	// Set up transfer royalties
	const setTransferRoyaltiesTx = await kami721cUpgradeable.setTransferRoyalties(0, mintRoyalties);
	await setTransferRoyaltiesTx.wait();
	console.log('✅ Transfer royalties configured');

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
