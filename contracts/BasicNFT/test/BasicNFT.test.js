const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('BasicNFT', function () {
	let paymentToken;
	let basicNFT;
	let owner;
	let user1;
	let user2;
	const mintPrice = ethers.parseEther('10'); // 10 tokens

	beforeEach(async function () {
		[owner, user1, user2] = await ethers.getSigners();

		// Deploy PaymentToken
		const PaymentToken = await ethers.getContractFactory('PaymentToken');
		paymentToken = await PaymentToken.deploy(
			'KAMI Token',
			'KAMI',
			18,
			ethers.parseEther('1000000') // 1M tokens
		);
		await paymentToken.waitForDeployment();

		// Deploy BasicNFT
		const BasicNFT = await ethers.getContractFactory('BasicNFT');
		basicNFT = await BasicNFT.deploy('KAMI NFT Collection', 'KAMINFT', await paymentToken.getAddress(), 18, mintPrice);
		await basicNFT.waitForDeployment();

		// Transfer some tokens to users for testing
		await paymentToken.transfer(user1.address, ethers.parseEther('100'));
		await paymentToken.transfer(user2.address, ethers.parseEther('100'));
	});

	describe('Deployment', function () {
		it('Should set the correct payment token', async function () {
			expect(await basicNFT.paymentToken()).to.equal(await paymentToken.getAddress());
		});

		it('Should set the correct mint price', async function () {
			expect(await basicNFT.mintPrice()).to.equal(mintPrice);
		});

		it('Should set the correct payment token decimals', async function () {
			expect(await basicNFT.paymentTokenDecimals()).to.equal(18);
		});

		it('Should set the correct name and symbol', async function () {
			expect(await basicNFT.name()).to.equal('KAMI NFT Collection');
			expect(await basicNFT.symbol()).to.equal('KAMINFT');
		});
	});

	describe('Minting', function () {
		it('Should mint NFT with specific token ID', async function () {
			const tokenId = 1;
			const tokenURI = 'https://example.com/metadata/1';

			// Approve payment
			await paymentToken.connect(user1).approve(await basicNFT.getAddress(), mintPrice);

			// Mint NFT
			await expect(basicNFT.connect(user1).mint(tokenURI, tokenId))
				.to.emit(basicNFT, 'NFTMinted')
				.withArgs(user1.address, tokenId, tokenURI, mintPrice);

			// Check ownership
			expect(await basicNFT.ownerOf(tokenId)).to.equal(user1.address);
			expect(await basicNFT.tokenURI(tokenId)).to.equal(tokenURI);
		});

		it('Should mint NFT with auto-incrementing ID', async function () {
			const tokenURI = 'https://example.com/metadata/auto';

			// Approve payment
			await paymentToken.connect(user1).approve(await basicNFT.getAddress(), mintPrice);

			// Mint NFT
			await expect(basicNFT.connect(user1).mintWithAutoId(tokenURI))
				.to.emit(basicNFT, 'NFTMinted')
				.withArgs(user1.address, 1, tokenURI, mintPrice);

			// Check ownership
			expect(await basicNFT.ownerOf(1)).to.equal(user1.address);
			expect(await basicNFT.tokenURI(1)).to.equal(tokenURI);
		});

		it('Should fail to mint with insufficient payment token balance', async function () {
			const tokenId = 1;
			const tokenURI = 'https://example.com/metadata/1';

			// Don't approve payment
			await expect(basicNFT.connect(user1).mint(tokenURI, tokenId)).to.be.revertedWithCustomError(
				paymentToken,
				'ERC20InsufficientAllowance'
			);
		});

		it('Should fail to mint with existing token ID', async function () {
			const tokenId = 1;
			const tokenURI = 'https://example.com/metadata/1';

			// Approve payment
			await paymentToken.connect(user1).approve(await basicNFT.getAddress(), mintPrice);

			// Mint first NFT
			await basicNFT.connect(user1).mint(tokenURI, tokenId);

			// Try to mint with same ID
			await expect(basicNFT.connect(user2).mint(tokenURI, tokenId)).to.be.revertedWith('Token ID already exists');
		});

		it('Should fail to mint with zero token ID', async function () {
			const tokenId = 0;
			const tokenURI = 'https://example.com/metadata/0';

			// Approve payment
			await paymentToken.connect(user1).approve(await basicNFT.getAddress(), mintPrice);

			await expect(basicNFT.connect(user1).mint(tokenURI, tokenId)).to.be.revertedWith('Token ID must be greater than zero');
		});

		it('Should fail to mint with empty token URI', async function () {
			const tokenId = 1;
			const tokenURI = '';

			// Approve payment
			await paymentToken.connect(user1).approve(await basicNFT.getAddress(), mintPrice);

			await expect(basicNFT.connect(user1).mint(tokenURI, tokenId)).to.be.revertedWith('Token URI cannot be empty');
		});
	});

	describe('Owner Functions', function () {
		it('Should update payment token', async function () {
			// Deploy new payment token
			const NewPaymentToken = await ethers.getContractFactory('PaymentToken');
			const newPaymentToken = await NewPaymentToken.deploy('New Token', 'NEW', 6, ethers.parseUnits('1000000', 6));
			await newPaymentToken.waitForDeployment();

			await expect(basicNFT.updatePaymentToken(await newPaymentToken.getAddress(), 6))
				.to.emit(basicNFT, 'PaymentTokenUpdated')
				.withArgs(await paymentToken.getAddress(), await newPaymentToken.getAddress());

			expect(await basicNFT.paymentToken()).to.equal(await newPaymentToken.getAddress());
			expect(await basicNFT.paymentTokenDecimals()).to.equal(6);
		});

		it('Should update mint price', async function () {
			const newPrice = ethers.parseEther('20');

			await expect(basicNFT.updateMintPrice(newPrice)).to.emit(basicNFT, 'MintPriceUpdated').withArgs(mintPrice, newPrice);

			expect(await basicNFT.mintPrice()).to.equal(newPrice);
		});

		it('Should fail to update payment token from non-owner', async function () {
			await expect(basicNFT.connect(user1).updatePaymentToken(user1.address, 18)).to.be.revertedWithCustomError(
				basicNFT,
				'OwnableUnauthorizedAccount'
			);
		});

		it('Should fail to update mint price from non-owner', async function () {
			await expect(basicNFT.connect(user1).updateMintPrice(ethers.parseEther('20'))).to.be.revertedWithCustomError(
				basicNFT,
				'OwnableUnauthorizedAccount'
			);
		});
	});

	describe('View Functions', function () {
		it('Should return correct next token ID', async function () {
			expect(await basicNFT.getNextTokenId()).to.equal(1);

			// Mint an NFT
			await paymentToken.connect(user1).approve(await basicNFT.getAddress(), mintPrice);
			await basicNFT.connect(user1).mintWithAutoId('https://example.com/metadata/1');

			expect(await basicNFT.getNextTokenId()).to.equal(2);
		});

		it('Should check token existence correctly', async function () {
			expect(await basicNFT.tokenExists(1)).to.be.false;

			// Mint an NFT
			await paymentToken.connect(user1).approve(await basicNFT.getAddress(), mintPrice);
			await basicNFT.connect(user1).mint('https://example.com/metadata/1', 1);

			expect(await basicNFT.tokenExists(1)).to.be.true;
		});
	});
});
