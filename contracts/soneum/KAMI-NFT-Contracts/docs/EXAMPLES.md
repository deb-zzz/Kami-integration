# Usage Examples

## Basic NFT Operations

### 1. Minting Tokens

#### Simple Mint

```typescript
import { ethers } from 'ethers';

// Connect to contract
const contract = new ethers.Contract(contractAddress, abi, signer);

// First, set global mint price (owner only)
await contract.setMintPrice(ethers.parseUnits('100', 6)); // 100 USDC

// Mint token to yourself (uses global mint price)
const tx = await contract.mint(
	await signer.getAddress(), // recipient
	'https://api.kami.com/metadata/1', // token URI
	[] // no mint royalties
);
await tx.wait();
console.log('Token minted successfully');
```

#### Mint for Someone Else (Gifting)

```typescript
// Mint token as a gift
const recipient = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
const giftPrice = ethers.parseUnits('150', 6); // 150 USDC

const tx = await contract.mint(
	recipient,
	giftPrice,
	'https://api.kami.com/metadata/2', // token URI
	[] // no mint royalties
);
await tx.wait();
console.log(`Token gifted to ${recipient}`);
```

#### Mint with Royalties

```typescript
// Mint token with mint royalties
const recipient = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
const tokenPrice = ethers.parseUnits('200', 6); // 200 USDC

// Define mint royalties (10% to creator, 5% to platform)
const mintRoyalties = [
	{
		receiver: '0x1234567890123456789012345678901234567890', // creator
		feeNumerator: 1000, // 10% (1000/10000)
	},
	{
		receiver: '0x9876543210987654321098765432109876543210', // platform
		feeNumerator: 500, // 5% (500/10000)
	},
];

const tx = await contract.mint(recipient, tokenPrice, 'https://api.kami.com/metadata/3', mintRoyalties);
await tx.wait();
console.log('Token minted with royalties');
```

#### Free Minting (No Payment Required)

```typescript
// Mint token for free (no payment required)
const recipient = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';

const tx = await contract.mint(
	recipient,
	0, // free minting
	'https://api.kami.com/metadata/4',
	[] // no mint royalties
);
await tx.wait();
console.log('Free token minted');
```

#### Batch Minting

```typescript
// Mint multiple tokens with different prices
const recipients = [
	'0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
	'0x8ba1f109551bD432803012645Hac136c4c4c4c4c',
	'0x1234567890123456789012345678901234567890',
];

const prices = [
	ethers.parseUnits('100', 6), // 100 USDC
	ethers.parseUnits('200', 6), // 200 USDC
	ethers.parseUnits('150', 6), // 150 USDC
];

const tx = await contract.mintBatch(recipients, prices);
await tx.wait();
console.log('Batch minting completed');
```

### 2. Selling Tokens

#### Sell Your Own Token

```typescript
const tokenId = 1;
const buyer = '0x8ba1f109551bD432803012645Hac136c4c4c4c4c';

// Sell your token
const tx = await contract.sellToken(
	buyer, // buyer address
	tokenId, // token ID
	await signer.getAddress() // seller (yourself)
);
await tx.wait();
console.log(`Token ${tokenId} sold to ${buyer}`);
```

#### Marketplace Selling (Sell on Behalf)

```typescript
// Marketplace selling token for user
const tokenId = 1;
const buyer = '0x8ba1f109551bD432803012645Hac136c4c4c4c4c';
const tokenOwner = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';

// Marketplace sells token for owner
const tx = await contract.sellToken(
	buyer, // buyer address
	tokenId, // token ID
	tokenOwner // actual token owner
);
await tx.wait();
console.log(`Token ${tokenId} sold by marketplace`);
```

### 3. Renting Tokens

#### Rent for Yourself

```typescript
const tokenId = 1;
const duration = 86400; // 1 day in seconds
const rentalPrice = ethers.parseUnits('10', 6); // 10 USDC

const tx = await contract.rentToken(
	tokenId,
	duration,
	rentalPrice,
	await signer.getAddress() // renter (yourself)
);
await tx.wait();
console.log(`Token ${tokenId} rented for 1 day`);
```

#### Rent for Someone Else

```typescript
const tokenId = 1;
const duration = 86400; // 1 day
const rentalPrice = ethers.parseUnits('10', 6);
const beneficiary = '0x8ba1f109551bD432803012645Hac136c4c4c4c4c';

// Rent token for someone else
const tx = await contract.rentToken(
	tokenId,
	duration,
	rentalPrice,
	beneficiary // renter
);
await tx.wait();
console.log(`Token ${tokenId} rented for ${beneficiary}`);
```

## Advanced Features

### 1. Price Management

#### Set Global Mint Price (Owner Only)

```typescript
const newMintPrice = ethers.parseUnits('100', 6); // 100 USDC

// Only contract owner can set mint price
const tx = await contract.setMintPrice(newMintPrice);
await tx.wait();
console.log(`Global mint price set to 100 USDC`);
```

#### Set Token Sale Price (Token Owner)

```typescript
const tokenId = 1;
const newSalePrice = ethers.parseUnits('500', 6); // 500 USDC

// Token owner can set their own sale price
const tx = await contract.setSalePrice(tokenId, newSalePrice);
await tx.wait();
console.log(`Token ${tokenId} sale price set to 500 USDC`);
```

#### Check Prices

```typescript
// Check global mint price
const mintPrice = await contract.mintPrice();
console.log(`Global mint price: ${ethers.formatUnits(mintPrice, 6)} USDC`);

// Check token sale price
const tokenId = 1;
const salePrice = await contract.salePrices(tokenId);
console.log(`Token ${tokenId} sale price: ${ethers.formatUnits(salePrice, 6)} USDC`);
```

### 2. Royalty Management

#### Set Global Royalty

```typescript
const royaltyPercentage = 1000; // 10% (in basis points)

const tx = await contract.setRoyaltyPercentage(royaltyPercentage);
await tx.wait();
console.log('Global royalty set to 10%');
```

#### Set Token-Specific Royalty

```typescript
const tokenId = 1;
const mintRoyalty = 1500; // 15% mint royalty
const transferRoyalty = 500; // 5% transfer royalty

// Set mint royalty
await contract.setMintRoyalty(tokenId, mintRoyalty);
console.log(`Token ${tokenId} mint royalty set to 15%`);

// Set transfer royalty
await contract.setTransferRoyalty(tokenId, transferRoyalty);
console.log(`Token ${tokenId} transfer royalty set to 5%`);
```

### 3. Rental Management

#### Check Rental Status

```typescript
const tokenId = 1;

// Check if token is rented
const isRented = await contract.isTokenRented(tokenId);
console.log(`Token ${tokenId} is rented: ${isRented}`);

// Get rental information
const rentalInfo = await contract.getRentalInfo(tokenId);
console.log('Rental Info:', {
	renter: rentalInfo.renter,
	startTime: new Date(rentalInfo.startTime * 1000),
	endTime: new Date(rentalInfo.endTime * 1000),
	price: ethers.formatUnits(rentalInfo.price, 6),
});
```

#### End Rental Early

```typescript
const tokenId = 1;

const tx = await contract.endRental(tokenId);
await tx.wait();
console.log(`Rental for token ${tokenId} ended early`);
```

## ERC1155 Specific Examples

### 1. Multi-Token Minting

#### Mint Multiple Tokens

```typescript
const recipient = await signer.getAddress();
const amount = 5; // 5 tokens
const tokenPrice = ethers.parseUnits('50', 6); // 50 USDC per token

const tx = await contract.mint(recipient, amount, tokenPrice);
await tx.wait();
console.log(`Minted ${amount} tokens to ${recipient}`);
```

#### Batch Mint Different Amounts

```typescript
const recipients = [
	'0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
	'0x8ba1f109551bD432803012645Hac136c4c4c4c4c',
	'0x1234567890123456789012345678901234567890',
];

const amounts = [3, 2, 4]; // Different amounts per recipient
const prices = [ethers.parseUnits('50', 6), ethers.parseUnits('75', 6), ethers.parseUnits('100', 6)];

const tx = await contract.mintBatch(recipients, amounts, prices);
await tx.wait();
console.log('Batch minting completed');
```

### 2. ERC1155 Selling

#### Sell Tokens

```typescript
const tokenId = 1;
const amount = 2; // Sell 2 tokens
const buyer = '0x8ba1f109551bD432803012645Hac136c4c4c4c4c';
const seller = await signer.getAddress();

const tx = await contract.sellToken(buyer, tokenId, amount, seller);
await tx.wait();
console.log(`Sold ${amount} tokens of ID ${tokenId}`);
```

### 3. ERC1155 Renting

#### Rent Tokens

```typescript
const tokenId = 1;
const duration = 86400; // 1 day
const rentalPrice = ethers.parseUnits('5', 6); // 5 USDC
const renter = '0x8ba1f109551bD432803012645Hac136c4c4c4c4c';
const tokenOwner = await signer.getAddress();

const tx = await contract.rentToken(tokenId, duration, rentalPrice, renter, tokenOwner);
await tx.wait();
console.log(`Rented tokens for ${renter}`);
```

## React Integration Examples

### 1. Minting Component

```jsx
import React, { useState } from 'react';
import { useContract, useContractWrite, useAccount } from 'wagmi';

function MintComponent({ contractAddress, contractABI }) {
	const [recipient, setRecipient] = useState('');
	const [price, setPrice] = useState('');
	const { address } = useAccount();

	const { write: mint, isLoading } = useContractWrite({
		address: contractAddress,
		abi: contractABI,
		functionName: 'mint',
		args: [recipient || address, ethers.parseUnits(price || '0', 6)],
	});

	const handleMint = () => {
		if (!recipient || !price) return;
		mint();
	};

	return (
		<div>
			<input type='text' placeholder='Recipient address' value={recipient} onChange={(e) => setRecipient(e.target.value)} />
			<input type='number' placeholder='Price (USDC)' value={price} onChange={(e) => setPrice(e.target.value)} />
			<button onClick={handleMint} disabled={isLoading}>
				{isLoading ? 'Minting...' : 'Mint Token'}
			</button>
		</div>
	);
}
```

### 2. Token Gallery Component

```jsx
import React, { useEffect, useState } from 'react';
import { useContract, useContractRead } from 'wagmi';

function TokenGallery({ contractAddress, contractABI, userAddress }) {
	const [tokens, setTokens] = useState([]);

	const { data: balance } = useContractRead({
		address: contractAddress,
		abi: contractABI,
		functionName: 'balanceOf',
		args: [userAddress],
	});

	useEffect(() => {
		if (balance) {
			// Fetch token details for each owned token
			const fetchTokens = async () => {
				const tokenPromises = [];
				for (let i = 0; i < balance; i++) {
					tokenPromises.push(contract.tokenOfOwnerByIndex(userAddress, i));
				}
				const tokenIds = await Promise.all(tokenPromises);
				setTokens(tokenIds);
			};
			fetchTokens();
		}
	}, [balance]);

	return (
		<div className='token-gallery'>
			{tokens.map((tokenId) => (
				<TokenCard key={tokenId} tokenId={tokenId} />
			))}
		</div>
	);
}
```

### 3. Rental Management Component

```jsx
import React, { useState, useEffect } from 'react';

function RentalManager({ contractAddress, contractABI, tokenId }) {
	const [rentalInfo, setRentalInfo] = useState(null);
	const [isRented, setIsRented] = useState(false);

	const { data: rentalData } = useContractRead({
		address: contractAddress,
		abi: contractABI,
		functionName: 'getRentalInfo',
		args: [tokenId],
	});

	const { data: rentedStatus } = useContractRead({
		address: contractAddress,
		abi: contractABI,
		functionName: 'isTokenRented',
		args: [tokenId],
	});

	useEffect(() => {
		if (rentalData) {
			setRentalInfo({
				renter: rentalData.renter,
				startTime: new Date(rentalData.startTime * 1000),
				endTime: new Date(rentalData.endTime * 1000),
				price: ethers.formatUnits(rentalData.price, 6),
			});
		}
		setIsRented(rentedStatus || false);
	}, [rentalData, rentedStatus]);

	return (
		<div className='rental-manager'>
			<h3>Rental Status</h3>
			{isRented ? (
				<div>
					<p>Rented by: {rentalInfo?.renter}</p>
					<p>Start: {rentalInfo?.startTime?.toLocaleString()}</p>
					<p>End: {rentalInfo?.endTime?.toLocaleString()}</p>
					<p>Price: {rentalInfo?.price} USDC</p>
				</div>
			) : (
				<p>Not currently rented</p>
			)}
		</div>
	);
}
```

## Error Handling Examples

### 1. Transaction Error Handling

```typescript
async function mintWithErrorHandling(recipient, price) {
	try {
		const tx = await contract.mint(recipient, price);
		const receipt = await tx.wait();
		console.log('Mint successful:', receipt.transactionHash);
		return receipt;
	} catch (error) {
		if (error.code === 'INSUFFICIENT_FUNDS') {
			console.error('Insufficient funds for transaction');
		} else if (error.message.includes('Recipient cannot be zero address')) {
			console.error('Invalid recipient address');
		} else if (error.message.includes('Price must be greater than 0')) {
			console.error('Invalid price amount');
		} else {
			console.error('Mint failed:', error.message);
		}
		throw error;
	}
}
```

### 2. Contract State Validation

```typescript
async function validateBeforeMint(recipient, price) {
	// Check if contract is paused
	const isPaused = await contract.paused();
	if (isPaused) {
		throw new Error('Contract is paused');
	}

	// Check if recipient is valid
	if (!ethers.isAddress(recipient)) {
		throw new Error('Invalid recipient address');
	}

	// Check if price is valid
	if (price <= 0) {
		throw new Error('Price must be greater than 0');
	}

	// Check if user has sufficient balance
	const balance = await paymentToken.balanceOf(await signer.getAddress());
	if (balance < price) {
		throw new Error('Insufficient payment token balance');
	}

	// Check allowance
	const allowance = await paymentToken.allowance(await signer.getAddress(), contractAddress);
	if (allowance < price) {
		throw new Error('Insufficient payment token allowance');
	}
}
```

## Gas Optimization Examples

### 1. Batch Operations

```typescript
// Instead of multiple individual mints
async function inefficientMinting(recipients, prices) {
	const txs = [];
	for (let i = 0; i < recipients.length; i++) {
		const tx = await contract.mint(recipients[i], prices[i]);
		txs.push(tx);
	}
	await Promise.all(txs);
}

// Use batch minting instead
async function efficientMinting(recipients, prices) {
	const tx = await contract.mintBatch(recipients, prices);
	await tx.wait();
}
```

### 2. Gas Estimation

```typescript
async function mintWithGasEstimation(recipient, price) {
	// Estimate gas first
	const gasEstimate = await contract.mint.estimateGas(recipient, price);

	// Add 20% buffer
	const gasLimit = gasEstimate.mul(120).div(100);

	// Execute with estimated gas
	const tx = await contract.mint(recipient, price, { gasLimit });
	await tx.wait();
}
```

## Testing Examples

### 1. Unit Test Example

```typescript
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('KAMI721C', function () {
	let contract;
	let owner;
	let user1;
	let user2;

	beforeEach(async function () {
		[owner, user1, user2] = await ethers.getSigners();

		const KAMI721C = await ethers.getContractFactory('KAMI721C');
		contract = await KAMI721C.deploy(
			'Test NFT',
			'TEST',
			'https://api.test.com/',
			paymentTokenAddress,
			ethers.parseUnits('100', 6),
			owner.address,
			500,
			owner.address
		);
	});

	it('Should mint token successfully', async function () {
		const price = ethers.parseUnits('100', 6);

		await contract.connect(user1).mint(user1.address, price);

		expect(await contract.ownerOf(0)).to.equal(user1.address);
		expect(await contract.tokenPrices(0)).to.equal(price);
	});

	it('Should sell token successfully', async function () {
		// First mint a token
		const price = ethers.parseUnits('100', 6);
		await contract.connect(user1).mint(user1.address, price);

		// Then sell it
		await contract.connect(user1).sellToken(user2.address, 0, user1.address);

		expect(await contract.ownerOf(0)).to.equal(user2.address);
	});
});
```

### 2. Integration Test Example

```typescript
describe('Complete Workflow', function () {
	it('Should handle complete mint-sell-rent workflow', async function () {
		// 1. Mint token
		const price = ethers.parseUnits('100', 6);
		await contract.connect(user1).mint(user1.address, price);

		// 2. Sell token
		await contract.connect(user1).sellToken(user2.address, 0, user1.address);

		// 3. Rent token
		const rentalPrice = ethers.parseUnits('10', 6);
		await contract.connect(user3).rentToken(0, 86400, rentalPrice, user3.address);

		// 4. Verify rental status
		expect(await contract.isTokenRented(0)).to.be.true;

		// 5. End rental
		await contract.connect(user3).endRental(0);

		// 6. Verify rental ended
		expect(await contract.isTokenRented(0)).to.be.false;
	});
});
```

These examples demonstrate the full range of functionality available in the KAMI NFT Contracts, from basic operations to advanced features and integration patterns.
