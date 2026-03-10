# KAMI Sigils API

A TypeScript ExpressJS application for deploying and interacting with the KamiSigils ERC1155 smart contract on Base Sepolia testnet using viem.

## Features

-   Deploy KamiSigils ERC1155 contract
-   Mint tokens (owner only)
-   Set token URIs (owner only)
-   Query token URIs
-   Get total supply for each token ID
-   Get balance for any address and token ID
-   Referral system with leaderboard tracking
-   User sigil management and creation
-   Comprehensive test suites (Hardhat for Solidity, Jest for TypeScript)
-   Sample metadata files for all 6 token types

## Prerequisites

### For Local Development

-   Node.js 18+ and pnpm (or npm)
-   A wallet with Base Sepolia testnet ETH for deployment and transactions
-   PostgreSQL database (for referrals features)

### For Docker Builds

-   Docker 20.10+ with Buildx support
-   For multi-platform builds: Docker Buildx (included in Docker Desktop or Docker Engine 19.03+)

## Installation

1. Install dependencies:

```bash
pnpm install
# or
npm install
```

2. Compile the smart contract:

```bash
pnpm run compile
# or
npm run compile
```

3. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

4. Update `.env` with your configuration:

```env
ENCRYPTION_KEY=your_64_character_hex_encryption_key_here
RPC_URL=https://sepolia.base.org
PORT=3000
CONTRACT_ADDRESS=
DATABASE_URL=your_database_url_here
REFERRAL_POINTS=100
POINTS_ALL_USED=100
```

**Environment Variables:**

-   `ENCRYPTION_KEY` - 32-byte hex string (64 hex characters) for encrypting/decrypting private keys (required)
    - Generate with: `openssl rand -hex 32`
    - **Never commit this to version control**
-   `DATABASE_URL` - PostgreSQL connection string (required)
-   `RPC_URL` - Ethereum RPC endpoint (required)
-   `PORT` - Server port (default: 3000)
-   `CONTRACT_ADDRESS` - Default contract address (optional, can be passed per request)
-   `REFERRAL_POINTS` - Points awarded per referral (default: 100)
-   `POINTS_ALL_USED` - Bonus points when all referral codes are used (default: 100)
-   `PRIVATE_KEY` - (Deprecated) Encrypted private key value (fallback only, with warning)
-   `AWS_SECRET_NAME` - (Optional) AWS Secrets Manager secret name for encrypted private key (fallback)

5. Set up the database:

```bash
cd kami-platform-v1-schema
npx prisma generate
npx prisma migrate dev
```

This will create the `quest_pk` table for secure private key storage.

6. Generate encryption key and store your private key securely:

```bash
# Generate a 32-byte encryption key (64 hex characters)
openssl rand -hex 32

# Add the output to your .env file as ENCRYPTION_KEY

# Encrypt and store your private key in the database
# Replace 84532 with your chain ID (Base Sepolia = 84532, Base = 8453)
ts-node scripts/encrypt-key.ts 84532 0x_your_private_key_here
```

**Chain ID Reference:**
- Base Sepolia: `84532`
- Base: `8453`
- Soneium: Check viem/chains for actual ID
- Soneium Minato: Check viem/chains for actual ID

**Note:** The project uses pnpm with approved build scripts for native modules (`@prisma/client`, `@prisma/engines`, `keccak`, `prisma`, `secp256k1`). This configuration is defined in `package.json` under `pnpm.onlyBuiltDependencies` and ensures these packages can run their build scripts during installation.

## Usage

### Development Server

The referrals routes are already mounted in `src/server.ts` and available at `/api/referrals`.

Start the development server:

```bash
pnpm run dev
# or
npm run dev
```

The server will start on `http://localhost:3000` (or the port specified in `.env`).

**Development Features:**

-   Hot reload with `ts-node` for instant code changes
-   TypeScript compilation on-the-fly
-   Detailed error messages in development mode
-   Access to all API endpoints at `/api/referrals` and `/api/sigils`

### Production Build

#### Building the Application

1. **Install dependencies:**

```bash
pnpm install --frozen-lockfile
# or
npm ci
```

2. **Generate Prisma Client:**

```bash
cd kami-platform-v1-schema
npx prisma generate
cd ..
```

3. **Compile TypeScript:**

```bash
pnpm run build
# or
npm run build
```

This creates a `dist/` directory with compiled JavaScript files.

4. **Run database migrations (if needed):**

```bash
cd kami-platform-v1-schema
npx prisma migrate deploy
cd ..
```

#### Starting the Production Server

```bash
pnpm start
# or
npm start
```

**Production Considerations:**

-   Ensure all environment variables are set correctly
-   Database connection pooling is recommended for high traffic
-   Use a process manager like PM2 for production deployments
-   Set `NODE_ENV=production` for optimized performance
-   Configure reverse proxy (nginx, Caddy) for HTTPS and load balancing

#### Production Deployment Checklist

-   [ ] All environment variables configured
-   [ ] Database migrations applied
-   [ ] Prisma client generated
-   [ ] TypeScript compiled successfully
-   [ ] Health check endpoint accessible (`/health`)
-   [ ] Database connection tested
-   [ ] RPC endpoint accessible and authenticated
-   [ ] Private key secured (use secret management)
-   [ ] Logging configured
-   [ ] Monitoring and alerting set up

## API Endpoints

The API is organized into three main sections:

-   **Health Check** (`/health`) - Server status
-   **Sigils** (`/api/sigils`) - Contract deployment and interactions (6 endpoints)
-   **Referrals** (`/api/referrals`) - Referral management and sigil creation (14 endpoints)

### Health Check

-   `GET /health` - Check server status
    ```json
    {
    	"status": "ok",
    	"timestamp": "2024-01-01T00:00:00.000Z"
    }
    ```

### Sigils Routes (`/api/sigils`)

#### Contract Deployment

-   `POST /api/sigils/deploy` - Deploy a new KamiSigils contract instance
    ```json
    {
    	"initialUri": "https://example.com/metadata/{id}.json"
    }
    ```
    Response:
    ```json
    {
    	"success": true,
    	"data": {
    		"address": "0x..."
    	}
    }
    ```

#### Contract Interactions

All contract interaction endpoints support an optional `contractAddress` query parameter. If not provided, the `CONTRACT_ADDRESS` from `.env` will be used.

-   `GET /api/sigils/uri/:tokenId` - Get URI for a specific token ID (1-6)

    -   Optional query parameter: `contractAddress` - Contract address (uses env var if not provided)
    -   Example: `GET /api/sigils/uri/1?contractAddress=0x...`
        Response:

    ```json
    {
    	"success": true,
    	"data": {
    		"uri": "https://example.com/metadata/1.json"
    	}
    }
    ```

-   `POST /api/sigils/set-token-uri` - Set token URI (owner only)

    ```json
    {
    	"tokenId": 1,
    	"newUri": "https://example.com/metadata/1.json"
    }
    ```

    Response:

    ```json
    {
    	"success": true,
    	"data": {
    		"txHash": "0x..."
    	}
    }
    ```

-   `POST /api/sigils/mint` - Mint tokens to a recipient (owner only)

    ```json
    {
    	"tokenId": 1,
    	"amount": 10,
    	"recipient": "0x1234567890123456789012345678901234567890"
    }
    ```

    Response:

    ```json
    {
    	"success": true,
    	"data": {
    		"txHash": "0x..."
    	}
    }
    ```

-   `GET /api/sigils/total-supply/:tokenId` - Get total supply for a token ID (1-6)
    Response:

    ```json
    {
    	"success": true,
    	"data": {
    		"totalSupply": "100"
    	}
    }
    ```

-   `GET /api/sigils/balance/:owner/:tokenId` - Get balance for an owner and token ID
    Response:
    ```json
    {
    	"success": true,
    	"data": {
    		"balance": "5"
    	}
    }
    ```

### Referrals Routes (`/api/referrals`)

The referral system allows users to earn points by sharing referral codes. When someone uses a referral code, both the referrer and referee can earn points. Users can eventually earn sigil NFTs based on their referral points.

#### Referral System Workflow

1. **Referral Codes**: Users have referral codes stored in the database that can be shared
2. **Using a Code**: When someone uses a referral code via `POST /api/referrals/referral`, the code is marked as used and points are awarded
3. **Points System**:
    - Default: 100 points per referral (configurable via `REFERRAL_POINTS`)
    - Bonus: 100 points when all codes are used (configurable via `POINTS_ALL_USED`)
4. **Sigils**: Users can create sigil NFTs once they meet certain criteria

#### Referral Management

-   `POST /api/referrals/referral` - Use a referral code to create a referral entry

    ```json
    {
    	"code": "REF123",
    	"source": "twitter"
    }
    ```

    **Note:** The referral code must exist in the database and not be already used. The wallet address is automatically determined from the referral code. Points are awarded automatically (default: 100 points per referral, configurable via `REFERRAL_POINTS` env var). If all referral codes for a user are used, additional bonus points are awarded (default: 100 points, configurable via `POINTS_ALL_USED` env var).

    Response:

    ```json
    {
    	"referral": {
    		"walletAddress": "0x...",
    		"code": "REF123",
    		"source": "twitter",
    		"createdAt": 1234567890
    	}
    }
    ```

    Error responses:

    -   `400` - Code and source are required
    -   `400` - Referral code not found
    -   `400` - Code is already used

-   `GET /api/referrals/referralCodes?walletAddress=0x...` - Get all referral codes for a user
    Response:

    ```json
    {
    	"referralCodes": [
    		{
    			"code": "REF123",
    			"walletAddress": "0x...",
    			"used": false,
    			"createdAt": 1234567890
    		}
    	]
    }
    ```

-   `GET /api/referrals/referrals?walletAddress=0x...` - Get all referrals for a user
    Response:

    ```json
    {
    	"referrals": [
    		{
    			"walletAddress": "0x...",
    			"code": "REF123",
    			"source": "twitter",
    			"createdAt": 1234567890
    		}
    	]
    }
    ```

-   `GET /api/referrals/referrals/source?source=twitter` - Get referrals filtered by source
    Response:

    ```json
    {
    	"referrals": [
    		{
    			"walletAddress": "0x...",
    			"code": "REF123",
    			"source": "twitter",
    			"createdAt": 1234567890
    		}
    	]
    }
    ```

-   `GET /api/referrals/leaderboard?offset=0&limit=10` - Get referral leaderboard (pagination optional)
    Query parameters:

    -   `offset` (optional) - Number of records to skip (default: 0)
    -   `limit` (optional) - Maximum number of records to return

    Response:

    ```json
    {
    	"leaderboard": [
    		{
    			"walletAddress": "0x...",
    			"userName": "user123",
    			"referralPoints": 150
    		}
    	]
    }
    ```

-   `GET /api/referrals/userReferralPoints?walletAddress=0x...` - Get user referral points and details
    Response:

    ```json
    {
    	"walletAddress": "0x...",
    	"userName": "user123",
    	"referralPoints": 150,
    	"sigilTokenId": 1
    }
    ```

    **Note:** `sigilTokenId` will be `null` if the user doesn't have a sigil yet.

-   `GET /api/referrals/sigil?walletAddress=0x...` - Get user sigil URI (metadata URL)
    Response:

    ```json
    {
    	"sigil": "https://www.kamiunlimited.com/sigils/1.json"
    }
    ```

    Error responses:

    -   `400` - User does not have a sigil
    -   `500` - Failed to fetch URI for sigil

-   `POST /api/referrals/createSigil` - Create a sigil NFT for a user

    ```json
    {
    	"walletAddress": "0x1234567890123456789012345678901234567890",
    	"tokenId": 1
    }
    ```

    **Note:**

    -   Token ID must be between 1 and 6
    -   User must not already have a sigil
    -   This endpoint mints the NFT and sets the token URI automatically

    Response:

    ```json
    {
    	"success": true,
    	"sigil": {
    		"metadataUrl": "https://www.kamiunlimited.com/sigils/1.json",
    		"type": 1
    	}
    }
    ```

    Error responses:

    -   `400` - Wallet address is required
    -   `400` - Token ID must be between 1 and 6
    -   `400` - User already has a sigil
    -   `500` - Failed to mint sigil

-   `POST /api/referrals/addReferralPoints` - Manually add referral points to a user

    ```json
    {
    	"walletAddress": "0x1234567890123456789012345678901234567890",
    	"pointsToAdd": 50
    }
    ```

    **Note:** Points must be greater than 0

    Response:

    ```json
    {
    	"success": true,
    	"totalPoints": 250
    }
    ```

    Error responses:

    -   `400` - Wallet address is required
    -   `400` - Points to add are required and must be greater than 0
    -   `500` - Failed to add referral points

-   `POST /api/referrals/setReferralCodeAsUnused` - Mark a referral code as unused

    ```json
    {
    	"code": "REF123",
    	"force": false
    }
    ```

    **Note:**

    -   `force` (optional, default: `false`) - If `true`, will delete existing referrals associated with the code before marking it as unused
    -   If the code has referrals and `force` is `false`, the request will fail

    Response:

    ```json
    {
    	"success": true
    }
    ```

    Error responses:

    -   `400` - Code is required
    -   `400` - Code already has referrals (when `force` is `false`)
    -   `500` - Failed to set referral code as unused

-   `POST /api/referrals/addReferralLinks` - Add referral links to the database

    ```json
    {
    	"walletAddress": "0x1234567890123456789012345678901234567890",
    	"links": ["https://kami.com/ref/ABC123", "https://kami.com/ref/XYZ789"],
    	"sources": ["twitter", "discord"]
    }
    ```

    **Note:**

    -   `links` - Array of referral link URLs (required)
    -   `sources` - Optional array of sources corresponding to each link (must be same length as `links` if provided)
    -   All links must be unique (not already exist in database)

    Response:

    ```json
    {
    	"success": true
    }
    ```

    Error responses:

    -   `400` - Wallet address is required
    -   `400` - Links are required
    -   `400` - Some links already exist (includes `existingLinks` array in response)
    -   `400` - If provided, sources must be an array of the same length as links

-   `GET /api/referrals/referralLinks?walletAddress=0x...` - Get referral links for a user

    Query parameters:

    -   `walletAddress` (required) - The wallet address to query referral links for
    -   `full` (optional, boolean) - If `true`, returns full Prisma payload with all fields. If `false` or omitted, returns simplified format with just `link` and `source`

    Response (simplified format, default):

    ```json
    {
    	"success": true,
    	"referralLinks": [
    		{
    			"link": "https://kami.com/ref/ABC123",
    			"source": "twitter"
    		},
    		{
    			"link": "https://kami.com/ref/XYZ789",
    			"source": "discord"
    		}
    	]
    }
    ```

    Response (full format, when `full=true`):

    ```json
    {
    	"success": true,
    	"referralLinks": [
    		{
    			"id": 1,
    			"walletAddress": "0x...",
    			"link": "https://kami.com/ref/ABC123",
    			"source": "twitter",
    			"createdAt": "2024-01-01T00:00:00.000Z"
    		}
    	]
    }
    ```

    Error responses:

    -   `400` - Wallet address is required
    -   `500` - Failed to get referral links

-   `PUT /api/referrals/updateReferralLinkQuality` - Update the quality score of a referral link

    ```json
    {
    	"linkId": "uuid-here",
    	"quality": 85
    }
    ```

    **Note:**

    -   `linkId` - The UUID of the referral link to update (required)
    -   `quality` - Quality score between 1 and 100 (required)

    Response:

    ```json
    {
    	"success": true
    }
    ```

    Error responses:

    -   `400` - Link ID is required
    -   `400` - Quality must be between 1 and 100
    -   `500` - Failed to update referral link quality

-   `PATCH /api/referrals/generateParentReferralCodes` - Generate unique 6-digit parent referral codes

    ```json
    {
    	"quantity": 50
    }
    ```

    **Note:**

    -   `quantity` - Number of codes to generate (required, must be between 1 and 100)
    -   Codes are 6-digit numbers (000000-999999)
    -   Codes are checked for uniqueness against both `referralCode` and `parentReferralCode` tables
    -   Codes within the batch are guaranteed to be unique

    Response:

    ```json
    {
    	"success": true,
    	"codes": ["123456", "789012", "345678"]
    }
    ```

    Error responses:

    -   `400` - Quantity must be between 1 and 100
    -   `500` - Failed to generate parent referral codes (may occur if unable to generate enough unique codes)

## Token Types

The contract supports 6 unique token types, each representing a different elemental sigil:

1. **Earth Sigil** - Stability, foundation, and grounding
2. **Water Sigil** - Flow, adaptability, and emotional depth
3. **Fire Sigil** - Passion, creativity, and determination
4. **Air Sigil** - Freedom, intellect, and communication
5. **Spirit Sigil** - Ethereal connection and divine power
6. **Void Sigil** - Ultimate mystery and infinite potential

## Metadata

Sample metadata files are provided in the `metadata/` folder for each token ID (1-6). These follow the ERC1155 metadata standard and include:

-   Name and description
-   Image URL (placeholder - update with actual images)
-   External URL
-   Attributes (Element, Rarity, Power, Type)

To use these metadata files:

1. Host them on a web server or IPFS
2. Update the image URLs in each JSON file
3. Set the token URIs using the `POST /api/sigils/set-token-uri` endpoint

Example:

```bash
# After deploying contract and hosting metadata
curl -X POST http://localhost:3000/api/sigils/set-token-uri \
  -H "Content-Type: application/json" \
  -d '{
    "tokenId": 1,
    "newUri": "https://your-domain.com/metadata/1.json"
  }'

# Optional: Specify contract address via query parameter
curl -X POST "http://localhost:3000/api/sigils/set-token-uri?contractAddress=0x..." \
  -H "Content-Type: application/json" \
  -d '{
    "tokenId": 1,
    "newUri": "https://your-domain.com/metadata/1.json"
  }'
```

## Postman Collection

A Postman collection is included for easy API testing:

-   **File:** `KAMI-Sigils-API.postman_collection.json`
-   **Import:** Import this file into Postman to get all API endpoints pre-configured
-   **Variables:** The collection includes variables for:
    -   `baseUrl` - API base URL (default: `http://localhost:3000`)
    -   `contractAddress` - Optional contract address
    -   `walletAddress` - Example wallet address for testing

All endpoints are organized into folders:

-   Health Check
-   Sigils (contract deployment and interactions)
-   Referrals (referral management, referral codes, leaderboard, and sigil creation)

**Note:** The Postman collection includes examples for all 14 referral endpoints:

1. Create referral (use referral code)
2. Get referral codes for user
3. Get referrals for user
4. Get referrals by source
5. Get leaderboard
6. Get user referral points
7. Get user sigil URI
8. Create sigil NFT
9. Add referral points
10. Set referral code as unused
11. Add referral links
12. Get referral links for user
13. Update referral link quality
14. Generate parent referral codes

## Testing

### Solidity Tests (Hardhat)

Run Hardhat tests:

```bash
pnpm run test:solidity
# or
npm run test:solidity
```

The test suite includes 18 tests covering:

-   Contract deployment
-   Token URI management
-   Minting functionality
-   Total supply tracking
-   Soul-bound (non-transferable) behavior
-   Access control

### TypeScript API Tests (Jest)

Run Jest tests:

```bash
pnpm test
# or
npm test
```

Run tests in watch mode:

```bash
pnpm run test:watch
# or
npm run test:watch
```

The API test suite includes comprehensive tests covering all endpoints with proper mocking:

-   **Contract API tests** (19 tests): All sigils/contract endpoints
-   **Referrals API tests** (32+ tests): All referrals endpoints including sigil management, referral codes, and leaderboard

## Project Structure

```
kami-referrals-service/
├── contracts/
│   └── KAMI-Sigil.sol          # Smart contract (ERC1155)
├── src/
│   ├── server.ts               # Express app entry point
│   ├── routes/
│   │   ├── sigils.ts           # Sigils API routes
│   │   └── referrals.ts        # Referrals API routes
│   ├── services/
│   │   ├── contract.ts         # Contract interaction service
│   │   └── deployment.ts        # Contract deployment service
│   ├── utils/
│   │   └── database.ts         # Database utility functions
│   ├── config/
│   │   └── network.ts          # Network and viem configuration
│   └── types/
│       └── index.ts            # TypeScript type definitions
├── test/
│   ├── solidity/
│   │   └── KamiSigils.test.ts  # Hardhat test suite (18 tests)
│   ├── api/
│   │   ├── contract.test.ts    # Jest API test suite for sigils (19 tests)
│   │   └── referrals.test.ts   # Jest API test suite for referrals (32 tests)
│   └── setup.ts                # Hardhat test setup
├── metadata/
│   ├── 1.json                  # Earth Sigil metadata
│   ├── 2.json                  # Water Sigil metadata
│   ├── 3.json                  # Fire Sigil metadata
│   ├── 4.json                  # Air Sigil metadata
│   ├── 5.json                  # Spirit Sigil metadata
│   └── 6.json                  # Void Sigil metadata
├── kami-platform-v1-schema/     # Prisma schema and database setup
├── Dockerfile                   # Multi-platform Docker build configuration
├── build-docker.sh              # Multi-platform Docker build script
├── hardhat.config.ts           # Hardhat configuration
├── jest.config.js              # Jest configuration
├── tsconfig.json               # TypeScript configuration
├── pnpm-workspace.yaml         # pnpm workspace configuration
└── package.json                # Dependencies and scripts
```

## Smart Contract Details

The KamiSigils contract is an ERC1155 token with the following features:

-   **Token IDs**: Supports 6 token types (IDs 1-6)
-   **Soul-bound**: Tokens are non-transferable (soul-bound) - they can only be minted, not transferred between addresses
-   **Owner Functions**: Only the contract owner can mint and set token URIs
-   **Custom URIs**: Each token ID can have its own metadata URI
-   **Total Supply Tracking**: Tracks total supply for each token ID separately

### Contract Functions

-   `mint(uint256 tokenId, uint256 amount, address recipient)` - Mint tokens (owner only)
-   `setTokenURI(uint256 tokenId, string memory newUri)` - Set metadata URI (owner only)
-   `uri(uint256 tokenId)` - Get metadata URI for a token ID
-   `getTotalSupply(uint256 tokenId)` - Get total supply for a token ID
-   `balanceOf(address account, uint256 id)` - Get balance (standard ERC1155)

## Network Configuration

The application is configured for **Base Sepolia testnet** by default. To use a different network:

1. Update `RPC_URL` in `.env` to your network's RPC endpoint
2. Update the chain configuration in `src/config/network.ts`
3. Ensure you have test tokens for the selected network

## Docker

### Building Docker Images

The Dockerfile supports multi-platform builds for both `linux/amd64` and `linux/arm64`. The build process automatically compiles native modules and generates Prisma clients for the target platform.

#### Quick Build (Local Platform)

Build for your local platform:

```bash
docker build -t kami-referrals-service:latest .
```

#### Multi-Platform Build Script

Use the provided build script for easy multi-platform builds:

```bash
# Build and push for both amd64 and arm64 (default)
./build-docker.sh

# Build for local platform only (loads into Docker)
./build-docker.sh --load

# Build for specific platform(s)
PLATFORMS=linux/amd64 ./build-docker.sh
PLATFORMS=linux/amd64,linux/arm64 ./build-docker.sh

# Custom image name and tag
IMAGE_NAME=my-registry/kami-referrals IMAGE_TAG=v1.0.0 ./build-docker.sh
```

The build script automatically:

-   Creates a buildx builder instance if needed
-   Handles multi-platform builds
-   Pushes to registry (or loads locally with `--load` flag)

#### Using Docker Buildx Directly

```bash
# Build and push for multiple platforms
docker buildx build --platform linux/amd64,linux/arm64 \
  -t your-registry/kami-referrals-service:latest \
  --push .

# Build for local platform only
docker buildx build --platform linux/amd64 \
  -t kami-referrals-service:latest \
  --load .
```

### Running the Container

#### Basic Usage

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL=your_database_url \
  -e PRIVATE_KEY=your_private_key \
  -e RPC_URL=your_rpc_url \
  kami-referrals-service:latest
```

#### With Environment File

Create a `.env` file and use it:

```bash
docker run -p 3000:3000 --env-file .env kami-referrals-service:latest
```

#### Required Environment Variables

-   `DATABASE_URL` - PostgreSQL connection string (required for referrals features)
-   `PRIVATE_KEY` - Ethereum private key for contract interactions (required)
-   `RPC_URL` - Ethereum RPC endpoint (required)

#### Optional Environment Variables

-   `PORT` - Server port (default: 3000)
-   `CONTRACT_ADDRESS` - Default contract address (optional, can be passed per request)
-   `NODE_ENV` - Node environment (default: production in Docker)
-   `REFERRAL_POINTS` - Points awarded per referral (default: 100)
-   `POINTS_ALL_USED` - Bonus points when all referral codes are used (default: 100)

### Docker Image Details

-   **Base Image**: `node:20-slim` (multi-platform)
-   **Platforms Supported**: `linux/amd64`, `linux/arm64`
-   **Native Modules**: Automatically compiled for target platform (keccak, secp256k1)
-   **Prisma**: Automatically downloads correct binaries for target platform
-   **Build Dependencies**: Python 3, make, g++, OpenSSL (included in image)
-   **Port**: 3000 (configurable via `PORT` environment variable)
-   **Health Check**: Available at `/health` endpoint (checks every 30s)

### Docker Compose

Docker Compose provides an easy way to run the entire stack (API + PostgreSQL) locally or in production.

#### Basic Docker Compose Setup

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
    api:
        image: kami-referrals-service:latest
        # Or build from source:
        # build:
        #     context: .
        #     dockerfile: Dockerfile
        ports:
            - '3000:3000'
        environment:
            - DATABASE_URL=postgresql://user:password@db:5432/kami
            - PRIVATE_KEY=${PRIVATE_KEY}
            - RPC_URL=${RPC_URL}
            - PORT=3000
            - CONTRACT_ADDRESS=${CONTRACT_ADDRESS}
            - REFERRAL_POINTS=${REFERRAL_POINTS:-100}
            - POINTS_ALL_USED=${POINTS_ALL_USED:-100}
            - NODE_ENV=production
        depends_on:
            db:
                condition: service_healthy
        healthcheck:
            test:
                [
                    'CMD',
                    'node',
                    '-e',
                    "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})",
                ]
            interval: 30s
            timeout: 10s
            retries: 3
            start_period: 40s
        restart: unless-stopped
        networks:
            - kami-network

    db:
        image: postgres:15-alpine
        environment:
            - POSTGRES_USER=${POSTGRES_USER:-user}
            - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-password}
            - POSTGRES_DB=${POSTGRES_DB:-kami}
        volumes:
            - postgres_data:/var/lib/postgresql/data
        ports:
            - '${POSTGRES_PORT:-5432}:5432'
        healthcheck:
            test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-user}']
            interval: 10s
            timeout: 5s
            retries: 5
        restart: unless-stopped
        networks:
            - kami-network

volumes:
    postgres_data:
        driver: local

networks:
    kami-network:
        driver: bridge
```

#### Using Docker Compose

1. **Create a `.env` file** (or use environment variables):

```env
# Database
POSTGRES_USER=user
POSTGRES_PASSWORD=secure_password_here
POSTGRES_DB=kami
POSTGRES_PORT=5432

# API Configuration
PRIVATE_KEY=0x_your_private_key_here
RPC_URL=https://sepolia.base.org
CONTRACT_ADDRESS=0x_your_contract_address
REFERRAL_POINTS=100
POINTS_ALL_USED=100
PORT=3000
NODE_ENV=production
```

2. **Start the services:**

```bash
# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# View API logs only
docker-compose logs -f api

# View database logs only
docker-compose logs -f db
```

3. **Stop the services:**

```bash
# Stop services
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes (⚠️ deletes database data)
docker-compose down -v
```

4. **Restart services:**

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart api
```

5. **Execute commands in containers:**

```bash
# Run Prisma migrations
docker-compose exec api sh -c "cd kami-platform-v1-schema && npx prisma migrate deploy"

# Access database shell
docker-compose exec db psql -U user -d kami

# Access API container shell
docker-compose exec api sh
```

#### Production Docker Compose Configuration

For production deployments, consider:

```yaml
version: '3.8'

services:
    api:
        image: your-registry/kami-referrals-service:latest
        ports:
            - '3000:3000'
        environment:
            - DATABASE_URL=${DATABASE_URL}
            - PRIVATE_KEY=${PRIVATE_KEY}
            - RPC_URL=${RPC_URL}
            - PORT=3000
            - NODE_ENV=production
        depends_on:
            db:
                condition: service_healthy
        healthcheck:
            test:
                [
                    'CMD',
                    'node',
                    '-e',
                    "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})",
                ]
            interval: 30s
            timeout: 10s
            retries: 3
            start_period: 40s
        restart: always
        deploy:
            resources:
                limits:
                    cpus: '2'
                    memory: 2G
                reservations:
                    cpus: '1'
                    memory: 512M
        networks:
            - kami-network
        logging:
            driver: 'json-file'
            options:
                max-size: '10m'
                max-file: '3'

    db:
        image: postgres:15-alpine
        environment:
            - POSTGRES_USER=${POSTGRES_USER}
            - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
            - POSTGRES_DB=${POSTGRES_DB}
        volumes:
            - postgres_data:/var/lib/postgresql/data
            - ./backups:/backups # For database backups
        healthcheck:
            test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER}']
            interval: 10s
            timeout: 5s
            retries: 5
        restart: always
        deploy:
            resources:
                limits:
                    cpus: '1'
                    memory: 1G
                reservations:
                    cpus: '0.5'
                    memory: 256M
        networks:
            - kami-network
        logging:
            driver: 'json-file'
            options:
                max-size: '10m'
                max-file: '3'

volumes:
    postgres_data:
        driver: local

networks:
    kami-network:
        driver: bridge
```

#### Docker Compose Environment Variables

Create a `.env` file or set these environment variables:

**Required:**

-   `DATABASE_URL` - Full PostgreSQL connection string
-   `PRIVATE_KEY` - Ethereum private key
-   `RPC_URL` - Ethereum RPC endpoint

**Optional:**

-   `POSTGRES_USER` - Database user (default: `user`)
-   `POSTGRES_PASSWORD` - Database password (default: `password`)
-   `POSTGRES_DB` - Database name (default: `kami`)
-   `POSTGRES_PORT` - Database port (default: `5432`)
-   `CONTRACT_ADDRESS` - Default contract address
-   `PORT` - API server port (default: `3000`)
-   `REFERRAL_POINTS` - Points per referral (default: `100`)
-   `POINTS_ALL_USED` - Bonus points (default: `100`)
-   `NODE_ENV` - Node environment (default: `production`)

#### Database Migrations with Docker Compose

Run migrations before starting the API:

```bash
# Start database only
docker-compose up -d db

# Wait for database to be ready
sleep 5

# Run migrations
docker-compose exec api sh -c "cd kami-platform-v1-schema && npx prisma migrate deploy"

# Start all services
docker-compose up -d
```

#### Backup and Restore

**Backup database:**

```bash
docker-compose exec db pg_dump -U user kami > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Restore database:**

```bash
docker-compose exec -T db psql -U user kami < backup_20240101_120000.sql
```

#### Troubleshooting Docker Compose

**Check service status:**

```bash
docker-compose ps
```

**View service logs:**

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs api
docker-compose logs db

# Follow logs
docker-compose logs -f api
```

**Restart services:**

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart api
```

**Rebuild and restart:**

```bash
# Rebuild API image
docker-compose build api

# Rebuild and restart
docker-compose up -d --build api
```

### Troubleshooting Docker Builds

#### Build Fails with "Unknown option: 'enable-pre-post-scripts'"

This error indicates an outdated pnpm version. The Dockerfile uses the correct pnpm flags. Ensure you're using the latest Docker image.

#### Native Module Compilation Errors

If you see Python or compilation errors:

-   The Dockerfile includes all necessary build tools (Python 3, make, g++, etc.)
-   Ensure you're building for a supported platform (`linux/amd64` or `linux/arm64`)
-   Try rebuilding without cache: `docker build --no-cache -t kami-referrals-service:latest .`

#### Prisma OpenSSL Warnings

These warnings are informational. Prisma will still work correctly. The Dockerfile includes OpenSSL and libssl-dev to minimize these warnings.

#### Multi-Platform Build Issues

If multi-platform builds fail:

-   Ensure Docker Buildx is enabled: `docker buildx version`
-   Create a new builder: `docker buildx create --name multiarch-builder --use`
-   For emulation, ensure QEMU is available (usually included in Docker Desktop)

## Building

### Prerequisites for Building

Before building the application, ensure you have:

-   Node.js 18+ installed
-   pnpm (recommended) or npm
-   PostgreSQL database (for referrals features)
-   Access to Ethereum RPC endpoint
-   Ethereum private key for contract interactions

### Build Process

#### Step 1: Install Dependencies

```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install
```

**Note:** The project uses pnpm with approved build scripts for native modules. If using npm, ensure build scripts are allowed.

#### Step 2: Generate Prisma Client

```bash
cd kami-platform-v1-schema
npx prisma generate
cd ..
```

This generates the Prisma Client based on your schema.

#### Step 3: Compile Smart Contracts

```bash
pnpm run compile
# or
npm run compile
```

This compiles the Solidity contracts using Hardhat and creates artifacts in `artifacts/`.

#### Step 4: Run Database Migrations

```bash
cd kami-platform-v1-schema
npx prisma migrate dev
# or for production
npx prisma migrate deploy
cd ..
```

**Development:** `migrate dev` creates and applies migrations  
**Production:** `migrate deploy` applies existing migrations

#### Step 5: Compile TypeScript

```bash
pnpm run build
# or
npm run build
```

This compiles TypeScript files to JavaScript in the `dist/` directory.

### Build Verification

After building, verify the build:

```bash
# Check if dist directory exists
ls -la dist/

# Verify main entry point exists
ls -la dist/server.js

# Run type checking
pnpm run build
```

### Build Artifacts

The build process creates:

-   `dist/` - Compiled JavaScript files
-   `artifacts/` - Compiled Solidity contracts
-   `cache/` - Hardhat cache files
-   `node_modules/` - Dependencies

### Clean Build

To perform a clean build:

```bash
# Clean Hardhat artifacts
pnpm run clean

# Remove dist directory
rm -rf dist/

# Remove node_modules (optional)
rm -rf node_modules/

# Reinstall and rebuild
pnpm install
pnpm run compile
pnpm run build
```

### Build Scripts Reference

| Script               | Description                              |
| -------------------- | ---------------------------------------- |
| `pnpm run build`     | Compile TypeScript to JavaScript         |
| `pnpm run compile`   | Compile Solidity contracts               |
| `pnpm run clean`     | Clean Hardhat build artifacts            |
| `pnpm run dev`       | Start development server with hot reload |
| `pnpm start`         | Start production server from `dist/`     |
| `pnpm test`          | Run Jest tests                           |
| `pnpm test:watch`    | Run tests in watch mode                  |
| `pnpm test:solidity` | Run Hardhat Solidity tests               |

### Production Build Checklist

Before deploying to production:

-   [ ] All dependencies installed (`pnpm install --frozen-lockfile`)
-   [ ] Prisma client generated (`npx prisma generate`)
-   [ ] Smart contracts compiled (`pnpm run compile`)
-   [ ] Database migrations applied (`npx prisma migrate deploy`)
-   [ ] TypeScript compiled (`pnpm run build`)
-   [ ] Environment variables configured
-   [ ] Tests passing (`pnpm test`)
-   [ ] Build artifacts verified (`dist/` directory exists)
-   [ ] Health check endpoint tested (`/health`)

## Development

### Development Workflow

1. **Start development server:**

```bash
pnpm run dev
```

2. **Make code changes** - The server will automatically reload

3. **Run tests:**

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run Solidity tests
pnpm run test:solidity
```

### Compiling Contracts

```bash
pnpm run compile
```

### Cleaning Build Artifacts

```bash
pnpm run clean
```

### Type Checking

```bash
pnpm run build
```

### Database Development

**Generate Prisma Client after schema changes:**

```bash
cd kami-platform-v1-schema
npx prisma generate
cd ..
```

**Create a new migration:**

```bash
cd kami-platform-v1-schema
npx prisma migrate dev --name your_migration_name
cd ..
```

**View database in Prisma Studio:**

```bash
cd kami-platform-v1-schema
npx prisma studio
cd ..
```

**Reset database (⚠️ deletes all data):**

```bash
cd kami-platform-v1-schema
npx prisma migrate reset
cd ..
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Push Docker Image

on:
    push:
        tags:
            - 'v*'

jobs:
    build:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3

            - name: Set up Docker Buildx
              uses: docker/setup-buildx-action@v2

            - name: Login to Container Registry
              uses: docker/login-action@v2
              with:
                  registry: your-registry.com
                  username: ${{ secrets.REGISTRY_USERNAME }}
                  password: ${{ secrets.REGISTRY_PASSWORD }}

            - name: Build and push
              run: |
                  IMAGE_NAME=your-registry.com/kami-referrals-service \
                  IMAGE_TAG=${GITHUB_REF#refs/tags/} \
                  ./build-docker.sh
```

### Environment Variables for Production

When deploying to production, ensure these environment variables are set:

```bash
# Required
ENCRYPTION_KEY=your_64_character_hex_encryption_key
DATABASE_URL=postgresql://user:password@host:5432/database
RPC_URL=https://mainnet.base.org

# Optional
PORT=3000
CONTRACT_ADDRESS=0x...
NODE_ENV=production
AWS_SECRET_NAME=your-aws-secret-name  # Optional: AWS Secrets Manager fallback
```

**Important:** Private keys are now stored encrypted in the `quest_pk` database table, not in environment variables. Use the `scripts/encrypt-key.ts` script to store encrypted private keys for each chain.

## Security Considerations

### Private Key Management

**All private keys are stored encrypted in the database** using AES-256-GCM encryption:

1. **Encryption Key**: The `ENCRYPTION_KEY` environment variable (32-byte hex string) is used to encrypt/decrypt private keys
   - Generate with: `openssl rand -hex 32`
   - Store securely (e.g., AWS Secrets Manager, HashiCorp Vault)
   - Never commit to version control
   - Rotate periodically

2. **Database Storage**: Encrypted private keys are stored in the `quest_pk` table
   - Each chain has its own encrypted private key (identified by `chainId`)
   - Keys are encrypted at rest using AES-256-GCM
   - Use `scripts/encrypt-key.ts` to store encrypted keys

3. **Retrieval Priority**: The system retrieves private keys in this order:
   - Primary: `quest_pk` database table (by chain ID)
   - Fallback 1: AWS Secrets Manager (if `AWS_SECRET_NAME` is set)
   - Fallback 2: `PRIVATE_KEY` environment variable (deprecated, with warning)

4. **Migration from Plaintext**: If you have existing plaintext private keys:
   ```bash
   # Generate encryption key
   openssl rand -hex 32 > .encryption_key
   # Add to .env as ENCRYPTION_KEY
   
   # Encrypt and store for each chain
   ts-node scripts/encrypt-key.ts 84532 0x_your_private_key
   ```

### Other Security Considerations

-   **Database Credentials**: Store database URLs securely and use connection pooling in production
-   **RPC Endpoints**: Use authenticated RPC endpoints in production to avoid rate limiting
-   **Docker Images**: Regularly update base images and dependencies for security patches
-   **Health Checks**: The health check endpoint is public. Don't expose sensitive information through it
-   **Encryption Key Rotation**: When rotating `ENCRYPTION_KEY`, re-encrypt all private keys in the database

## License

MIT
