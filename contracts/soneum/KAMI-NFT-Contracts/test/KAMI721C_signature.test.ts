import { expect } from 'chai';
import { ethers } from 'hardhat';
import { KAMI721C } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

const EIP712_DOMAIN_NAME = 'KAMI721C';
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

describe('KAMI721C WithSignature (gasless)', function () {
	let kami721c: KAMI721C;
	let paymentToken: any;
	let owner: SignerWithAddress;
	let platform: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;
	let relayer: SignerWithAddress;

	const TOKEN_NAME = 'KAMI721C';
	const TOKEN_SYMBOL = 'KAMI';
	const BASE_URI = 'https://api.kami.com/token/';
	const PRICE = ethers.parseUnits('100', 6);
	const PLATFORM_COMMISSION = 2000;
	const RENTAL_DURATION = 86400n;
	const RENTAL_PRICE = ethers.parseUnits('100', 6);

	beforeEach(async function () {
		[owner, platform, user1, user2, user3, relayer] = await ethers.getSigners();

		const MockERC20Factory = await ethers.getContractFactory('contracts/test/MockERC20.sol:MockERC20');
		paymentToken = await MockERC20Factory.deploy('Mock Payment Token', 'MPT', 6);

		const KAMI721CFactory = await ethers.getContractFactory('KAMI721C');
		kami721c = await KAMI721CFactory.deploy(
			await paymentToken.getAddress(),
			TOKEN_NAME,
			TOKEN_SYMBOL,
			BASE_URI,
			platform.address,
			PLATFORM_COMMISSION,
			owner.address
		);

		await paymentToken.mint(user1.address, ethers.parseUnits('10000', 6));
		await paymentToken.mint(user2.address, ethers.parseUnits('10000', 6));
		await paymentToken.mint(user3.address, ethers.parseUnits('10000', 6));
		await paymentToken.mint(relayer.address, ethers.parseUnits('10000', 6));

		await paymentToken.connect(user1).approve(await kami721c.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(user2).approve(await kami721c.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(user3).approve(await kami721c.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(relayer).approve(await kami721c.getAddress(), ethers.MaxUint256);
	});

	describe('burnWithSignature', function () {
		beforeEach(async function () {
			await kami721c.connect(user1).mint(user1.address, PRICE, 'https://example.com/1', []);
		});

		it('should succeed when relayer submits valid owner signature', async function () {
			const tokenId = 1n;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721c.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ Burn: [{ name: 'tokenId', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, deadline }
			);
			await kami721c.connect(relayer).burnWithSignature(tokenId, deadline, signature);
			await expect(kami721c.ownerOf(tokenId)).to.be.reverted;
		});

		it('should revert InvalidSigner when signer is not token owner', async function () {
			const tokenId = 1n;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721c.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ Burn: [{ name: 'tokenId', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, deadline }
			);
			await expect(kami721c.connect(relayer).burnWithSignature(tokenId, deadline, signature))
				.to.be.revertedWithCustomError(kami721c, 'InvalidSigner');
		});
	});

	describe('initiateTransferWithRoyaltyWithSignature', function () {
		beforeEach(async function () {
			await kami721c.connect(user1).mint(user1.address, PRICE, 'https://example.com/1', []);
		});

		it('should succeed when relayer submits valid owner signature', async function () {
			const tokenId = 1n;
			const to = user2.address;
			const price = PRICE;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721c.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ InitiateTransferWithRoyalty: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }, { name: 'price', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
				{ to, tokenId, price, deadline }
			);
			await kami721c.connect(relayer).initiateTransferWithRoyaltyWithSignature(to, tokenId, price, deadline, signature);
			await kami721c.connect(user2).payTransferRoyalty(user1.address, tokenId, price);
			await kami721c.connect(user1).transferFrom(user1.address, to, tokenId);
			expect(await kami721c.ownerOf(tokenId)).to.equal(to);
		});
	});

	describe('sellTokenWithSignature', function () {
		beforeEach(async function () {
			await kami721c.connect(user1).mint(user1.address, PRICE, 'https://example.com/1', []);
			await kami721c.setPrice(1, PRICE);
		});

		it('should succeed when relayer submits valid seller signature', async function () {
			const tokenId = 1n;
			const to = user2.address;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721c.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ SellToken: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
				{ to, tokenId, deadline }
			);
			await kami721c.connect(relayer).sellTokenWithSignature(to, tokenId, deadline, signature);
			expect(await kami721c.ownerOf(tokenId)).to.equal(user2.address);
		});
	});

	describe('setTokenURIWithSignature', function () {
		beforeEach(async function () {
			await kami721c.connect(user1).mint(user1.address, PRICE, 'https://example.com/1', []);
		});

		it('should succeed when relayer submits valid owner signature', async function () {
			const tokenId = 1n;
			const newTokenURI = 'https://example.com/updated/1';
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721c.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ SetTokenURI: [{ name: 'tokenId', type: 'uint256' }, { name: 'newTokenURI', type: 'string' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, newTokenURI, deadline }
			);
			await kami721c.connect(relayer).setTokenURIWithSignature(tokenId, newTokenURI, deadline, signature);
			expect(await kami721c.tokenURI(tokenId)).to.equal(newTokenURI);
		});
	});

	describe('rentTokenWithSignature', function () {
		beforeEach(async function () {
			await kami721c.connect(user1).mint(user1.address, PRICE, 'https://example.com/1', []);
		});

		it('should succeed when relayer submits valid renter signature', async function () {
			const tokenId = 1n;
			const renter = user2.address;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721c.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ RentToken: [{ name: 'tokenId', type: 'uint256' }, { name: 'duration', type: 'uint256' }, { name: 'rentalPrice', type: 'uint256' }, { name: 'renter', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, duration: RENTAL_DURATION, rentalPrice: RENTAL_PRICE, renter, deadline }
			);
			await kami721c.connect(relayer).rentTokenWithSignature(tokenId, RENTAL_DURATION, RENTAL_PRICE, renter, deadline, signature);
			expect(await kami721c.isRented(tokenId)).to.equal(true);
		});
	});

	describe('extendRentalWithSignature', function () {
		beforeEach(async function () {
			await kami721c.connect(user1).mint(user1.address, PRICE, 'https://example.com/1', []);
			await kami721c.connect(user2).rentToken(1, RENTAL_DURATION, RENTAL_PRICE, user2.address);
		});

		it('should succeed when relayer submits valid renter signature', async function () {
			const tokenId = 1n;
			const renter = user2.address;
			const additionalDuration = 86400n;
			const additionalPayment = ethers.parseUnits('50', 6);
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721c.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ ExtendRental: [{ name: 'tokenId', type: 'uint256' }, { name: 'additionalDuration', type: 'uint256' }, { name: 'additionalPayment', type: 'uint256' }, { name: 'renter', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, additionalDuration, additionalPayment, renter, deadline }
			);
			await kami721c.connect(relayer).extendRentalWithSignature(tokenId, additionalDuration, additionalPayment, renter, deadline, signature);
			const info = await kami721c.getRentalInfo(tokenId);
			expect(info.endTime).to.be.gt(info.startTime + RENTAL_DURATION);
		});
	});

	describe('endRentalWithSignature', function () {
		beforeEach(async function () {
			await kami721c.connect(user1).mint(user1.address, PRICE, 'https://example.com/1', []);
			await kami721c.connect(user2).rentToken(1, RENTAL_DURATION, RENTAL_PRICE, user2.address);
		});

		it('should succeed when relayer submits valid renter signature', async function () {
			const tokenId = 1n;
			const renter = user2.address;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721c.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ EndRental: [{ name: 'tokenId', type: 'uint256' }, { name: 'renter', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, renter, deadline }
			);
			await kami721c.connect(relayer).endRentalWithSignature(tokenId, renter, deadline, signature);
			expect(await kami721c.isRented(tokenId)).to.equal(false);
		});
	});

	describe('payTransferRoyaltyWithSignature', function () {
		beforeEach(async function () {
			await kami721c.connect(user1).mint(user1.address, PRICE, 'https://example.com/1', []);
			await kami721c.setPrice(1, PRICE);
			await kami721c.connect(user1).initiateTransferWithRoyalty(user2.address, 1, PRICE);
		});

		it('should succeed when relayer submits valid buyer signature', async function () {
			const tokenId = 1n;
			const price = PRICE;
			const buyer = user2.address;
			const seller = user1.address;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721c.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ PayTransferRoyalty: [{ name: 'tokenId', type: 'uint256' }, { name: 'price', type: 'uint256' }, { name: 'buyer', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, price, buyer, deadline }
			);
			await kami721c.connect(relayer).payTransferRoyaltyWithSignature(seller, tokenId, price, buyer, deadline, signature);
			await kami721c.connect(user1).transferFrom(user1.address, user2.address, tokenId);
			expect(await kami721c.ownerOf(tokenId)).to.equal(user2.address);
		});
	});
});
