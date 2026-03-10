# KamiPaymaster

A Solidity smart contract implementation of an Account Abstraction Paymaster that sponsors gas fees for allowlisted users. Built with Hardhat and ethers v6.

## Features

### 🔐 **Access Control**

-   Owner-only allowlist management
-   Secure address whitelisting/blacklisting
-   Event emission for allowlist changes

### 💰 **Gas Sponsorship**

-   ETH deposit functionality for gas coverage
-   Integration with EntryPoint for gas payment
-   Support for any depositor (not just owner)

### ✅ **User Validation**

-   Allowlist-based user validation
-   Rejection of non-allowlisted users
-   Integration with Account Abstraction UserOperations

### 🧪 **Comprehensive Testing**

-   14 test cases covering all functionality
-   Mock EntryPoint for isolated testing
-   Access control validation
-   Error handling verification

## Contract Overview

The `KamiPaymaster` contract implements the `IPaymaster` interface from Account Abstraction, providing:

-   **Gas Sponsorship**: Pays gas fees for allowlisted users
-   **Allowlist Management**: Owner can add/remove users from allowlist
-   **Deposit Management**: Accepts ETH deposits to fund gas payments
-   **User Validation**: Validates UserOperations before execution

## Usage Examples

### 1. Deployment

```javascript
const { ethers } = require('hardhat');

async function deployPaymaster() {
	const [owner] = await ethers.getSigners();

	// Deploy EntryPoint (or use existing address)
	const EntryPoint = await ethers.getContractFactory('EntryPoint');
	const entryPoint = await EntryPoint.deploy();

	// Deploy KamiPaymaster
	const KamiPaymaster = await ethers.getContractFactory('KamiPaymaster');
	const paymaster = await KamiPaymaster.deploy(await entryPoint.getAddress());

	console.log('Paymaster deployed to:', await paymaster.getAddress());
}
```

### 2. Managing Allowlist

```javascript
// Add user to allowlist (owner only)
await paymaster.setAllowlistAddress(userAddress, true);

// Remove user from allowlist (owner only)
await paymaster.setAllowlistAddress(userAddress, false);

// Check if user is allowlisted
const isAllowlisted = await paymaster.isAllowlisted(userAddress);
```

### 3. Depositing ETH for Gas

```javascript
// Owner deposits ETH for gas sponsorship
await paymaster.deposit({ value: ethers.parseEther('1.0') });

// Anyone can deposit ETH
await paymaster.connect(anyone).deposit({ value: ethers.parseEther('0.5') });
```

### 4. UserOperation Validation

```javascript
const userOp = {
	sender: allowlistedUserAddress,
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

// This will succeed for allowlisted users
const [context, validationData] = await paymaster.validatePaymasterUserOp(userOp, userOpHash, maxCost);
```

## API Reference

### Functions

#### `deposit()`

-   **Description**: Deposits ETH to fund gas payments
-   **Access**: Public
-   **Parameters**: None (sends ETH as value)
-   **Events**: `DepositTo` (emitted by EntryPoint)

#### `setAllowlistAddress(address user, bool isAllowlisted)`

-   **Description**: Adds or removes user from allowlist
-   **Access**: Owner only
-   **Parameters**:
    -   `user`: Address to modify
    -   `isAllowlisted`: true to add, false to remove
-   **Events**: `AllowlistUpdated(address indexed user, bool isAllowlisted)`

#### `validatePaymasterUserOp(UserOperation userOp, bytes32 userOpHash, uint256 maxCost)`

-   **Description**: Validates if paymaster will sponsor the user operation
-   **Access**: External (called by EntryPoint)
-   **Returns**: `(bytes memory context, uint256 validationData)`
-   **Reverts**: If user is not allowlisted

#### `postOp(PostOpMode mode, bytes context, uint256 actualGasCost)`

-   **Description**: Called after user operation execution
-   **Access**: External (called by EntryPoint)
-   **Parameters**:
    -   `mode`: Operation mode (succeeded/reverted)
    -   `context`: Context from validation
    -   `actualGasCost`: Actual gas cost incurred

### Events

```solidity
event AllowlistUpdated(address indexed user, bool isAllowlisted);
```

## Getting Started

### Prerequisites

-   Node.js (v16 or later)
-   pnpm package manager

### Installation

1. Install dependencies:

```bash
pnpm install
```

### Available Scripts

-   `pnpm compile` - Compile the smart contracts
-   `pnpm test` - Run the test suite (14 tests)
-   `pnpm deploy` - Deploy contracts to the local network
-   `pnpm node` - Start a local Hardhat network
-   `pnpm clean` - Clean the cache and artifacts

### Project Structure

```
├── contracts/
│   ├── paymaster.sol        # Main KamiPaymaster contract
│   └── MockEntryPoint.sol   # Mock contract for testing
├── scripts/                 # Deployment and utility scripts
├── test/
│   └── KamiPaymaster.test.js # Comprehensive test suite
├── hardhat.config.js        # Hardhat configuration
└── package.json             # Project dependencies
```

### Development

1. Start a local Hardhat network:

```bash
pnpm node
```

2. In another terminal, compile and deploy:

```bash
pnpm compile
pnpm deploy
```

3. Run tests:

```bash
pnpm test
```

## Testing

The project includes a comprehensive test suite with 14 test cases:

-   **Deployment Tests**: Constructor initialization and setup
-   **Deposit Tests**: ETH deposit functionality and tracking
-   **Allowlist Tests**: User management and access control
-   **Validation Tests**: UserOperation validation logic
-   **Access Control Tests**: Owner-only function protection

Run tests with:

```bash
pnpm test
```

## Dependencies

-   **Hardhat**: Development framework
-   **ethers v6**: Ethereum library
-   **@account-abstraction/contracts**: Account Abstraction interfaces
-   **@nomicfoundation/hardhat-toolbox**: Hardhat plugins
-   **@nomicfoundation/hardhat-chai-matchers**: Testing utilities

## License

MIT
