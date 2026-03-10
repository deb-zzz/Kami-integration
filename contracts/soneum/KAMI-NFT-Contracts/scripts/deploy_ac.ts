import { ethers } from 'hardhat';

async function main() {
	console.log('🚀 Starting KAMI721AC deployment...');

	const [deployer] = await ethers.getSigners();
	console.log('📝 Deployer:', deployer.address);

	// Deploy MockERC20 payment token
	console.log('💰 Deploying MockERC20 payment token...');
	const MockERC20 = await ethers.getContractFactory('MockERC20');
	const paymentToken = await MockERC20.deploy('Mock USDC', 'USDC', 6);
	await paymentToken.waitForDeployment();
	const paymentTokenAddress = await paymentToken.getAddress();
	console.log('✅ Payment token deployed:', paymentTokenAddress);

	// Deploy KAMI721AC
	console.log('🎨 Deploying KAMI721AC contract...');
	const KAMI721AC = await ethers.getContractFactory('KAMI721AC');
	const kami721ac = await KAMI721AC.deploy(
		paymentTokenAddress,
		'KAMI NFT Collection AC',
		'KAMI-AC',
		'https://api.kami.com/token/',
		ethers.parseUnits('21.50', 6), // 100 USDC
		deployer.address, // Platform address
		500 // 5% platform commission
	);
	await kami721ac.waitForDeployment();
	const contractAddress = await kami721ac.getAddress();
	console.log('✅ KAMI721AC deployed:', contractAddress);

	// Display contract details
	console.log('\n📋 Contract Details:');
	console.log('   Name:', await kami721ac.name());
	console.log('   Symbol:', await kami721ac.symbol());
	console.log('   Claim Price:', ethers.formatUnits(await kami721ac.mintPrice(), 6), 'tokens');
	console.log('   Platform Address:', await kami721ac.platformAddress());
	console.log('   Platform Commission:', (await kami721ac.platformCommissionPercentage()).toString(), 'basis points');

	console.log('\n🎉 Deployment completed successfully!');
	console.log('Contract Address:', contractAddress);
	console.log('Payment Token:', paymentTokenAddress);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('❌ Deployment failed:', error);
		process.exit(1);
	});
