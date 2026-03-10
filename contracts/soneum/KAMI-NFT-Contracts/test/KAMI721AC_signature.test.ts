import { expect } from 'chai';
import { ethers } from 'hardhat';
import { KAMI721AC } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

/** EIP-712 domain and typed data helpers for KAMI721AC gasless entrypoints */
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

describe('KAMI721AC WithSignature (gasless)', function () {
	let kami721ac: KAMI721AC;
	let paymentToken: any;
	let owner: SignerWithAddress;
	let platform: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;
	let relayer: SignerWithAddress;

	const TOKEN_NAME = 'KAMI721AC';
	const TOKEN_SYMBOL = 'KAMI';
	const BASE_URI = 'https://api.kami.com/token/';
	const CLAIM_PRICE = ethers.parseUnits('100', 6);
	const PLATFORM_COMMISSION = 2000;
	const RENTAL_DURATION = 86400n;
	const RENTAL_PRICE = ethers.parseUnits('100', 6);

	beforeEach(async function () {
		[owner, platform, user1, user2, user3, relayer] = await ethers.getSigners();

		const MockERC20Factory = await ethers.getContractFactory('contracts/test/MockERC20.sol:MockERC20');
		paymentToken = await MockERC20Factory.deploy('Mock Payment Token', 'MPT', 6);

		const KAMI721ACFactory = await ethers.getContractFactory('KAMI721AC');
		kami721ac = await KAMI721ACFactory.deploy(
			await paymentToken.getAddress(),
			TOKEN_NAME,
			TOKEN_SYMBOL,
			BASE_URI,
			platform.address,
			PLATFORM_COMMISSION,
			owner.address,
			0,
			CLAIM_PRICE
		);

		await paymentToken.mint(owner.address, ethers.parseUnits('100000', 6));
		await paymentToken.mint(user1.address, ethers.parseUnits('10000', 6));
		await paymentToken.mint(user2.address, ethers.parseUnits('10000', 6));
		await paymentToken.mint(user3.address, ethers.parseUnits('10000', 6));
		await paymentToken.mint(relayer.address, ethers.parseUnits('10000', 6));

		await paymentToken.connect(user1).approve(await kami721ac.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(user2).approve(await kami721ac.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(user3).approve(await kami721ac.getAddress(), ethers.MaxUint256);
		await paymentToken.connect(relayer).approve(await kami721ac.getAddress(), ethers.MaxUint256);
	});

	describe('setSalePriceWithSignature', function () {
		beforeEach(async function () {
			await kami721ac.connect(user1).claim('https://example.com/1', []);
		});

		it('should succeed when relayer submits valid owner signature', async function () {
			const tokenId = 1n;
			const newSalePrice = ethers.parseUnits('200', 6);
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ SetSalePrice: [{ name: 'tokenId', type: 'uint256' }, { name: 'newSalePrice', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, newSalePrice, deadline }
			);
			await kami721ac.connect(relayer).setSalePriceWithSignature(tokenId, newSalePrice, deadline, signature);
			expect(await kami721ac.salePrices(tokenId)).to.equal(newSalePrice);
		});

		it('should revert SignatureExpired when deadline has passed', async function () {
			const tokenId = 1n;
			const newSalePrice = ethers.parseUnits('200', 6);
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp - 1;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ SetSalePrice: [{ name: 'tokenId', type: 'uint256' }, { name: 'newSalePrice', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, newSalePrice, deadline }
			);
			await expect(kami721ac.connect(relayer).setSalePriceWithSignature(tokenId, newSalePrice, deadline, signature))
				.to.be.revertedWithCustomError(kami721ac, 'SignatureExpired');
		});

		it('should revert InvalidSigner when signer is not token owner', async function () {
			const tokenId = 1n;
			const newSalePrice = ethers.parseUnits('200', 6);
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ SetSalePrice: [{ name: 'tokenId', type: 'uint256' }, { name: 'newSalePrice', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, newSalePrice, deadline }
			);
			await expect(kami721ac.connect(relayer).setSalePriceWithSignature(tokenId, newSalePrice, deadline, signature))
				.to.be.revertedWithCustomError(kami721ac, 'InvalidSigner');
		});
	});

	describe('burnWithSignature', function () {
		beforeEach(async function () {
			await kami721ac.connect(user1).claim('https://example.com/1', []);
		});

		it('should succeed when relayer submits valid owner signature', async function () {
			const tokenId = 1n;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ Burn: [{ name: 'tokenId', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, deadline }
			);
			await kami721ac.connect(relayer).burnWithSignature(tokenId, deadline, signature);
			await expect(kami721ac.ownerOf(tokenId)).to.be.reverted;
		});

		it('should revert SignatureExpired when deadline has passed', async function () {
			const tokenId = 1n;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp - 1;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ Burn: [{ name: 'tokenId', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, deadline }
			);
			await expect(kami721ac.connect(relayer).burnWithSignature(tokenId, deadline, signature))
				.to.be.revertedWithCustomError(kami721ac, 'SignatureExpired');
		});

		it('should revert InvalidSigner when signer is not token owner', async function () {
			const tokenId = 1n;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ Burn: [{ name: 'tokenId', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, deadline }
			);
			await expect(kami721ac.connect(relayer).burnWithSignature(tokenId, deadline, signature))
				.to.be.revertedWithCustomError(kami721ac, 'InvalidSigner');
		});
	});

	describe('initiateTransferWithRoyaltyWithSignature', function () {
		beforeEach(async function () {
			await kami721ac.connect(user1).claim('https://example.com/1', []);
			await kami721ac.connect(user1).setSalePrice(1, CLAIM_PRICE);
		});

		it('should succeed when relayer submits valid owner signature', async function () {
			const tokenId = 1n;
			const to = user2.address;
			const price = CLAIM_PRICE;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ InitiateTransferWithRoyalty: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }, { name: 'price', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
				{ to, tokenId, price, deadline }
			);
			await kami721ac.connect(relayer).initiateTransferWithRoyaltyWithSignature(to, tokenId, price, deadline, signature);
			// Buyer pays; then seller completes by transferring NFT to buyer
			await kami721ac.connect(user2).payTransferRoyalty(to, tokenId, price);
			await kami721ac.connect(user1).transferFrom(user1.address, to, tokenId);
			expect(await kami721ac.ownerOf(tokenId)).to.equal(to);
		});

		it('should revert InvalidSigner when signer is not token owner', async function () {
			const tokenId = 1n;
			const to = user2.address;
			const price = CLAIM_PRICE;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ InitiateTransferWithRoyalty: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }, { name: 'price', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
				{ to, tokenId, price, deadline }
			);
			await expect(kami721ac.connect(relayer).initiateTransferWithRoyaltyWithSignature(to, tokenId, price, deadline, signature))
				.to.be.revertedWithCustomError(kami721ac, 'InvalidSigner');
		});
	});

	describe('sellTokenWithSignature', function () {
		beforeEach(async function () {
			await kami721ac.connect(user1).claim('https://example.com/1', []);
			await kami721ac.connect(user1).setSalePrice(1, CLAIM_PRICE);
			await paymentToken.connect(user2).approve(await kami721ac.getAddress(), ethers.MaxUint256);
		});

		it('should succeed when relayer submits valid seller signature', async function () {
			const tokenId = 1n;
			const to = user2.address;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ SellToken: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
				{ to, tokenId, deadline }
			);
			await kami721ac.connect(relayer).sellTokenWithSignature(to, tokenId, deadline, signature);
			expect(await kami721ac.ownerOf(tokenId)).to.equal(user2.address);
		});

		it('should revert when signer is not token owner', async function () {
			const tokenId = 1n;
			const to = user3.address;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ SellToken: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
				{ to, tokenId, deadline }
			);
			await expect(kami721ac.connect(relayer).sellTokenWithSignature(to, tokenId, deadline, signature))
				.to.be.revertedWithCustomError(kami721ac, 'SellerNotTokenOwner');
		});
	});

	describe('setTokenURIWithSignature', function () {
		beforeEach(async function () {
			await kami721ac.connect(user1).claim('https://example.com/1', []);
		});

		it('should succeed when relayer submits valid owner signature', async function () {
			const tokenId = 1n;
			const newTokenURI = 'https://example.com/updated/1';
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ SetTokenURI: [{ name: 'tokenId', type: 'uint256' }, { name: 'newTokenURI', type: 'string' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, newTokenURI, deadline }
			);
			await kami721ac.connect(relayer).setTokenURIWithSignature(tokenId, newTokenURI, deadline, signature);
			expect(await kami721ac.tokenURI(tokenId)).to.equal(newTokenURI);
		});

		it('should revert InvalidSigner when signer is not token owner', async function () {
			const tokenId = 1n;
			const newTokenURI = 'https://example.com/updated/1';
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ SetTokenURI: [{ name: 'tokenId', type: 'uint256' }, { name: 'newTokenURI', type: 'string' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, newTokenURI, deadline }
			);
			await expect(kami721ac.connect(relayer).setTokenURIWithSignature(tokenId, newTokenURI, deadline, signature))
				.to.be.revertedWithCustomError(kami721ac, 'InvalidSigner');
		});
	});

	describe('rentTokenWithSignature', function () {
		beforeEach(async function () {
			await kami721ac.connect(user1).claim('https://example.com/1', []);
		});

		it('should succeed when relayer submits valid renter signature', async function () {
			const tokenId = 1n;
			const renter = user2.address;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ RentToken: [{ name: 'tokenId', type: 'uint256' }, { name: 'duration', type: 'uint256' }, { name: 'rentalPrice', type: 'uint256' }, { name: 'renter', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, duration: RENTAL_DURATION, rentalPrice: RENTAL_PRICE, renter, deadline }
			);
			await kami721ac.connect(relayer).rentTokenWithSignature(tokenId, RENTAL_DURATION, RENTAL_PRICE, renter, deadline, signature);
			expect(await kami721ac.isRented(tokenId)).to.equal(true);
			const info = await kami721ac.getRentalInfo(tokenId);
			expect(info.renter).to.equal(renter);
		});

		it('should revert InvalidSigner when signer != renter param', async function () {
			const tokenId = 1n;
			const renter = user2.address;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user3.signTypedData(
				domain,
				{ RentToken: [{ name: 'tokenId', type: 'uint256' }, { name: 'duration', type: 'uint256' }, { name: 'rentalPrice', type: 'uint256' }, { name: 'renter', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, duration: RENTAL_DURATION, rentalPrice: RENTAL_PRICE, renter, deadline }
			);
			await expect(kami721ac.connect(relayer).rentTokenWithSignature(tokenId, RENTAL_DURATION, RENTAL_PRICE, renter, deadline, signature))
				.to.be.revertedWithCustomError(kami721ac, 'InvalidSigner');
		});
	});

	describe('extendRentalWithSignature', function () {
		beforeEach(async function () {
			await kami721ac.connect(user1).claim('https://example.com/1', []);
			await kami721ac.connect(user2).rentToken(1, RENTAL_DURATION, RENTAL_PRICE, user2.address);
		});

		it('should succeed when relayer submits valid renter signature', async function () {
			const tokenId = 1n;
			const renter = user2.address;
			const additionalDuration = 86400n;
			const additionalPayment = ethers.parseUnits('50', 6);
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ ExtendRental: [{ name: 'tokenId', type: 'uint256' }, { name: 'additionalDuration', type: 'uint256' }, { name: 'additionalPayment', type: 'uint256' }, { name: 'renter', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, additionalDuration, additionalPayment, renter, deadline }
			);
			await kami721ac.connect(relayer).extendRentalWithSignature(tokenId, additionalDuration, additionalPayment, renter, deadline, signature);
			const info = await kami721ac.getRentalInfo(tokenId);
			expect(info.endTime).to.be.gt(info.startTime + RENTAL_DURATION);
		});

		it('should revert InvalidSigner when signer is not current renter', async function () {
			const tokenId = 1n;
			const renter = user2.address;
			const additionalDuration = 86400n;
			const additionalPayment = ethers.parseUnits('50', 6);
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user3.signTypedData(
				domain,
				{ ExtendRental: [{ name: 'tokenId', type: 'uint256' }, { name: 'additionalDuration', type: 'uint256' }, { name: 'additionalPayment', type: 'uint256' }, { name: 'renter', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, additionalDuration, additionalPayment, renter, deadline }
			);
			await expect(kami721ac.connect(relayer).extendRentalWithSignature(tokenId, additionalDuration, additionalPayment, renter, deadline, signature))
				.to.be.revertedWithCustomError(kami721ac, 'InvalidSigner');
		});
	});

	describe('endRentalWithSignature', function () {
		beforeEach(async function () {
			await kami721ac.connect(user1).claim('https://example.com/1', []);
			await kami721ac.connect(user2).rentToken(1, RENTAL_DURATION, RENTAL_PRICE, user2.address);
		});

		it('should succeed when relayer submits valid renter signature', async function () {
			const tokenId = 1n;
			const renter = user2.address;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ EndRental: [{ name: 'tokenId', type: 'uint256' }, { name: 'renter', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, renter, deadline }
			);
			await kami721ac.connect(relayer).endRentalWithSignature(tokenId, renter, deadline, signature);
			expect(await kami721ac.isRented(tokenId)).to.equal(false);
		});
	});

	describe('payTransferRoyaltyWithSignature', function () {
		beforeEach(async function () {
			await kami721ac.connect(user1).claim('https://example.com/1', []);
			await kami721ac.connect(user1).setSalePrice(1, CLAIM_PRICE);
			await kami721ac.initiateTransferWithRoyalty(user2.address, 1, CLAIM_PRICE);
		});

		it('should succeed when relayer submits valid buyer signature', async function () {
			const tokenId = 1n;
			const price = CLAIM_PRICE;
			const buyer = user2.address;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ PayTransferRoyalty: [{ name: 'tokenId', type: 'uint256' }, { name: 'price', type: 'uint256' }, { name: 'buyer', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, price, buyer, deadline }
			);
			await kami721ac.connect(relayer).payTransferRoyaltyWithSignature(user1.address, tokenId, price, buyer, deadline, signature);
			// Seller completes by transferring NFT to buyer
			await kami721ac.connect(user1).transferFrom(user1.address, user2.address, tokenId);
			expect(await kami721ac.ownerOf(tokenId)).to.equal(user2.address);
		});

		it('should revert InvalidSigner when signer != buyer', async function () {
			const tokenId = 1n;
			const price = CLAIM_PRICE;
			const buyer = user2.address;
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user3.signTypedData(
				domain,
				{ PayTransferRoyalty: [{ name: 'tokenId', type: 'uint256' }, { name: 'price', type: 'uint256' }, { name: 'buyer', type: 'address' }, { name: 'deadline', type: 'uint256' }] },
				{ tokenId, price, buyer, deadline }
			);
			await expect(kami721ac.connect(relayer).payTransferRoyaltyWithSignature(user1.address, tokenId, price, buyer, deadline, signature))
				.to.be.revertedWithCustomError(kami721ac, 'InvalidSigner');
		});
	});

	describe('claimWithSignature', function () {
		it('should succeed when relayer submits valid claimer signature', async function () {
			const claimer = user1.address;
			const uri = 'https://example.com/claimed/1';
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ Claim: [{ name: 'claimer', type: 'address' }, { name: 'uri', type: 'string' }, { name: 'deadline', type: 'uint256' }] },
				{ claimer, uri, deadline }
			);
			await kami721ac.connect(relayer).claimWithSignature(claimer, uri, [], deadline, signature);
			expect(await kami721ac.ownerOf(1)).to.equal(user1.address);
			expect(await kami721ac.hasClaimed(user1.address)).to.equal(true);
		});

		it('should revert InvalidSigner when signer != claimer', async function () {
			const claimer = user1.address;
			const uri = 'https://example.com/claimed/1';
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user2.signTypedData(
				domain,
				{ Claim: [{ name: 'claimer', type: 'address' }, { name: 'uri', type: 'string' }, { name: 'deadline', type: 'uint256' }] },
				{ claimer, uri, deadline }
			);
			await expect(kami721ac.connect(relayer).claimWithSignature(claimer, uri, [], deadline, signature))
				.to.be.revertedWithCustomError(kami721ac, 'InvalidSigner');
		});

		it('should revert SignatureExpired when deadline has passed', async function () {
			const claimer = user1.address;
			const uri = 'https://example.com/claimed/1';
			const deadline = (await ethers.provider.getBlock('latest'))!.timestamp - 1;
			const domain = await getDomain(await kami721ac.getAddress());
			const signature = await user1.signTypedData(
				domain,
				{ Claim: [{ name: 'claimer', type: 'address' }, { name: 'uri', type: 'string' }, { name: 'deadline', type: 'uint256' }] },
				{ claimer, uri, deadline }
			);
			await expect(kami721ac.connect(relayer).claimWithSignature(claimer, uri, [], deadline, signature))
				.to.be.revertedWithCustomError(kami721ac, 'SignatureExpired');
		});
	});
});
