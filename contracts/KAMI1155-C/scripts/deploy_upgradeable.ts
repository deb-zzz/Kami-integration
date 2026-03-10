import { ethers, upgrades } from 'hardhat';

async function main() {
	const [deployer] = await ethers.getSigners();
	console.log('Deploying upgradeable contracts with the account:', deployer.address);

	// Deploy mock payment token for testing
	const MockERC20 = await ethers.getContractFactory('MockERC20');
	const paymentToken = await MockERC20.deploy('Mock Payment Token', 'MPT', 6);
	await paymentToken.waitForDeployment();
	console.log('Payment token deployed to:', await paymentToken.getAddress());

	// Deploy KAMI1155CUpgradeable
	const KAMI1155CUpgradeable = await ethers.getContractFactory('KAMI1155CUpgradeable');
	const kami1155c = await upgrades.deployProxy(
		KAMI1155CUpgradeable,
		[
			await paymentToken.getAddress(),
			'KAMI1155C',
			'KAMI',
			'https://api.kami.com/token/',
			ethers.parseUnits('100', 6), // 100 tokens with 6 decimals
			deployer.address, // Platform address
			500, // 5% platform commission
		],
		{
			initializer: 'initialize',
			kind: 'transparent',
		}
	);

	await kami1155c.waitForDeployment();
	console.log('KAMI1155CUpgradeable deployed to:', await kami1155c.getAddress());
	console.log('Payment token address:', await paymentToken.getAddress());
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
