import { expect } from 'chai';
import { ethers } from 'hardhat';
import { KAMI1155C } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

const EIP712_DOMAIN_NAME = 'KAMI1155C';
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

describe('KAMI1155C WithSignature (gasless)', function () {
	let kami1155c: KAMI1155C;
	let paymentToken: any;
	let owner: SignerWithAddress;
	let platform: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;
	let relayer: SignerWithAddress;

	const BASE_URI = 'https://api.kami.com/token/';
	const PRICE = ethers.parseUnits('100', 6);
	const PLATFORM_COMMISSION = 2000;
	const RENTAL_DURATION = 86400n;
	const RENTAL_PRICE = ethers.parseUnits('100', 6);

	beforeEach(async function () {
		[owner, platform, user1, user2, user3, relayer] = await ethers.getSigners();

		const MockERC20Factory = await ethers.getContractFactory('contracts/test/MockERC20.sol:MockERC20');
		paymentToken = await MockERC20Factory.deploy('Mock Payment Token', 'MPT', 6);

		const KAMI1155CFactory = await ethers.getContractFactory('KAMI1155C');
		kami1155c = await KAMI1155CFactory.deploy(
			await paymentToken.getAddress(),
			BASE_URI,
			platform.address,
			PLATFORM_COMMISSION,
			owner.address,
			0
		);

		await paymentToken.mint(user1.address, ethers.parseUnits('10000', 6));
		await paymentToken.mint(user2.address, ethers.parseUnits('10000', 6));
		await paymentToken.mint(user3.address, ethers.parseUnits('10000', 6));
		await paymentToken.mint(relayer.address, ethers.parseUnits('10000', 6));

		await paymentToken.connect(user1).approve(await kami1155c.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(user2).approve(await kami1155c.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(user3).approve(await kami1155c.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(relayer).approve(await kami1155c.getAddress(), ethers.MaxUint256);
	});

	describe('sellTokenWithSignature', function () {
		beforeEach(async function () {
			await kami1155c.connect(user1).mint(user1.address, 5, PRICE, 'https://example.com/1', []);
			await kami1155c.connect(owner).setPrice(1, PRICE);
		});

		it('should succeed when relayer submits valid seller signature', async function () {
			const tokenId = 1n;
			const amount = 2n;
			const to = user2.address;
			const seller = user1.address;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami1155c.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ SellToken1155: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }, { name: 'amount', type: 'uint256' }, { name: 'seller', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ to, tokenId, amount, seller, deadline }
			);
			await paymentToken.connect(user2).approve(await kami1155c.getAddress(), PRICE * amount);
			await kami1155c.connect(relayer).sellTokenWithSignature(to, tokenId, amount, seller, deadline, signature);
			expect(await kami1155c.balanceOf(user2.address, tokenId)).to.equal(amount);
			expect(await kami1155c.balanceOf(user1.address, tokenId)).to.equal(3n); // 5 - 2
		});
	});

	describe('setTokenURIWithSignature', function () {
		beforeEach(async function () {
			await kami1155c.connect(user1).mint(user1.address, 3, PRICE, 'https://example.com/1', []);
		});

		it('should succeed when relayer submits valid owner signature', async function () {
			const tokenId = 1n;
			const newTokenURI = 'https://example.com/updated/1';
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami1155c.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ SetTokenURI1155: [{ name: 'tokenId', type: 'uint256' }, { name: 'newTokenURI', type: 'string' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, newTokenURI, deadline }
			);
			await kami1155c.connect(relayer).setTokenURIWithSignature(tokenId, newTokenURI, deadline, signature);
			expect(await kami1155c.uri(tokenId)).to.equal(newTokenURI);
		});
	});

	describe('rentTokenWithSignature', function () {
		beforeEach(async function () {
			await kami1155c.connect(user1).mint(user1.address, 3, PRICE, 'https://example.com/1', []);
		});

		it('should succeed when relayer submits valid renter signature', async function () {
			const tokenId = 1n;
			const renter = user2.address;
			const tokenOwner = user1.address;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami1155c.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ RentToken1155: [{ name: 'tokenId', type: 'uint256' }, { name: 'duration', type: 'uint256' }, { name: 'rentalPrice', type: 'uint256' }, { name: 'renter', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, duration: RENTAL_DURATION, rentalPrice: RENTAL_PRICE, renter, deadline }
			);
			await kami1155c.connect(relayer).rentTokenWithSignature(tokenId, RENTAL_DURATION, RENTAL_PRICE, renter, tokenOwner, deadline, signature);
			expect(await kami1155c.isRented(tokenId)).to.equal(true);
		});
	});

	describe('extendRentalWithSignature', function () {
		beforeEach(async function () {
			await kami1155c.connect(user1).mint(user1.address, 3, PRICE, 'https://example.com/1', []);
			const commission = (RENTAL_PRICE * BigInt(PLATFORM_COMMISSION)) / 10000n;
			await paymentToken.connect(user2).approve(await kami1155c.getAddress(), RENTAL_PRICE + commission);
			await kami1155c.connect(user2).rentToken(1, RENTAL_DURATION, RENTAL_PRICE, user2.address, user1.address);
		});

		it('should succeed when relayer submits valid token owner signature', async function () {
			const tokenId = 1n;
			const tokenOwner = user1.address;
			const additionalDuration = 86400n;
			const additionalPayment = ethers.parseUnits('50', 6);
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami1155c.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ ExtendRental1155: [{ name: 'tokenId', type: 'uint256' }, { name: 'additionalDuration', type: 'uint256' }, { name: 'additionalPayment', type: 'uint256' }, { name: 'tokenOwner', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, additionalDuration, additionalPayment, tokenOwner, deadline }
			);
			const commission = (additionalPayment * BigInt(PLATFORM_COMMISSION)) / 10000n;
			await paymentToken.connect(user1).approve(await kami1155c.getAddress(), additionalPayment + commission);
			await kami1155c.connect(relayer).extendRentalWithSignature(tokenId, additionalDuration, additionalPayment, tokenOwner, deadline, signature);
			const info = await kami1155c.getRentalInfo(tokenId);
			expect(info.endTime).to.be.gt(info.startTime + RENTAL_DURATION);
		});
	});

	describe('endRentalWithSignature', function () {
		beforeEach(async function () {
			await kami1155c.connect(user1).mint(user1.address, 3, PRICE, 'https://example.com/1', []);
			const commission = (RENTAL_PRICE * BigInt(PLATFORM_COMMISSION)) / 10000n;
			await paymentToken.connect(user2).approve(await kami1155c.getAddress(), RENTAL_PRICE + commission);
			await kami1155c.connect(user2).rentToken(1, RENTAL_DURATION, RENTAL_PRICE, user2.address, user1.address);
		});

		it('should succeed when relayer submits valid renter signature', async function () {
			const tokenId = 1n;
			const signer = user2.address; // renter
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami1155c.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ EndRental1155: [{ name: 'tokenId', type: 'uint256' }, { name: 'signer', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, signer, deadline }
			);
			await kami1155c.connect(relayer).endRentalWithSignature(tokenId, signer, deadline, signature);
			expect(await kami1155c.isRented(tokenId)).to.equal(false);
		});
	});

	describe('initiateTransferWithRoyaltyWithSignature', function () {
		beforeEach(async function () {
			await kami1155c.connect(user1).mint(user1.address, 3, PRICE, 'https://example.com/1', []);
			await kami1155c.connect(owner).setPrice(1, PRICE);
		});

		it('should succeed when relayer submits valid token owner signature', async function () {
			const tokenId = 1n;
			const to = user2.address;
			const price = PRICE;
			const tokenOwner = user1.address;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami1155c.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ InitiateTransferWithRoyalty1155: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }, { name: 'price', type: 'uint256' }, { name: 'tokenOwner', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ to, tokenId, price, tokenOwner, deadline }
			);
			await kami1155c.connect(relayer).initiateTransferWithRoyaltyWithSignature(to, tokenId, price, tokenOwner, deadline, signature);
			await paymentToken.connect(user2).approve(await kami1155c.getAddress(), price);
			await kami1155c.connect(user2).payTransferRoyalty(user1.address, tokenId, price);
			await kami1155c.connect(user1).safeTransferFrom(user1.address, user2.address, tokenId, 1, '0x');
			expect(await kami1155c.balanceOf(user2.address, tokenId)).to.equal(1n);
		});
	});

	describe('payTransferRoyaltyWithSignature', function () {
		beforeEach(async function () {
			await kami1155c.connect(user1).mint(user1.address, 3, PRICE, 'https://example.com/1', []);
			await kami1155c.connect(owner).setPrice(1, PRICE);
			await kami1155c.connect(user1).initiateTransferWithRoyalty(user2.address, 1, PRICE);
		});

		it('should succeed when relayer submits valid buyer signature', async function () {
			const tokenId = 1n;
			const price = PRICE;
			const buyer = user2.address;
			const seller = user1.address;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami1155c.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ PayTransferRoyalty1155: [{ name: 'tokenId', type: 'uint256' }, { name: 'price', type: 'uint256' }, { name: 'buyer', type: 'address' }, { name: 'seller', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, price, buyer, seller, deadline }
			);
			await paymentToken.connect(user2).approve(await kami1155c.getAddress(), price);
			await kami1155c.connect(relayer).payTransferRoyaltyWithSignature(tokenId, price, buyer, seller, deadline, signature);
			await kami1155c.connect(user1).safeTransferFrom(user1.address, user2.address, tokenId, 1, '0x');
			expect(await kami1155c.balanceOf(user2.address, tokenId)).to.equal(1n);
		});
	});

	describe('burnWithSignature', function () {
		beforeEach(async function () {
			await kami1155c.connect(user1).mint(user1.address, 5, PRICE, 'https://example.com/1', []);
		});

		it('should succeed when relayer submits valid owner signature', async function () {
			const tokenId = 1n;
			const amount = 2n;
			const ownerAddr = user1.address;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami1155c.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ Burn1155: [{ name: 'tokenId', type: 'uint256' }, { name: 'amount', type: 'uint256' }, { name: 'owner', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, amount, owner: ownerAddr, deadline }
			);
			await kami1155c.connect(relayer).burnWithSignature(tokenId, amount, ownerAddr, deadline, signature);
			expect(await kami1155c.balanceOf(user1.address, tokenId)).to.equal(3n); // 5 - 2
		});
	});
});
