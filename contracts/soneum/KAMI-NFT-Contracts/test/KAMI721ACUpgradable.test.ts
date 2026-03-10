import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Contract } from 'ethers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ProxyAdmin } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

/** EIP-712 domain for KAMI721AC (same as non-upgradeable) */
const EIP712_DOMAIN_NAME = 'KAMI721AC';
const EIP712_VERSION = '1';

async function getDomain(contractAddress: string) {
	const network = await ethers.provider.getNetwork();
	return {
		name: EIP712_DOMAIN_NAME,
		version: EIP712_VERSION,
		chainId: Number(network.chainId),
		verifyingContract: contractAddress,
	};
}

describe('KAMI721ACUpgradable', function () {
	let contract: Contract;
	let proxyAdmin: ProxyAdmin;
	let paymentToken: Contract;
	let owner: SignerWithAddress;
	let platform: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let receiver1: SignerWithAddress;
	let receiver2: SignerWithAddress;
	let relayer: SignerWithAddress;

	const TOKEN_NAME = 'KAMI721AC';
	const TOKEN_SYMBOL = 'KAMI';
	const BASE_URI = 'https://api.kami.com/token/';
	const CLAIM_PRICE = ethers.parseUnits('100', 6);
	const PLATFORM_COMMISSION = 2000; // 20%
	const ROYALTY_PERCENTAGE = 1000; // 10%
	const RENTAL_DURATION = 86400n;
	const RENTAL_PRICE = ethers.parseUnits('100', 6);

	beforeEach(async function () {
		[owner, platform, user1, user2, receiver1, receiver2, relayer] = await ethers.getSigners();

		const MockERC20Factory = await ethers.getContractFactory('contracts/test/MockERC20.sol:MockERC20');
		paymentToken = await MockERC20Factory.deploy('Mock Payment Token', 'MPT', 6);

		const KAMI721ACUpgradableFactory = await ethers.getContractFactory('KAMI721ACUpgradable');
		const proxy = await upgrades.deployProxy(
			KAMI721ACUpgradableFactory,
			[
				await paymentToken.getAddress(),
				TOKEN_NAME,
				TOKEN_SYMBOL,
				BASE_URI,
				platform.address,
				PLATFORM_COMMISSION,
				owner.address,
				0, // totalSupply: 0 = unlimited
				CLAIM_PRICE, // mintPrice
			],
			{ initializer: 'initialize', kind: 'transparent' }
		);
		contract = proxy as Contract;

		const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(await contract.getAddress());
		proxyAdmin = (await ethers.getContractAt('ProxyAdmin', proxyAdminAddress)) as unknown as ProxyAdmin;

		await paymentToken.mint(owner.address, ethers.parseUnits('100000', 6));
		await paymentToken.mint(user1.address, ethers.parseUnits('10000', 6));
		await paymentToken.mint(user2.address, ethers.parseUnits('10000', 6));
		await paymentToken.mint(relayer.address, ethers.parseUnits('10000', 6));

		await paymentToken.connect(user1).approve(await contract.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(user2).approve(await contract.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(relayer).approve(await contract.getAddress(), ethers.MaxUint256);
	});

	describe('Initialization', function () {
		it('should initialize with correct values', async function () {
			expect(await contract.name()).to.equal(TOKEN_NAME);
			expect(await contract.symbol()).to.equal(TOKEN_SYMBOL);
			expect(await contract.paymentToken()).to.equal(await paymentToken.getAddress());
			expect(await contract.platformAddress()).to.equal(platform.address);
			expect(await contract.platformCommissionPercentage()).to.equal(PLATFORM_COMMISSION);
			expect(await contract.mintPrice()).to.equal(CLAIM_PRICE);
			expect(await contract.royaltyPercentage()).to.equal(1000); // default 10%
		});

		it('should assign OWNER_ROLE and PLATFORM_ROLE to admin and platform', async function () {
			const OWNER_ROLE = await contract.OWNER_ROLE();
			const PLATFORM_ROLE = await contract.PLATFORM_ROLE();
			expect(await contract.hasRole(OWNER_ROLE, owner.address)).to.be.true;
			expect(await contract.hasRole(PLATFORM_ROLE, platform.address)).to.be.true;
		});

		it('should not allow re-initialization', async function () {
			await expect(
				contract.initialize(
					await paymentToken.getAddress(),
					TOKEN_NAME,
					TOKEN_SYMBOL,
					BASE_URI,
					platform.address,
					PLATFORM_COMMISSION,
					owner.address,
					0,
					CLAIM_PRICE
				)
			).to.be.reverted;
		});
	});

	describe('Claim', function () {
		it('should allow claim and set hasClaimed and ownerOf', async function () {
			await contract.connect(user1).claim('https://example.com/token/1', []);
			expect(await contract.ownerOf(1)).to.equal(user1.address);
			expect(await contract.hasClaimed(user1.address)).to.be.true;
			expect(await contract.totalSupply()).to.equal(1);
		});
	});

	describe('setSalePrice / setMintPrice', function () {
		it('should allow token owner to set sale price', async function () {
			await contract.connect(user1).claim('https://example.com/token/1', []);
			const newPrice = ethers.parseUnits('200', 6);
			await contract.connect(user1).setSalePrice(1, newPrice);
			expect(await contract.salePrices(1)).to.equal(newPrice);
			expect(await contract.tokenPrices(1)).to.equal(newPrice);
		});

		it('should allow owner to set mint price', async function () {
			const newMintPrice = ethers.parseUnits('50', 6);
			await contract.connect(owner).setMintPrice(newMintPrice);
			expect(await contract.mintPrice()).to.equal(newMintPrice);
		});
	});

	describe('Royalty and platform', function () {
		it('should allow owner to set royalty percentage and mint royalties', async function () {
			await contract.connect(owner).setRoyaltyPercentage(ROYALTY_PERCENTAGE);
			expect(await contract.royaltyPercentage()).to.equal(ROYALTY_PERCENTAGE);

			const mintRoyalties = [
				{ receiver: receiver1.address, feeNumerator: 5000 },
				{ receiver: receiver2.address, feeNumerator: 5000 },
			];
			await contract.setMintRoyalties(mintRoyalties);
			// Claim and verify distribution (platform + royalty receivers)
			await contract.connect(user1).claim('https://example.com/token/1', []);
			expect(await contract.ownerOf(1)).to.equal(user1.address);
		});
	});

	describe('Rental', function () {
		beforeEach(async function () {
			await contract.connect(owner).setRoyaltyPercentage(ROYALTY_PERCENTAGE);
			await contract.connect(user1).claim('https://example.com/token/1', []);
		});

		it('should rent token and report isRented, then end rental', async function () {
			await contract.connect(user2).rentToken(1, RENTAL_DURATION, RENTAL_PRICE, user2.address);
			expect(await contract.isRented(1)).to.be.true;

			await contract.connect(user2).endRental(1);
			expect(await contract.isRented(1)).to.be.false;
		});
	});

	describe('Signature flows', function () {
		beforeEach(async function () {
			await contract.connect(user1).claim('https://example.com/1', []);
		});

		it('should succeed setSalePriceWithSignature when relayer submits valid owner signature', async function () {
			const tokenId = 1n;
			const newSalePrice = ethers.parseUnits('200', 6);
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await contract.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{
					SetSalePrice: [
						{ name: 'tokenId', type: 'uint256' },
						{ name: 'newSalePrice', type: 'uint256' },
						{ name: 'deadline', type: 'uint256' },
					],
				},
				{ tokenId, newSalePrice, deadline }
			);
			await contract.connect(relayer).setSalePriceWithSignature(tokenId, newSalePrice, deadline, signature);
			expect(await contract.salePrices(tokenId)).to.equal(newSalePrice);
		});

		it('should revert SignatureExpired when deadline has passed', async function () {
			const tokenId = 1n;
			const newSalePrice = ethers.parseUnits('200', 6);
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp - 1;
			const domain = await getDomain(await contract.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{
					SetSalePrice: [
						{ name: 'tokenId', type: 'uint256' },
						{ name: 'newSalePrice', type: 'uint256' },
						{ name: 'deadline', type: 'uint256' },
					],
				},
				{ tokenId, newSalePrice, deadline }
			);
			await expect(
				contract.connect(relayer).setSalePriceWithSignature(tokenId, newSalePrice, deadline, signature)
			).to.be.revertedWithCustomError(contract, 'SignatureExpired');
		});
	});
});
