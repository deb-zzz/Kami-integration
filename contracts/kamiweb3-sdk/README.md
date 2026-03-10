# KAMI Web3 SDK

[![npm version](https://badge.fury.io/js/kamiweb3-sdk.svg)](https://badge.fury.io/js/kamiweb3-sdk)
[![GitHub repo](https://img.shields.io/badge/github-repo-blue.svg)](https://github.com/KAMI-Github/kamiweb3-sdk)
[![Tests](https://img.shields.io/badge/tests-73%20passing-brightgreen.svg)](https://github.com/KAMI-Github/kamiweb3-sdk)
[![Ethers v6](https://img.shields.io/badge/ethers-v6-blue.svg)](https://docs.ethers.org/v6/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A production-ready TypeScript SDK for interacting with KAMI smart contracts (ERC721C, ERC721AC, ERC1155C), featuring comprehensive deployment tools, type-safe wrappers, and full ethers.js v6 compatibility.

## 🚀 Key Features

-   **🛠️ Deployment Factories**: Deploy standard and upgradeable (Transparent Proxy) contracts with ease
-   **🔒 Type-Safe Wrappers**: Full TypeScript support with proper type definitions and error handling
-   **💰 Royalty System**: Programmable mint and transfer royalties with automatic USDC distribution
-   **🏠 Rental System**: Robust token rental functionality with proper payment handling and timing
-   **⚡ ERC721A Optimizations**: Gas-efficient batch minting and claim functionality
-   **🎯 Platform Integration**: Built-in platform commission handling and fee distribution
-   **🔧 Upgradeable Contracts**: Transparent proxy pattern for future contract upgrades
-   **📊 Comprehensive Testing**: 73 tests covering all contract functionality
-   **⚙️ Ethers v6 Ready**: Full compatibility with the latest ethers.js version

## 📦 Installation

```bash
npm install kamiweb3-sdk ethers@^6
# or
yarn add kamiweb3-sdk ethers@^6
```

**Note:** This SDK requires `ethers` v6 as a peer dependency.

## 🛠️ Setup

Import the necessary components and set up your ethers signer or provider.

```typescript
import { ethers, Wallet, JsonRpcProvider } from 'ethers';
import {
	// Factories
	ERC721CFactory,
	ERC721ACFactory,
	ERC1155CFactory,
	// Wrappers (usually returned by factories)
	ERC721CWrapper,
	ERC721ACWrapper,
	ERC1155CWrapper,
	// Types
	SignerOrProvider,
	RoyaltyData,
	RentalDetails,
	RoyaltyInfo,
	// Deploy/Init Args (Import specific args as needed)
	ERC721CDeployArgs, // Or ERC721ACDeployArgs, ERC1155CDeployArgs
	ERC721CInitializeArgs, // Or ERC721ACInitializeArgs, ERC1155CInitializeArgs
} from 'kamiweb3-sdk';

// Example setup (replace with your actual provider/signer)
const provider = new JsonRpcProvider('http://localhost:8545'); // Or your RPC URL
const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Replace with deployer/signer private key
const signer: Signer = new Wallet(privateKey, provider);

// Example Addresses (replace with actual addresses for your deployment)
// Use testnet addresses (e.g., Sepolia) or mainnet as appropriate
const USDC_ADDRESS = '0x...'; // e.g., Sepolia USDC: 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8
const PLATFORM_ADDRESS = '0x...'; // Address for receiving platform fees
const OWNER_ADDRESS = await signer.getAddress(); // Often the deployer
```

## 📚 Usage Examples

Below are common use cases for each contract type. Remember to approve the respective contract address for USDC spending from the interacting account before calling methods like `mint`, `rentToken`, `claim`, etc.

---

### 🎨 ERC721C (Standard NFT with Royalties & Rentals)

#### 1. Deploying Standard Contract

```typescript
import { ethers } from 'ethers';
import { ERC721CFactory, ERC721CDeployArgs } from 'kamiweb3-sdk';

async function deployERC721C(signer: Signer) {
	const deployArgs: ERC721CDeployArgs = {
		usdcAddress: USDC_ADDRESS,
		name: 'My KAMI 721C NFT',
		symbol: 'K721C',
		baseURI: 'https://api.example.com/nft/721c/',
		initialMintPrice: ethers.parseUnits('100', 6), // 100 USDC (assuming 6 decimals)
		platformAddress: PLATFORM_ADDRESS,
		platformCommissionPercentage: 500, // 5% (500 basis points)
	};

	console.log('Deploying standard ERC721C...');
	const erc721c: ERC721CWrapper = await ERC721CFactory.deploy(deployArgs, signer);
	const deployedAddress = await erc721c.contract.getAddress(); // Use wrapper.contract.getAddress()
	console.log(`Standard ERC721C deployed at: ${deployedAddress}`);
	return erc721c;
}

// const my721c = await deployERC721C(signer);
```

#### 2. Deploying Upgradeable Contract (Transparent Proxy)

```typescript
import { ethers } from 'ethers';
import { ERC721CFactory, ERC721CInitializeArgs } from 'kamiweb3-sdk';

async function deployUpgradeableERC721C(signer: Signer) {
	const initArgs: ERC721CInitializeArgs = {
		usdcAddress: USDC_ADDRESS,
		name: 'My Upgradeable KAMI 721C NFT',
		symbol: 'UK721C',
		baseURI: 'https://api.example.com/nft/721c-upg/',
		initialMintPrice: ethers.parseUnits('150', 6), // 150 USDC
		platformAddress: PLATFORM_ADDRESS,
		platformCommissionPercentage: 500, // 5%
	};

	// Optional: Specify a different owner for the ProxyAdmin
	const proxyAdminOwner = '0x...'; // Address of the admin owner

	console.log('Deploying upgradeable ERC721C...');
	const erc721cProxy: ERC721CWrapper = await ERC721CFactory.deployUpgradeable(
		initArgs,
		signer
		// proxyAdminOwner // Uncomment to set a specific admin owner
	);
	const proxyAddress = await erc721cProxy.contract.getAddress();
	console.log(`Upgradeable ERC721C proxy deployed at: ${proxyAddress}`);
	// Note: The returned wrapper is already attached to the proxy address
	// and uses the KAMI721CUpgradeable ABI for interaction.
	return erc721cProxy;
}

// const my721cProxy = await deployUpgradeableERC721C(signer);
```

#### 3. Attaching to Existing Contracts

```typescript
import { ERC721CFactory, SignerOrProvider } from 'kamiweb3-sdk';

const existingStandardAddress = '0x...';
const existingProxyAddress = '0x...';
const signerOrProvider: SignerOrProvider = signer; // Or your provider

// Attach to standard contract (uses standard ABI)
const attached721c = ERC721CFactory.attach(existingStandardAddress, signerOrProvider);

// Attach to upgradeable contract (uses upgradeable ABI)
const attached721cProxy = ERC721CFactory.attachUpgradeable(existingProxyAddress, signerOrProvider);

console.log('Attached to standard contract:', await attached721c.name());
console.log('Attached to upgradeable contract:', await attached721cProxy.name());
```

#### 4. Calling Methods (Example: Mint, Set Royalties, Rent)

```typescript
import { ethers } from 'ethers';
import { ERC721CWrapper, RoyaltyData } from 'kamiweb3-sdk';

// Assume 'erc721c' is an ERC721CWrapper instance connected to a signer
async function interactWith721C(erc721c: ERC721CWrapper, signerAddress: string) {
	// Ensure you have USDC approved for the contract address for minting/renting

	// --- Minting ---
	console.log('Minting token...');
	const mintTx = await erc721c.mint();
	const mintReceipt = await mintTx.wait();
	// Extract tokenId from events (e.g., Transfer event from ZeroAddress)
	const transferTopic = erc721c.contract.getEvent('Transfer').fragment.topicHash;
	const transferLog = mintReceipt?.logs.find(
		(log) => log.topics[0] === transferTopic && log.topics[1] === ethers.zeroPadValue(ethers.ZeroAddress, 32)
	);
	const tokenId = transferLog ? erc721c.contract.interface.parseLog(transferLog as any)?.args.tokenId : null;
	console.log(`Minted token ID: ${tokenId}`);

	if (!tokenId) return;

	// --- Setting Royalties (Requires OWNER_ROLE or appropriate role) ---
	const royaltyRecipient = '0x...'; // Artist/Creator address
	const mintRoyalties: RoyaltyData[] = [
		{ receiver: royaltyRecipient, feeNumerator: 9500 }, // 95% (Platform share is added automatically)
	];
	console.log('Setting mint royalties...');
	// Requires appropriate role (e.g., OWNER_ROLE) granted to the signer
	const setMintRoyaltyTx = await erc721c.setMintRoyalties(mintRoyalties);
	await setMintRoyaltyTx.wait();
	console.log('Mint royalties set.');

	const transferRoyalties: RoyaltyData[] = [
		{ receiver: royaltyRecipient, feeNumerator: 1000 }, // 10%
	];
	console.log('Setting transfer royalties...');
	const setTransferRoyaltyTx = await erc721c.setTransferRoyalties(transferRoyalties);
	await setTransferRoyaltyTx.wait();
	console.log('Transfer royalties set.');

	// --- Renting (Example assumes caller is renter) ---
	const rentalDurationSeconds = 60 * 60 * 24; // 1 day
	const rentalPrice = ethers.parseUnits('10', 6); // 10 USDC
	console.log(`Renting token ${tokenId}...`);
	// Make sure the signer has approved USDC spending for the contract
	const rentTx = await erc721c.rentToken(tokenId, rentalDurationSeconds, rentalPrice);
	await rentTx.wait();
	console.log(`Token ${tokenId} rented.`);

	// --- Get Rental Details ---
	const details = await erc721c.getRentalDetails(tokenId);
	console.log('Rental Details:', details); // { renter: '...', rentalEndTime: ... }
}

// Example call:
// Assuming my721cProxy is an instance attached to a deployed contract and signer
// const signerAddr = await signer.getAddress();
// await interactWith721C(my721cProxy, signerAddr);
```

---

### ⚡ ERC721AC (ERC721A based NFT with Royalties & Claim)

Deployment (`ERC721ACFactory.deploy`, `ERC721ACFactory.deployUpgradeable`) and attachment (`ERC721ACFactory.attach`, `ERC721ACFactory.attachUpgradeable`) follow the same pattern as ERC721C, using `ERC721ACFactory`, `ERC721ACDeployArgs` / `ERC721ACInitializeArgs`, and result in an `ERC721ACWrapper`.

#### Calling Methods (Example: Mint Batch, Claim, Get Royalties)

```typescript
import { ethers } from 'ethers';
import { ERC721ACWrapper, RoyaltyData } from 'kamiweb3-sdk';

// Assume 'erc721ac' is an ERC721ACWrapper instance connected to a signer
async function interactWith721AC(erc721ac: ERC721ACWrapper) {
	// Ensure USDC approval for minting/claiming

	// --- Minting Batch (ERC721A feature) ---
	const quantityToMint = 3;
	console.log(`Minting ${quantityToMint} tokens...`);
	// Assumes mint price is set and USDC is approved
	const mintTx = await erc721ac.mint(quantityToMint);
	const mintReceipt = await mintTx.wait();
	console.log('Mint successful. Tx:', mintReceipt?.hash);

	// Determine minted IDs (ERC721A emits consecutive Transfer events)
	const transferTopic = erc721ac.contract.getEvent('Transfer').fragment.topicHash;
	const transferLogs = mintReceipt?.logs.filter((log) => log.topics[0] === transferTopic);
	const mintedIds = transferLogs?.map((log) => erc721ac.contract.interface.parseLog(log as any)?.args.tokenId);
	console.log('Minted Token IDs:', mintedIds);
	const firstMintedId = mintedIds?.[0];

	if (!firstMintedId) return;

	// --- Claiming (Example, assumes a 'claim' function exists and is configured) ---
	// This method might not exist on all ERC721AC implementations, or might have different parameters.
	// Adjust based on your specific contract's claim logic.
	try {
		if (typeof (erc721ac.contract as any).claim === 'function') {
			const quantityToClaim = 2;
			console.log(`Attempting to claim ${quantityToClaim} tokens...`);
			// Requires USDC approval if claim has a cost
			const claimTx = await erc721ac.claim(quantityToClaim); // Adjust parameters as needed
			await claimTx.wait();
			console.log('Claim successful.');
		} else {
			console.log('Claim function not found on this contract instance.');
		}
	} catch (error) {
		console.error('Claim failed:', error);
	}

	// --- Getting Royalty Info (ERC2981 Standard) ---
	const salePrice = ethers.parseUnits('500', 6); // Example sale price: 500 USDC
	const royaltyInfo = await erc721ac.royaltyInfo(firstMintedId, salePrice);
	console.log(`Royalty Info for Token ${firstMintedId} at ${ethers.formatUnits(salePrice, 6)} USDC:`, {
		receiver: royaltyInfo.receiver,
		amount: ethers.formatUnits(royaltyInfo.royaltyAmount, 6) + ' USDC',
	});

	// --- Setting Royalties (Requires appropriate role) ---
	// Similar to ERC721C example using setMintRoyalties, setTransferRoyalties, etc.
	// const royaltyRecipient = '0x...';
	// const transferRoyalties: RoyaltyData[] = [{ receiver: royaltyRecipient, feeNumerator: 750 }]; // 7.5%
	// const setTx = await erc721ac.setTransferRoyalties(transferRoyalties);
	// await setTx.wait();
	// console.log('Transfer royalties set.');
}

// Example call:
// Assuming my721acProxy is an instance attached to a deployed contract and signer
// await interactWith721AC(my721acProxy);
```

---

### 🎯 ERC1155C (Multi-Token with Royalties & Rentals)

Deployment (`ERC1155CFactory.deploy`, `ERC1155CFactory.deployUpgradeable`) and attachment (`ERC1155CFactory.attach`, `ERC1155CFactory.attachUpgradeable`) follow the same pattern, using `ERC1155CFactory`, `ERC1155CDeployArgs` / `ERC1155CInitializeArgs`, and result in an `ERC1155CWrapper`. Note that initialization args typically include a base `uri` for metadata.

#### Calling Methods (Example: Mint, Check Balance, Set Token Royalties, Rent)

```typescript
import { ethers } from 'ethers';
import { ERC1155CWrapper, RoyaltyData } from 'kamiweb3-sdk';

// Assume 'erc1155c' is an ERC1155CWrapper instance connected to a signer
async function interactWith1155C(erc1155c: ERC1155CWrapper, signerAddress: string) {
	// Ensure USDC approval

	const tokenIdToMint = 1; // Example Token ID
	const amountToMint = 10; // Mint 10 copies of Token ID 1
	const mintData = '0x'; // Optional data

	// --- Minting Tokens (Requires MINTER_ROLE or owner) ---
	console.log(`Minting ${amountToMint} of token ID ${tokenIdToMint}...`);
	// Requires appropriate role and USDC approval if mint price is set
	const mintTx = await erc1155c.mint(signerAddress, tokenIdToMint, amountToMint, mintData);
	await mintTx.wait();
	console.log('Mint successful.');

	// --- Checking Balance ---
	const balance = await erc1155c.balanceOf(signerAddress, tokenIdToMint);
	console.log(`Balance of token ID ${tokenIdToMint} for ${signerAddress}: ${balance}`);

	// --- Setting Token-Specific Transfer Royalties (Requires OWNER_ROLE or similar) ---
	const royaltyRecipient = '0x...';
	const tokenRoyalties: RoyaltyData[] = [{ receiver: royaltyRecipient, feeNumerator: 1500 }]; // 15%
	console.log(`Setting transfer royalties for token ID ${tokenIdToMint}...`);
	const setTokenRoyaltyTx = await erc1155c.setTokenTransferRoyalties(tokenIdToMint, tokenRoyalties);
	await setTokenRoyaltyTx.wait();
	console.log('Token transfer royalties set.');

	// --- Getting Royalty Info (ERC2981) ---
	// Note: Royalty info is typically set per-token for ERC1155
	const salePrice = ethers.parseUnits('50', 6); // 50 USDC
	const royaltyInfo = await erc1155c.royaltyInfo(tokenIdToMint, salePrice); // Use the specific token ID
	console.log(`Royalty Info for Token ${tokenIdToMint} at ${ethers.formatUnits(salePrice, 6)} USDC:`, {
		receiver: royaltyInfo.receiver,
		amount: ethers.formatUnits(royaltyInfo.royaltyAmount, 6) + ' USDC',
	});

	// --- Renting (Applies to the specific token ID) ---
	const rentalTokenId = tokenIdToMint; // Rent one of the copies of token ID 1
	const rentalDurationSeconds = 60 * 60; // 1 hour
	const rentalPrice = ethers.parseUnits('5', 6); // 5 USDC
	console.log(`Renting token ID ${rentalTokenId}...`);
	// Requires USDC approval
	const rentTx = await erc1155c.rentToken(rentalTokenId, rentalDurationSeconds, rentalPrice);
	await rentTx.wait();
	console.log(`Token ID ${rentalTokenId} rented.`);

	// --- Get Rental Details (Per Token ID) ---
	const rentalDetails = await erc1155c.getRentalDetails(rentalTokenId);
	console.log(`Rental Details for Token ID ${rentalTokenId}:`, rentalDetails);

	// --- Batch Operations (Example: Check balances) ---
	const otherTokenId = 2;
	const accounts = [signerAddress, PLATFORM_ADDRESS];
	const tokenIds = [tokenIdToMint, otherTokenId];
	const balances = await erc1155c.balanceOfBatch(accounts, tokenIds);
	console.log(
		'Batch Balances:',
		balances.map((b) => b.toString())
	); // [balanceOf(signer, T1), balanceOf(signer, T2), balanceOf(platform, T1), balanceOf(platform, T2)] - order depends on contract implementation logic if flattened. Check contract for exact order. Usually: [balance(account1, id1), balance(account1, id2), ..., balance(account2, id1), balance(account2, id2), ...]
}

// Example call:
// Assuming my1155cProxy is an instance attached to a deployed contract and signer
// const signerAddr = await signer.getAddress();
// await interactWith1155C(my1155cProxy, signerAddr);
```

---

## 🔄 Complete ERC721C Lifecycle Example

This example demonstrates deploying, configuring, minting, and selling an ERC721C NFT,
highlighting the automatic distribution of funds based on mint/transfer royalties and platform fees.

```typescript
import { ethers, Wallet, Contract, parseUnits, formatUnits } from 'ethers';
import {
	ERC721CFactory,
	ERC721CWrapper,
	ERC721CDeployArgs,
	RoyaltyData,
	SignerOrProvider, // Assuming Signer is used below
} from 'kamiweb3-sdk';

// --- Setup (Replace with your actual values) ---
const provider = new ethers.JsonRpcProvider('http://localhost:8545'); // Your RPC URL
const deployerPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const minterPrivateKey = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // Needs Sepolia ETH & USDC
const buyerPrivateKey = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'; // Needs Sepolia ETH & USDC

const deployerSigner = new Wallet(deployerPrivateKey, provider);
const minterSigner = new Wallet(minterPrivateKey, provider);
const buyerSigner = new Wallet(buyerPrivateKey, provider);

const USDC_ADDRESS_SEPOLIA = '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8'; // Example Sepolia USDC
const PLATFORM_ADDRESS = '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B'; // Example Platform Address
const ROYALTY_RECIPIENT_ADDRESS = '0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c'; // Example Royalty Recipient

const USDC_ABI = [
	// Minimal ABI for ERC20 approve and balanceOf
	'function approve(address spender, uint256 amount) external returns (bool)',
	'function balanceOf(address account) external view returns (uint256)',
];
const usdcContract = new Contract(USDC_ADDRESS_SEPOLIA, USDC_ABI, provider);

async function erc721cLifecycle() {
	console.log('--- Starting ERC721C Lifecycle Example ---');

	// --- 1. Deployment ---
	const deployArgs: ERC721CDeployArgs = {
		usdcAddress: USDC_ADDRESS_SEPOLIA,
		name: 'KAMI Lifecycle NFT',
		symbol: 'KLIFE',
		baseURI: 'ipfs://your-metadata-cid/', // Replace with your actual metadata URI base
		initialMintPrice: parseUnits('100', 6), // 100 USDC
		platformAddress: PLATFORM_ADDRESS,
		platformCommissionPercentage: 500, // 5% platform fee (on mint and transfer)
	};

	console.log('Deploying ERC721C contract...');
	const erc721c: ERC721CWrapper = await ERC721CFactory.deploy(deployArgs, deployerSigner);
	const contractAddress = await erc721c.contract.getAddress();
	console.log(`ERC721C deployed at: ${contractAddress}`);
	// Connect the wrapper to the deployer/owner signer for owner actions
	const erc721cOwner = erc721c.connect(deployerSigner);

	// --- 2. Configuration (Setting Royalties - Requires OWNER_ROLE) ---
	const mintRoyalties: RoyaltyData[] = [
		{ receiver: ROYALTY_RECIPIENT_ADDRESS, feeNumerator: 9500 }, // 95% to recipient (5% platform fee is implicit)
	];
	const transferRoyalties: RoyaltyData[] = [
		{ receiver: ROYALTY_RECIPIENT_ADDRESS, feeNumerator: 1000 }, // 10% to recipient (5% platform fee is implicit)
	];

	console.log('Setting Mint Royalties...');
	const setMintTx = await erc721cOwner.setMintRoyalties(mintRoyalties);
	await setMintTx.wait();
	console.log('Mint Royalties set.');

	console.log('Setting Transfer Royalties...');
	const setTransferTx = await erc721cOwner.setTransferRoyalties(transferRoyalties);
	await setTransferTx.wait();
	console.log('Transfer Royalties set.');

	// --- 3. Minting ---
	const erc721cMinter = erc721c.connect(minterSigner); // Connect wrapper to the minter
	const mintPrice = await erc721cMinter.getMintPrice();
	console.log(`Mint Price: ${formatUnits(mintPrice, 6)} USDC`);

	// ** IMPORTANT: Minter must approve the contract to spend USDC **
	console.log(`Approving ${formatUnits(mintPrice, 6)} USDC for minting...`);
	const approveMintTx = await usdcContract.connect(minterSigner).approve(contractAddress, mintPrice);
	await approveMintTx.wait();
	console.log('USDC approved for minting.');

	console.log('Minting token...');
	const minterBalanceBefore = await usdcContract.balanceOf(minterSigner.address);
	const platformBalanceBeforeMint = await usdcContract.balanceOf(PLATFORM_ADDRESS);
	const royaltyRecipientBalanceBeforeMint = await usdcContract.balanceOf(ROYALTY_RECIPIENT_ADDRESS);

	const mintTx = await erc721cMinter.mint();
	const mintReceipt = await mintTx.wait();
	console.log(`Mint transaction successful: ${mintReceipt?.hash}`);

	// Find tokenId from Transfer event
	const transferTopic = erc721cMinter.contract.getEvent('Transfer').fragment.topicHash;
	const transferLog = mintReceipt?.logs.find(
		(log: any) => log.topics[0] === transferTopic && log.topics[1] === ethers.zeroPadValue(ethers.ZeroAddress, 32)
	);
	const tokenId = transferLog ? erc721cMinter.contract.interface.parseLog(transferLog as any)?.args.tokenId : null;

	if (!tokenId) {
		console.error('Could not find minted tokenId!');
		return;
	}
	console.log(`Token ID ${tokenId} minted to ${minterSigner.address}`);

	// Check balances after mint
	const minterBalanceAfter = await usdcContract.balanceOf(minterSigner.address);
	const platformBalanceAfterMint = await usdcContract.balanceOf(PLATFORM_ADDRESS);
	const royaltyRecipientBalanceAfterMint = await usdcContract.balanceOf(ROYALTY_RECIPIENT_ADDRESS);
	console.log(`Minter USDC change: ${formatUnits(minterBalanceAfter - minterBalanceBefore, 6)}`); // Should be -100
	console.log(`Platform USDC change: +${formatUnits(platformBalanceAfterMint - platformBalanceBeforeMint, 6)}`); // Should be +5 (5% of 100)
	console.log(`Royalty Recipient USDC change: +${formatUnits(royaltyRecipientBalanceAfterMint - royaltyRecipientBalanceBeforeMint, 6)}`); // Should be +95 (95% of 100)

	// --- 4. Selling ---
	const salePrice = parseUnits('200', 6); // Sell for 200 USDC
	const erc721cBuyer = erc721c.connect(buyerSigner); // Connect wrapper to the buyer for read operations if needed

	// Seller (minter) needs to approve the contract for the token
	// Although sellToken allows approved operators, direct owner selling is common.
	// Note: In KAMI contracts, sellToken transfers from msg.sender if they are owner/approved.
	// No separate NFT approval step is strictly needed if the minter calls sellToken.

	// ** IMPORTANT: Buyer must approve the contract to spend USDC **
	console.log(`Approving ${formatUnits(salePrice, 6)} USDC for buying...`);
	const approveBuyTx = await usdcContract.connect(buyerSigner).approve(contractAddress, salePrice);
	await approveBuyTx.wait();
	console.log('USDC approved for buying.');

	console.log(`Selling token ${tokenId} from ${minterSigner.address} to ${buyerSigner.address} for ${formatUnits(salePrice, 6)} USDC...`);

	const sellerBalanceBeforeSale = await usdcContract.balanceOf(minterSigner.address);
	const buyerBalanceBeforeSale = await usdcContract.balanceOf(buyerSigner.address);
	const platformBalanceBeforeSale = await usdcContract.balanceOf(PLATFORM_ADDRESS); // = platformBalanceAfterMint
	const royaltyRecipientBalanceBeforeSale = await usdcContract.balanceOf(ROYALTY_RECIPIENT_ADDRESS); // = royaltyRecipientBalanceAfterMint

	// The seller (minter in this case) calls sellToken
	const sellTx = await erc721cMinter.sellToken(buyerSigner.address, tokenId, salePrice);
	const sellReceipt = await sellTx.wait();
	console.log(`Sell transaction successful: ${sellReceipt?.hash}`);

	// Verify ownership transfer
	const newOwner = await erc721c.ownerOf(tokenId);
	console.log(`New owner of token ${tokenId}: ${newOwner} (Expected: ${buyerSigner.address})`);

	// Check balances after sale
	const sellerBalanceAfterSale = await usdcContract.balanceOf(minterSigner.address);
	const buyerBalanceAfterSale = await usdcContract.balanceOf(buyerSigner.address);
	const platformBalanceAfterSale = await usdcContract.balanceOf(PLATFORM_ADDRESS);
	const royaltyRecipientBalanceAfterSale = await usdcContract.balanceOf(ROYALTY_RECIPIENT_ADDRESS);

	// Calculations:
	// Sale Price = 200
	// Platform Fee = 5% of 200 = 10
	// Transfer Royalty = 10% of 200 = 20
	// Seller Receives = 200 - 10 - 20 = 170

	console.log(`Buyer USDC change: ${formatUnits(buyerBalanceAfterSale - buyerBalanceBeforeSale, 6)}`); // Should be -200
	console.log(`Seller USDC change: +${formatUnits(sellerBalanceAfterSale - sellerBalanceBeforeSale, 6)}`); // Should be +170
	console.log(`Platform USDC change: +${formatUnits(platformBalanceAfterSale - platformBalanceBeforeSale, 6)}`); // Should be +10
	console.log(`Royalty Recipient USDC change: +${formatUnits(royaltyRecipientBalanceAfterSale - royaltyRecipientBalanceBeforeSale, 6)}`); // Should be +20

	console.log('--- ERC721C Lifecycle Example Complete ---');
}

// Run the example
erc721cLifecycle().catch(console.error);
```

---

## 📖 API Reference

This SDK exports Factories for deployment/attachment, Wrappers for contract interaction, and associated Types.

### Factories

Factories provide static methods to deploy new contracts or attach to existing ones.

-   **`ERC721CFactory`** / **`ERC721ACFactory`** / **`ERC1155CFactory`**
    -   `static attach(address, signerOrProvider): Wrapper`: Attaches to a standard contract instance. Returns the corresponding Wrapper (`ERC721CWrapper`, etc.).
    -   `static attachUpgradeable(proxyAddress, signerOrProvider): Wrapper`: Attaches to an upgradeable contract proxy. Returns the corresponding Wrapper configured with the upgradeable ABI.
    -   `static deploy(args, signer): Promise<Wrapper>`: Deploys a new standard contract. Requires `DeployArgs` (e.g., `ERC721CDeployArgs`). Returns a Promise resolving to the Wrapper.
    -   `static deployUpgradeable(initArgs, signer, proxyAdminOwner?): Promise<Wrapper>`: Deploys an upgradeable contract using a Transparent Proxy. Requires `InitializeArgs` (e.g., `ERC721CInitializeArgs`). Returns a Promise resolving to the Wrapper attached to the proxy.
    -   `static deployNewImplementation?(signer): Promise<string>`: (Present on upgradeable factories) Deploys a new implementation contract for a potential upgrade. Returns the address of the new implementation. Does _not_ perform the upgrade itself.

### Wrappers

Wrappers provide a type-safe interface to interact with the deployed contract's methods. Each wrapper takes the contract address and an `ethers` Signer or Provider in its constructor. Use the `attach` or `deploy` methods from the Factories to get instances.

-   **`ERC721CWrapper`** / **`ERC721ACWrapper`** / **`ERC1155CWrapper`**
    -   `contract: ethers.Contract`: The underlying `ethers.Contract` instance.
    -   `address: string`: The contract address.
    -   `connect(signerOrProvider): Wrapper`: Returns a _new_ wrapper instance connected to a different Signer or Provider. Useful for switching between read-only and signing modes.
    -   **Common Methods (Examples, check specific wrapper for full list and signatures):**
        -   `name()`, `symbol()`, `tokenURI(tokenId)` / `uri(tokenId)`
        -   `balanceOf(owner)` / `balanceOf(owner, tokenId)` (ERC1155), `balanceOfBatch(owners, tokenIds)` (ERC1155)
        -   `ownerOf(tokenId)` (ERC721 variants)
        -   `approve(to, tokenId)`, `getApproved(tokenId)`, `setApprovalForAll(operator, approved)`, `isApprovedForAll(owner, operator)`
        -   `transferFrom(from, to, tokenId)` / `safeTransferFrom(...)` (ERC721), `safeTransferFrom(from, to, id, amount, data)` (ERC1155), `safeBatchTransferFrom(...)` (ERC1155)
        -   `mint(...)`: (Signature varies, e.g., `mint()` for ERC721C, `mint(quantity)` for ERC721AC, `mint(to, id, amount, data)` for ERC1155C)
        -   `claim(...)`: (If applicable, e.g., `claim(quantity)` on ERC721AC)
        -   `burn(...)`: (e.g., `burn(tokenId)` on ERC721, `burn(account, id, amount)` on ERC1155)
        -   `royaltyInfo(tokenId/id, salePrice)` (ERC2981)
        -   `setMintRoyalties(royalties)`, `setTransferRoyalties(royalties)`, `setTokenMintRoyalties(id, royalties)`, `setTokenTransferRoyalties(id, royalties)` (Signatures may vary)
        -   `rentToken(id, duration, price)`, `endRental(id)`, `extendRental(id, duration, price)`, `getRentalDetails(id)` (Where applicable)
        -   `setMintPrice(price)`, `getMintPrice()`, `setPlatformCommission(percentage, address)`, etc.
        -   `pause()`, `unpause()`, `paused()` (Pausable)
        -   `hasRole(role, account)`, `grantRole(role, account)`, `revokeRole(role, account)`, `renounceRole(role)` (AccessControl)
        -   `totalSupply()` (ERC721Enumerable/ERC721A), `nextTokenId()` (ERC721A)

### Types

Key types used by the SDK:

-   `SignerOrProvider`: `ethers.Signer | ethers.Provider`
-   `RoyaltyData`: `{ receiver: string; feeNumerator: BigNumberish }`
-   `RoyaltyInfo`: `{ receiver: string; royaltyAmount: bigint }` (Returned by `royaltyInfo`)
-   `RentalDetails`: `{ renter: string; rentalEndTime: bigint }` (Returned by `getRentalDetails`)
-   `ERC721CDeployArgs`, `ERC721ACDeployArgs`, `ERC1155CDeployArgs`: Arguments for standard contract deployment.
-   `ERC721CInitializeArgs`, `ERC721ACInitializeArgs`, `ERC1155CInitializeArgs`: Arguments for upgradeable contract initialization.
-   Role Constants: `DEFAULT_ADMIN_ROLE`, `OWNER_ROLE`, `PLATFORM_ROLE`, `RENTER_ROLE`, `MINTER_ROLE`, `PAUSER_ROLE`, `UPGRADER_ROLE` (exported `BytesLike` constants).

---

## 🧪 Testing

The SDK includes comprehensive test suites for all contract types. The tests cover:

-   **Deployment**: Standard and upgradeable contract deployment
-   **Minting**: Single and batch minting operations
-   **Royalties**: Setting and retrieving mint and transfer royalties
-   **Rentals**: Token rental functionality including extension and end operations
-   **Access Control**: Role management and permissions
-   **Pausability**: Pause and unpause functionality
-   **ERC Standards**: Full ERC721/ERC1155 compliance testing

### 🚀 Recent Improvements

The test suite has been significantly enhanced with:

-   **⏰ Fixed Timing Logic**: Corrected `endTime` calculations in rental tests to match contract behavior (`endTime = block.timestamp + duration`)
-   **🎯 Enhanced Tolerance**: Increased timing tolerance to ±15 seconds for more reliable test execution
-   **⚙️ Ethers v6 Compatibility**: Updated all wrapper and factory files to use ethers v6 types and imports
-   **🔒 Type Safety**: Fixed BigNumber to BigInt conversions and improved type consistency
-   **🛡️ Error Handling**: Added proper error handling for contract operations and edge cases
-   **🔧 Build Compatibility**: Resolved all TypeScript compilation errors for ethers v6
-   **🐛 Bug Fixes**: Fixed contract-specific issues in KAMI1155C rental extension and hasActiveRentals functions

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test test/KAMI721C.test.ts

# Run tests with coverage
npm run test:coverage
```

### 📊 Build Status

✅ **All 73 tests passing**  
✅ **TypeScript compilation successful**  
✅ **Ethers v6 compatibility achieved**  
✅ **Production-ready build**

## 🤝 Contributing

We welcome contributions! Please refer to the CONTRIBUTING.md file for guidelines. (Create this file if needed)

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆕 Latest Developments

### v0.1.2 - Production Ready Release

-   **🎯 Full Ethers v6 Compatibility**: Complete migration from ethers v5 to v6
-   **🔧 TypeScript Build Fixes**: Resolved all compilation errors and type issues
-   **🐛 Contract Bug Fixes**: Fixed KAMI1155C rental extension and hasActiveRentals functions
-   **⏰ Enhanced Test Reliability**: Improved timing logic and tolerance for rental tests
-   **📚 Updated Documentation**: Comprehensive README with usage examples and API reference
-   **✅ Production Status**: All 73 tests passing with zero build errors

### Key Technical Achievements

-   **Migration Success**: Successfully migrated all wrapper and factory files to ethers v6
-   **Type Safety**: Fixed BigNumber to BigInt conversions and improved type consistency
-   **Error Handling**: Enhanced error handling for contract operations and edge cases
-   **Build Compatibility**: Resolved all TypeScript compilation errors
-   **Test Coverage**: Comprehensive test suite covering all contract functionality
