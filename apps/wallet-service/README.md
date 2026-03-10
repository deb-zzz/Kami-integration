# KAMI Platform Wallet Service

A production-ready TypeScript Node.js API service for managing multi-chain wallet balances and ERC-20 token transfers using EthersJS and Prisma.

## Features 

-   **Multi-chain Support** - Support for multiple blockchain networks via chainId parameter
-   **Blockchain Information** - Get detailed blockchain and payment token information from database
-   **Enhanced Token Data** - Comprehensive token transfer analysis with ERC20/ERC721/ERC1155 support
-   **ERC-20 Token Operations** - Get wallet balances for ETH and any ERC-20 tokens (including USDC)
-   **Standard Transfers** - Transfer ERC-20 tokens between wallets with gas fees
-   **Real-time Gas Estimation** - Accurate gas estimation for standard transactions
-   **Transaction History** - Complete transaction details with formatted values and token data
-   **Transaction Summary** - Complete transaction summary with transaction and order details
-   **Database Integration** - Full Prisma ORM integration with PostgreSQL
-   **Production Security** - Rate limiting, input sanitization, security headers, and comprehensive error handling
-   **Health Monitoring** - Built-in health checks and service monitoring
-   **TypeScript Support** - Full type safety throughout the application
-   **Docker Support** - Production-ready containerization with multi-stage builds
-   **Comprehensive Testing** - Extensive test suite covering all functionality

## Prerequisites

-   Node.js (v18 or higher)
-   pnpm package manager
-   PostgreSQL database
-   Ethereum RPC URL (Infura, Alchemy, or custom)
-   Docker (optional, for containerized deployment)

## Installation

1. Install dependencies:

```bash
pnpm install
```

2. Create environment file:

```bash
cp env.example .env
```

3. Configure your `.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/kami_platform"

# Security Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,https://yourdomain.com
JWT_SECRET=your-super-secret-jwt-key-here
API_KEY=your-api-key-here
```

4. Set up the database:

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations (if needed)
npx prisma db push
```

5. Build the application:

```bash
# Build TypeScript
pnpm run build
```

## Usage

### Development

```bash
pnpm run dev
```

### Production

```bash
pnpm run build
pnpm start
```

### Watch Mode

```bash
pnpm run dev:watch
```

## Docker Deployment

### Production Docker Build

```bash
# Build production image with multi-stage build
docker build -f Dockerfile.production -t kami-wallet-service:production .
```

**Features:**

-   Multi-stage build for optimized image size
-   Automatic Prisma client generation
-   Production-ready security configuration
-   Health check integration

### Run with Docker

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://username:password@host:5432/kami_platform" \
  -e NODE_ENV="production" \
  kami-wallet-service:production
```

### Run with Environment File

```bash
docker run -p 3000:3000 --env-file .env kami-wallet-service:production
```

## API Endpoints

### Health Check

```
GET /health
```

### Get Wallet Balances

```
GET /api/balances/:chainId?address=0x...
```

**Parameters:**

-   `chainId` (path parameter): Blockchain chain ID (e.g., "0x14a34" for Base Sepolia)
-   `address` (query parameter): Ethereum wallet address

**Response:**

```json
{
	"success": true,
	"data": {
		"address": "0x...",
		"ethBalance": "1000000000000000000",
		"usdcBalance": "1000000000",
		"ethBalanceFormatted": "1.0",
		"usdcBalanceFormatted": "1000.0"
	},
	"message": "Wallet balances retrieved successfully"
}
```

**Note:** This endpoint returns balances for ETH and USDC. For other ERC-20 tokens, use the specific token balance endpoint.

### Get ERC-20 Token Contract Info

```
GET /api/balances/:chainId/usdc-info
```

**Parameters:**

-   `chainId` (path parameter): Blockchain chain ID

**Response:**

```json
{
	"success": true,
	"data": {
		"symbol": "USDC",
		"decimals": "6",
		"contractAddress": "0x...",
		"name": "USD Coin"
	},
	"message": "ERC-20 token contract info retrieved successfully"
}
```

**Note:** This endpoint currently returns USDC contract info. The service supports any ERC-20 token configured in the database.

### Get Blockchain Information

```
GET /api/blockchain/:chainId
```

**Parameters:**

-   `chainId` (path parameter): Blockchain chain ID

**Response:**

```json
{
	"success": true,
	"data": {
		"chainId": "0x14a34",
		"name": "BASE SEPOLIA",
		"logoUrl": null,
		"rpcUrl": "https://sepolia.base.org",
		"paymentTokens": [
			{
				"id": 1,
				"chainId": "0x14a34",
				"contractAddress": "0x5dEaC602762362FE5f135FA5904351916053cF70",
				"name": "USD Coin",
				"symbol": "USDC",
				"decimals": 6,
				"logoUrl": null
			}
		]
	},
	"message": "Blockchain information retrieved successfully"
}

### Transfer ERC-20 Tokens

```

POST /api/transfer/:chainId/usdc
Content-Type: application/json

{
"fromAddress": "0x...",
"toAddress": "0x...",
"amount": "100.0"
}

````

**Parameters:**

-   `chainId` (path): Blockchain chain ID
-   `fromAddress` (body): Sender wallet address
-   `toAddress` (body): Recipient wallet address
-   `amount` (body): Token amount to transfer

**Note:** Private keys are managed through the database and retrieved automatically based on the `fromAddress` and `chainId`. This endpoint currently supports USDC transfers, but the service architecture supports any ERC-20 token configured in the database.

**Response:**

```json
{
	"success": true,
	"data": {
		"hash": "0x...",
		"from": "0x...",
		"to": "0x...",
		"value": "0",
		"valueFormatted": "0.0",
		"gasLimit": "100000",
		"gasPrice": "20000000000",
		"gasUsed": "65000",
		"blockNumber": 12345678,
		"blockHash": "0x...",
		"transactionIndex": 5,
		"status": 1,
		"nonce": 42,
		"data": "0xa9059cbb..."
	},
	"message": "ERC-20 token transfer completed successfully"
}
````

### Estimate Gas

```
POST /api/transfer/:chainId/estimate-gas
Content-Type: application/json

{
  "fromAddress": "0x...",
  "toAddress": "0x...",
  "amount": "100.0"
}
```

### Get Transaction Details

```
GET /api/transactions/:chainId/transaction/:txHash
```

**Parameters:**

-   `chainId` (path): Blockchain chain ID
-   `txHash` (path): Transaction hash

**Response:**

```json
{
	"success": true,
	"data": {
		"hash": "0x...",
		"from": "0x...",
		"to": "0x...",
		"value": "0",
		"valueFormatted": "0.0",
		"gasLimit": "100000",
		"gasPrice": "20000000000",
		"gasUsed": "65000",
		"blockNumber": 12345678,
		"blockHash": "0x...",
		"transactionIndex": 5,
		"status": 1,
		"nonce": 42,
		"data": "0xa9059cbb..."
	},
	"message": "Transaction details retrieved successfully"
}
```

### Get All Wallet Transactions

```
GET /api/transactions/:chainId?walletAddress=0x...
```

**Parameters:**

-   `chainId` (path): Blockchain chain ID
-   `walletAddress` (query): Wallet address to get transactions for

**Response:**

```json
{
	"success": true,
	"data": [
		{
			"hash": "0x...",
			"chainId": "0x14a34",
			"from": "0x...",
			"to": "0x...",
			"value": "0",
			"valueFormatted": "0.0",
			"gasLimit": "100000",
			"gasPrice": "20000000000",
			"gasUsed": "65000",
			"blockNumber": 12345678,
			"blockHash": "0x...",
			"transactionIndex": 5,
			"status": 1,
			"nonce": 42,
			"data": "0xa9059cbb...",
			"timestamp": "1703123456789",
			"tokenData": [
				{
					"contractAddress": "0x5dEaC602762362FE5f135FA5904351916053cF70",
					"tokenType": "ERC20",
					"tokenSymbol": "USDC",
					"tokenDecimals": 6,
					"tokenName": "USD Coin",
					"fromAddress": "0x...",
					"toAddress": "0x...",
					"tokenAmount": "1000000000",
					"tokenAmountFormatted": "1000.0",
					"batch": false
				}
			]
		}
	],
	"message": "Wallet transactions retrieved successfully"
}
```

### Get Transaction Summary

```
GET /api/transactions/:chainId/transaction/:txHash/summary
```

**Parameters:**

-   `chainId` (path): Blockchain chain ID
-   `txHash` (path): Transaction hash

**Response:**

```json
{
	"success": true,
	"data": {
		"transaction": {
			"hash": "0x...",
			"chainId": "0x14a34",
			"from": "0x...",
			"to": "0x...",
			"value": "0",
			"valueFormatted": "0.0",
			"gasLimit": "100000",
			"gasPrice": "20000000000",
			"gasUsed": "65000",
			"blockNumber": 12345678,
			"blockHash": "0x...",
			"transactionIndex": 5,
			"status": 1,
			"nonce": 42,
			"data": "0xa9059cbb..."
		},
		"checkout": null
	},
	"message": "Transaction summary retrieved successfully"
}
```

## Enhanced Features

### Complete Transaction Response

The ERC-20 token transfer endpoints return comprehensive transaction details including:

-   **Transaction Hash**: Unique identifier for the transaction
-   **Addresses**: From and to wallet addresses
-   **Value Information**: Both raw and formatted values
-   **Gas Details**: Limit, price, and actual gas used (for standard transfers)
-   **Block Information**: Block number, hash, and transaction index
-   **Status**: Transaction success/failure status
-   **Metadata**: Nonce and raw transaction data

### Enhanced Token Data Analysis

The wallet transactions endpoint includes comprehensive token transfer analysis:

-   **Multi-Token Support**: ERC20, ERC721, and ERC1155 token transfers
-   **Token Metadata**: Symbol, name, decimals, and contract address
-   **Transfer Details**: From/to addresses, amounts, and token IDs
-   **Batch Support**: Handles batch transfers for ERC1155 tokens
-   **Formatted Values**: Human-readable token amounts with proper decimal formatting

### Database-Driven Configuration

All blockchain and token information is managed through the database:

-   **Dynamic Configuration**: Blockchain and token data loaded from database
-   **Multi-Chain Support**: Easy addition of new blockchains and tokens
-   **Payment Token Management**: Comprehensive token metadata storage
-   **Chain Validation**: Automatic validation of supported chains

### Multi-Token ERC-20 Support

The service supports any ERC-20 token configured in the database:

-   **Dynamic Token Loading**: Token contracts and metadata loaded from database
-   **Flexible Token Configuration**: Add new ERC-20 tokens without code changes
-   **Token Metadata**: Symbol, name, decimals, and contract address from database
-   **Universal Transfer Logic**: Same transfer logic works for any ERC-20 token
-   **Balance Checking**: Pre-transfer balance validation for any ERC-20 token
-   **Gas Estimation**: Accurate gas estimation for any ERC-20 token transfer

### Production Security Features

Enterprise-grade security and monitoring:

-   **Rate Limiting**: Configurable rate limits for different endpoints
-   **Input Sanitization**: Comprehensive input validation and sanitization
-   **Security Headers**: Helmet.js integration for security headers
-   **CORS Configuration**: Configurable cross-origin resource sharing
-   **Request Logging**: Detailed API request logging and monitoring
-   **Error Handling**: Comprehensive error handling and reporting

### Real-time Gas Estimation

Advanced gas estimation for standard transactions:

-   **Standard Transfers**: Accurate gas estimation for regular ERC-20 token transfers
-   **Contract Interaction**: Proper gas estimation for ERC-20 contract calls

### Health Monitoring

Comprehensive health monitoring and status reporting:

-   **Service Health**: Overall service status monitoring
-   **RPC Health**: Blockchain RPC endpoint monitoring
-   **Database Health**: Database connectivity monitoring

## Request Validation

All API endpoints use Zod for request validation:

### Balance Endpoint Validation

-   `address`: Must be a valid Ethereum address (0x followed by 40 hex characters)

### Transfer Endpoint Validation

-   `fromAddress`: Must be a valid Ethereum address
-   `toAddress`: Must be a valid Ethereum address
-   `amount`: Must be a positive number string
-   `privateKey`: Must be a valid private key (64 hex characters with or without 0x prefix)

### Validation Error Response

When validation fails, endpoints return detailed error information:

```json
{
	"success": false,
	"error": "VALIDATION_ERROR",
	"message": "Request validation failed",
	"details": [
		{
			"field": "address",
			"message": "Invalid wallet address format"
		}
	]
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
	"success": false,
	"error": "ERROR_CODE",
	"message": "Human readable error message"
}
```

## Security Notes

-   Never commit private keys to version control
-   Use environment variables for sensitive configuration
-   Consider implementing proper authentication for production use
-   Validate all input parameters
-   Use HTTPS in production

## Testing

The project includes a comprehensive test suite located in the `test/` directory.

### Run All Tests

```bash
pnpm test
```

### Run Individual Test Suites

```bash
# Basic API functionality
pnpm run test:api

# Input validation tests
pnpm run test:validation

# Transaction details tests
pnpm run test:transaction

# Wallet transactions tests
pnpm run test:transactions

# Gas estimation tests
pnpm run test:gas

# Blockchain information tests
pnpm run test:blockchain

# Enhanced USDC info tests
pnpm run test:usdc-info

# Enhanced transactions with token data tests
pnpm run test:enhanced-transactions
```

### Test Prerequisites

1. Start the server: `PORT=3001 pnpm run dev`
2. Ensure `.env` file is configured with required environment variables

See `test/README.md` for detailed test documentation.

## Development

The project uses modern technologies and best practices:

### Core Technologies

-   **TypeScript** for type safety and developer experience
-   **Express.js** for the web framework and API routing
-   **EthersJS v6** for blockchain interactions and smart contract calls
-   **Prisma ORM** for database operations and type-safe queries
-   **PostgreSQL** for data persistence and blockchain configuration

### Security & Validation

-   **Zod** for request validation and schema validation
-   **Helmet.js** for security headers and protection
-   **express-rate-limit** for rate limiting and DDoS protection
-   **Input sanitization** for XSS and injection prevention

### Development Tools

-   **pnpm** for fast and efficient package management
-   **Docker** for containerization and deployment
-   **ts-node** for TypeScript development execution
-   **Comprehensive testing** with axios and custom test suites

### Production Features

-   **Multi-stage Docker builds** for optimized production images
-   **Health monitoring** and service status reporting
-   **Request logging** and API monitoring
-   **Error handling** and comprehensive error responses
-   **Rate limiting** and security middleware

## License

MIT
