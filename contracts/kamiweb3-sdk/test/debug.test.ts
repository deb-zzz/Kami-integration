import { ethers } from 'hardhat';
import { Signer } from 'ethers';
import { KAMI721CFactory, KAMI721CWrapper } from '../src';

describe('Debug Test', () => {
	let deployer: Signer;
	let deployerAddress: string;

	beforeAll(async () => {
		[deployer] = await ethers.getSigners();
		deployerAddress = await deployer.getAddress();
		console.log('Debug: Deployer address:', deployerAddress);
		console.log('Debug: Deployer type:', typeof deployer);
		console.log('Debug: Deployer constructor:', deployer.constructor.name);
	});

	it('should debug signer compatibility', async () => {
		// Test 1: Check if signer has getAddress method
		try {
			const address = await deployer.getAddress();
			console.log('Debug: Signer has getAddress method, address:', address);
		} catch (e) {
			console.error('Debug: Signer getAddress failed:', e);
		}

		// Test 2: Try to deploy a contract
		try {
			const deployArgs = {
				paymentToken_: '0x' + '1'.repeat(40),
				name_: 'Debug Test',
				symbol_: 'DEBUG',
				baseTokenURI_: 'ipfs://debug/',
				initialMintPrice_: ethers.utils.parseUnits('1', 6),
				platformAddress_: '0x' + '2'.repeat(40),
				platformCommissionPercentage_: 500,
			};

			const wrapper = await KAMI721CFactory.deploy(deployArgs, deployer);
			console.log('Debug: Wrapper created successfully');
			console.log('Debug: Wrapper address:', wrapper.address);
			console.log('Debug: Wrapper contract signer:', wrapper.contract.signer ? 'exists' : 'missing');

			if (wrapper.contract.signer) {
				console.log('Debug: Contract signer address:', await wrapper.contract.signer.getAddress());
			}
		} catch (e) {
			console.error('Debug: Deployment failed:', e);
		}
	});
});
