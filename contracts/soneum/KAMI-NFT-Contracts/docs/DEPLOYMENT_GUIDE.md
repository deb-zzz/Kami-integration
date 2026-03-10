# Deployment Guide

## Prerequisites

### Environment Setup

```bash
# Install Node.js (v18 or higher)
node --version

# Install pnpm
npm install -g pnpm

# Install dependencies
pnpm install
```

### Required Environment Variables

Create a `.env` file in the project root:

```env
# Network Configuration
RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
PRIVATE_KEY=your_private_key_here

# Etherscan API (for verification)
ETHERSCAN_API_KEY=your_etherscan_api_key

# Gas Configuration
GAS_PRICE=20000000000  # 20 gwei
GAS_LIMIT=8000000

# Contract Addresses (for upgrades)
PROXY_ADMIN_ADDRESS=0x...
IMPLEMENTATION_ADDRESS=0x...
```

## Network Configuration

### Hardhat Configuration

The project supports multiple networks. Configure in `hardhat.config.ts`:

```typescript
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const config: HardhatUserConfig = {
	solidity: {
		version: '0.8.24',
		settings: {
			optimizer: {
				enabled: true,
				runs: 200,
			},
		},
	},
	networks: {
		mainnet: {
			url: process.env.RPC_URL,
			accounts: [process.env.PRIVATE_KEY!],
			gasPrice: 20000000000,
		},
		sepolia: {
			url: process.env.SEPOLIA_RPC_URL,
			accounts: [process.env.PRIVATE_KEY!],
		},
		polygon: {
			url: process.env.POLYGON_RPC_URL,
			accounts: [process.env.PRIVATE_KEY!],
		},
	},
	etherscan: {
		apiKey: process.env.ETHERSCAN_API_KEY,
	},
};
```

## Deployment Scripts

### 1. Basic Deployment

#### Deploy ERC721 Contract

```bash
# Deploy KAMI721C
npx hardhat run scripts/deploy.ts --network mainnet

# Deploy KAMI721CUpgradeable
npx hardhat run scripts/deploy_upgradeable.ts --network mainnet
```

#### Deploy ERC1155 Contract

```bash
# Deploy KAMI1155C
npx hardhat run scripts/deploy_1155.ts --network mainnet

# Deploy KAMI1155CUpgradeable
npx hardhat run scripts/deploy_1155_upgradeable.ts --network mainnet
```

### 2. Custom Deployment Script

Create a custom deployment script:

```typescript
// scripts/deploy_custom.ts
import { ethers } from 'hardhat';

async function main() {
	const [deployer] = await ethers.getSigners();
	console.log('Deploying contracts with account:', deployer.address);

	// Deploy payment token (if needed)
	const MockERC20 = await ethers.getContractFactory('MockERC20');
	const paymentToken = await MockERC20.deploy('USD Coin', 'USDC', 6);
	await paymentToken.waitForDeployment();
	console.log('Payment token deployed to:', await paymentToken.getAddress());

	// Deploy KAMI721AC
	const KAMI721AC = await ethers.getContractFactory('KAMI721AC');
	const kami721 = await KAMI721AC.deploy(
		await paymentToken.getAddress(), // payment token
		'KAMI NFT Collection', // name
		'KAMI', // symbol
		'https://api.kami.com/metadata/', // baseURI
		deployer.address, // platform address
		500, // 5% commission
		deployer.address, // admin address
		0, // total supply (0 = unlimited)
		ethers.parseUnits('100', 6) // initial mint price: 100 USDC
	);
	await kami721.waitForDeployment();
	console.log('KAMI721AC deployed to:', await kami721.getAddress());

	// Verify contracts
	await hre.run('verify:verify', {
		address: await kami721.getAddress(),
		constructorArguments: [
			await paymentToken.getAddress(),
			'KAMI NFT Collection',
			'KAMI',
			'https://api.kami.com/metadata/',
			deployer.address,
			500,
			deployer.address,
		],
	});
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
```

### 3. Upgradeable Deployment

#### Deploy with UUPS Proxy

```typescript
// scripts/deploy_upgradeable.ts
import { ethers, upgrades } from 'hardhat';

async function main() {
	const [deployer] = await ethers.getSigners();

	// Deploy implementation
	const KAMI721CUpgradeable = await ethers.getContractFactory('KAMI721CUpgradeable');

	const kami721 = await upgrades.deployProxy(
		KAMI721ACUpgradable,
		[
			paymentTokenAddress,
			'KAMI NFT Collection',
			'KAMI',
			'https://api.kami.com/metadata/',
			platformAddress,
			500, // 5% commission
			deployer.address, // admin address
			0, // total supply (0 = unlimited)
			ethers.parseUnits('100', 6), // initial mint price: 100 USDC
		],
		{ kind: 'uups' }
	);

	await kami721.waitForDeployment();
	console.log('KAMI721CUpgradeable deployed to:', await kami721.getAddress());
}
```

## Contract Initialization

### Post-Deployment Setup

```typescript
// scripts/initialize.ts
import { ethers } from 'hardhat';

async function main() {
	const contract = await ethers.getContractAt('KAMI721C', contractAddress);

	// Set up roles
	const OWNER_ROLE = await contract.OWNER_ROLE();
	const PLATFORM_ROLE = await contract.PLATFORM_ROLE();

	// Grant platform role
	await contract.grantRole(PLATFORM_ROLE, platformAddress);

	// Set royalty percentage
	await contract.setRoyaltyPercentage(1000); // 10%

	// Set platform commission
	await contract.setPlatformCommission(500); // 5%

	console.log('Contract initialized successfully');
}
```

## Verification

### Automatic Verification

```bash
# Verify during deployment
npx hardhat run scripts/deploy.ts --network mainnet --verify

# Verify existing contract
npx hardhat verify --network mainnet CONTRACT_ADDRESS "arg1" "arg2" "arg3"
```

### Manual Verification

1. Go to [Etherscan](https://etherscan.io)
2. Navigate to your contract address
3. Click "Contract" tab
4. Click "Verify and Publish"
5. Fill in contract details and source code

## Gas Optimization

### Compiler Settings

```typescript
// hardhat.config.ts
solidity: {
  version: "0.8.24",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200 // Optimize for deployment cost
    }
  }
}
```

### Deployment Optimization

-   Use `--gas-price` flag for manual gas price setting
-   Monitor gas usage during deployment
-   Consider using gas estimation tools

```bash
# Deploy with custom gas price
npx hardhat run scripts/deploy.ts --network mainnet --gas-price 20000000000
```

## Multi-Network Deployment

### Deploy to Multiple Networks

```bash
# Deploy to testnet first
npx hardhat run scripts/deploy.ts --network sepolia

# Deploy to mainnet
npx hardhat run scripts/deploy.ts --network mainnet

# Deploy to Polygon
npx hardhat run scripts/deploy.ts --network polygon
```

### Network-Specific Configuration

```typescript
// scripts/deploy_multi.ts
const networks = ['sepolia', 'mainnet', 'polygon'];

for (const network of networks) {
	console.log(`Deploying to ${network}...`);
	await hre.run('run', { script: 'scripts/deploy.ts', network });
}
```

## Upgrade Process

### 1. Deploy New Implementation

```typescript
// scripts/upgrade.ts
import { ethers, upgrades } from 'hardhat';

async function main() {
	const KAMI721CUpgradeableV2 = await ethers.getContractFactory('KAMI721CUpgradeableV2');

	const upgraded = await upgrades.upgradeProxy(proxyAddress, KAMI721CUpgradeableV2);

	console.log('Contract upgraded to:', await upgraded.getAddress());
}
```

### 2. Verify Upgrade

```typescript
// Check implementation address
const implementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);
console.log('New implementation:', implementation);

// Verify new implementation
await hre.run('verify:verify', {
	address: implementation,
	constructorArguments: [],
});
```

## Security Considerations

### Pre-Deployment Checklist

-   [ ] All tests passing
-   [ ] Gas optimization applied
-   [ ] Access controls properly configured
-   [ ] Initial parameters validated
-   [ ] Emergency pause functionality tested
-   [ ] Upgrade authorization set correctly

### Post-Deployment Verification

-   [ ] Contract verified on Etherscan
-   [ ] All functions working correctly
-   [ ] Access controls functioning
-   [ ] Emergency procedures tested
-   [ ] Monitoring systems in place

## Monitoring and Maintenance

### Contract Monitoring

```typescript
// scripts/monitor.ts
import { ethers } from 'hardhat';

async function monitor() {
	const contract = await ethers.getContractAt('KAMI721C', contractAddress);

	// Check contract state
	const isPaused = await contract.paused();
	const totalSupply = await contract.totalSupply();
	const platformCommission = await contract.platformCommission();

	console.log('Contract Status:');
	console.log('- Paused:', isPaused);
	console.log('- Total Supply:', totalSupply.toString());
	console.log('- Platform Commission:', platformCommission.toString());
}
```

### Event Monitoring

```typescript
// Monitor important events
contract.on('TokenMinted', (to, tokenId, amount, price) => {
	console.log(`Token ${tokenId} minted to ${to} for ${price}`);
});

contract.on('TokenSold', (seller, buyer, tokenId, amount, price) => {
	console.log(`Token ${tokenId} sold from ${seller} to ${buyer} for ${price}`);
});
```

## Troubleshooting

### Common Issues

#### Deployment Fails

-   Check gas limit and price
-   Verify network connectivity
-   Ensure sufficient ETH balance
-   Check constructor parameters

#### Verification Fails

-   Ensure source code matches exactly
-   Check constructor arguments order
-   Verify compiler version
-   Check optimization settings

#### Upgrade Fails

-   Verify UPGRADER_ROLE is granted
-   Check new implementation is compatible
-   Ensure proxy is UUPS type
-   Verify upgrade authorization

### Debug Commands

```bash
# Check deployment status
npx hardhat run scripts/check_deployment.ts --network mainnet

# Test contract functions
npx hardhat run scripts/test_contract.ts --network mainnet

# Check gas usage
REPORT_GAS=true npx hardhat test
```

## Best Practices

### Security

-   Use multi-sig wallets for important operations
-   Implement proper access controls
-   Regular security audits
-   Emergency response procedures

### Gas Optimization

-   Use libraries for shared functionality
-   Optimize storage layout
-   Batch operations when possible
-   Monitor gas usage patterns

### Maintenance

-   Regular contract monitoring
-   Event log analysis
-   Performance metrics tracking
-   User feedback collection

### Documentation

-   Keep deployment records
-   Document configuration changes
-   Maintain upgrade history
-   User guide updates
