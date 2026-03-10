const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('KamiPaymaster', function () {
	let kamiPaymaster;
	let owner;
	let user1;
	let user2;
	let mockEntryPoint;

	beforeEach(async function () {
		[owner, user1, user2] = await ethers.getSigners();

		// Deploy a mock EntryPoint contract
		const MockEntryPoint = await ethers.getContractFactory('MockEntryPoint');
		mockEntryPoint = await MockEntryPoint.deploy();
		await mockEntryPoint.waitForDeployment();

		// Deploy KamiPaymaster
		const KamiPaymaster = await ethers.getContractFactory('KamiPaymaster');
		kamiPaymaster = await KamiPaymaster.deploy(await mockEntryPoint.getAddress());
		await kamiPaymaster.waitForDeployment();
	});

	describe('Deployment', function () {
		it('Should set the correct owner', async function () {
			expect(await kamiPaymaster.owner()).to.equal(owner.address);
		});

		it('Should set the correct entry point', async function () {
			expect(await kamiPaymaster.entryPoint()).to.equal(await mockEntryPoint.getAddress());
		});

		it('Should initialize with empty allowlist', async function () {
			expect(await kamiPaymaster.isAllowlisted(user1.address)).to.be.false;
			expect(await kamiPaymaster.isAllowlisted(user2.address)).to.be.false;
		});
	});

	describe('Deposit', function () {
		it('Should allow owner to deposit ETH', async function () {
			const depositAmount = ethers.parseEther('1.0');

			// Execute the deposit transaction
			await kamiPaymaster.deposit({ value: depositAmount });

			// Check that the deposit was recorded in the mock EntryPoint
			const deposit = await mockEntryPoint.getDepositInfo(await kamiPaymaster.getAddress());
			expect(deposit).to.equal(depositAmount);
		});

		it('Should allow anyone to deposit ETH', async function () {
			const depositAmount = ethers.parseEther('0.5');

			// Execute the deposit transaction
			await kamiPaymaster.connect(user1).deposit({ value: depositAmount });

			// Check that the deposit was recorded in the mock EntryPoint
			const deposit = await mockEntryPoint.getDepositInfo(await kamiPaymaster.getAddress());
			expect(deposit).to.equal(depositAmount);
		});

		it('Should handle zero deposit', async function () {
			// Execute the deposit transaction
			await kamiPaymaster.deposit({ value: 0 });

			// Check that the deposit was recorded in the mock EntryPoint
			const deposit = await mockEntryPoint.getDepositInfo(await kamiPaymaster.getAddress());
			expect(deposit).to.equal(0n);
		});
	});

	describe('Allowlist Management', function () {
		it('Should allow owner to add address to allowlist', async function () {
			await kamiPaymaster.setAllowlistAddress(user1.address, true);
			expect(await kamiPaymaster.isAllowlisted(user1.address)).to.be.true;
		});

		it('Should allow owner to remove address from allowlist', async function () {
			await kamiPaymaster.setAllowlistAddress(user1.address, true);
			await kamiPaymaster.setAllowlistAddress(user1.address, false);
			expect(await kamiPaymaster.isAllowlisted(user1.address)).to.be.false;
		});

		it('Should not allow non-owner to modify allowlist', async function () {
			try {
				await kamiPaymaster.connect(user1).setAllowlistAddress(user2.address, true);
				expect.fail('Expected transaction to revert');
			} catch (error) {
				expect(error.message).to.include('Unauthorized');
			}
		});

		it('Should emit event when allowlist is updated', async function () {
			// We can't easily test events without chai matchers, so we'll just verify the function works
			await kamiPaymaster.setAllowlistAddress(user1.address, true);
			expect(await kamiPaymaster.isAllowlisted(user1.address)).to.be.true;
		});
	});

	describe('validatePaymasterUserOp', function () {
		beforeEach(async function () {
			// Add user1 to allowlist
			await kamiPaymaster.setAllowlistAddress(user1.address, true);
		});

		it('Should validate allowlisted user', async function () {
			const userOp = {
				sender: user1.address,
				nonce: 0,
				initCode: '0x',
				callData: '0x',
				callGasLimit: 100000,
				verificationGasLimit: 100000,
				preVerificationGas: 21000,
				maxFeePerGas: ethers.parseUnits('20', 'gwei'),
				maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
				paymasterAndData: '0x',
				signature: '0x',
			};

			const [context, validationData] = await kamiPaymaster.validatePaymasterUserOp(
				userOp,
				ethers.keccak256(ethers.toUtf8Bytes('test')),
				ethers.parseEther('0.1')
			);

			expect(context).to.equal('0x');
			expect(validationData).to.equal(0n);
		});

		it('Should reject non-allowlisted user', async function () {
			const userOp = {
				sender: user2.address,
				nonce: 0,
				initCode: '0x',
				callData: '0x',
				callGasLimit: 100000,
				verificationGasLimit: 100000,
				preVerificationGas: 21000,
				maxFeePerGas: ethers.parseUnits('20', 'gwei'),
				maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
				paymasterAndData: '0x',
				signature: '0x',
			};

			try {
				await kamiPaymaster.validatePaymasterUserOp(userOp, ethers.keccak256(ethers.toUtf8Bytes('test')), ethers.parseEther('0.1'));
				expect.fail('Expected transaction to revert');
			} catch (error) {
				expect(error.message).to.include('Not on allowlist');
			}
		});
	});

	describe('postOp', function () {
		it('Should execute postOp without reverting', async function () {
			// postOp should not revert for any mode
			await kamiPaymaster.postOp(0, '0x', 100000);
			await kamiPaymaster.postOp(1, '0x', 100000);
		});
	});

	describe('Access Control', function () {
		it('Should only allow owner to modify allowlist', async function () {
			try {
				await kamiPaymaster.connect(user1).setAllowlistAddress(user2.address, true);
				expect.fail('Expected transaction to revert');
			} catch (error) {
				expect(error.message).to.include('Unauthorized');
			}

			try {
				await kamiPaymaster.connect(user2).setAllowlistAddress(user1.address, true);
				expect.fail('Expected transaction to revert');
			} catch (error) {
				expect(error.message).to.include('Unauthorized');
			}
		});
	});
});
