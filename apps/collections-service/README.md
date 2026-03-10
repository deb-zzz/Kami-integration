# KAMI Platform Collections Service

A Next.js-based microservice for managing NFT collections within the KAMI platform ecosystem. This service provides a RESTful API for creating, retrieving, and updating collections, along with their associated products, assets, and metadata.

## Overview

The Collections Service is a core component of the KAMI platform that handles the lifecycle management of NFT collections. It enables users to:

- Create and manage NFT collections linked to blockchain projects
- Organize products (NFTs) within collections
- Track collection metadata, ownership, and social interactions (likes, follows, shares)
- Support multiple blockchain networks and contract types
- Manage collection collaborators and project associations

## Features

### Collection Management
- **Create Collections**: Create new collections with metadata, images, and blockchain configuration
- **Retrieve Collections**: Fetch collections by wallet address or collection ID
- **Update Collections**: Modify collection details including name, description, and media URLs
- **Collection Types**: Support for ERC721AC, ERC721C, ERC1155C, and ERC20 contract types

### Product Management
- **Product Listing**: Retrieve products within collections with full metadata
- **Product Details**: Access detailed product information including assets, vouchers, bundles, and traits
- **Metadata Support**: Parse and serve NFT metadata following standard formats

### Social Features
- **Likes**: Track and query collection and product likes
- **Follows**: Manage collection and product followers
- **Shares**: Track collection sharing activity

### Blockchain Integration
- **Multi-Chain Support**: Configure collections for different blockchain networks via chain ID
- **Contract Management**: Store and manage smart contract addresses
- **Token ID Tracking**: Associate products with on-chain token identifiers

### Collaboration
- **Project Association**: Link collections to platform projects
- **Collaborator Management**: Track project collaborators and their roles
- **Category Organization**: Organize collections by project categories

## Technology Stack

- **Framework**: Next.js 14.2.9 (App Router)
- **Language**: TypeScript 5
- **Database**: PostgreSQL (via Prisma ORM)
- **Caching**: Redis (via ioredis)
- **Blockchain**: Ethers.js 6.13.2
- **HTTP Client**: Axios 1.7.7
- **Prisma Middleware**: prisma-redis-middleware 4.8.0

## API Endpoints

### Collections by Wallet Address

#### `GET /api/[walletAddress]`
Retrieve all collections owned by a wallet address.

**Query Parameters:**
- `withProducts` (optional): Include product details in response (`true`/`false`)
- `userWalletAddress` (optional): Wallet address for user-specific data (likes, follows)

**Example:**
```http
GET /api/0x1A653455cF346034E6BEE40cb80cf7748876Dc7d?withProducts=true&userWalletAddress=0x16c607Dbe5e4959B159510C63925051e31d2E0A6
```

**Response:**
```json
{
  "collections": [
    {
      "collectionId": 1,
      "name": "My Collection",
      "description": "A collection of NFTs",
      "ownerWalletAddress": "0x1A653455cF346034E6BEE40cb80cf7748876Dc7d",
      "products": [...],
      "likes": 10,
      "follows": 5,
      "shares": 2,
      "likedByMe": false,
      "followedByMe": true,
      "isPublished": true,
      "isOwnedByMe": false
    }
  ]
}
```

#### `POST /api/[walletAddress]`
Create a new collection.

**Request Body:**
```json
{
  "name": "My New Collection",
  "symbol": "MNC",
  "description": "A collection of products",
  "projectId": 212,
  "avatarUrl": "https://example.com/avatar.png",
  "bannerUrl": "https://example.com/banner.png",
  "type": "ERC721C",
  "chainId": "0x14a34"
}
```

**Response:** Created collection object (201 status)

### Collection by ID

#### `GET /api/[walletAddress]/[collectionId]`
Retrieve a specific collection by ID.

**Query Parameters:**
- `userWalletAddress` (optional): Wallet address for user-specific data

**Example:**
```http
GET /api/0x16c607Dbe5e4959B159510C63925051e31d2E0A6/9?userWalletAddress=0x16c607Dbe5e4959B159510C63925051e31d2E0A6
```

**Response:** Collection object with full details including products

#### `PUT /api/[walletAddress]/[collectionId]`
Update collection details.

**Request Body:**
```json
{
  "name": "Updated Collection Name",
  "description": "Updated description",
  "avatarUrl": "https://example.com/new-avatar.png",
  "bannerUrl": "https://example.com/new-banner.png",
  "contractAddress": "0x..."
}
```

**Response:** Updated collection object (200 status)

### Collection by ID (Public)

#### `GET /api/byId/[collectionId]`
Retrieve a collection by ID without wallet address context (public endpoint).

**Response:** Collection object (user-specific flags set to false)

## Installation

### Prerequisites

- Node.js 22 or higher
- pnpm (package manager)
- PostgreSQL database
- Redis server (optional, for caching)

### Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd kami-platform-collections-service
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://user:password@host:port/database"
   REDIS_URL="redis://localhost:6379/0"
   DEFAULT_CHAIN_ID="0x14a34"
   ```

4. **Generate Prisma Client:**
   ```bash
   npx prisma generate --schema=kami-platform-v1-schema/prisma/schema.prisma
   ```

5. **Run database migrations:**
   ```bash
   npx prisma migrate deploy --schema=kami-platform-v1-schema/prisma/schema.prisma
   ```

## Development

### Running the Development Server

```bash
pnpm dev
```

The service will start on `http://localhost:3000` by default.

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

### Project Structure

```
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── [walletAddress]/
│   │       │   ├── route.ts              # Collection CRUD by wallet
│   │       │   └── [collectionId]/
│   │       │       └── route.ts          # Individual collection operations
│   │       └── byId/
│   │           └── [collectionId]/
│   │               └── route.ts          # Public collection endpoint
│   └── lib/
│       └── db.ts                         # Prisma client configuration
├── kami-platform-v1-schema/
│   └── prisma/
│       └── schema.prisma                 # Database schema
├── tests/
│   └── collections.http                  # API test examples
└── Dockerfile                            # Container configuration
```

## Database Schema

The service uses Prisma ORM with a shared schema located in `kami-platform-v1-schema/prisma/schema.prisma`. Key models include:

### Collection Model
- `collectionId`: Unique identifier
- `projectId`: Associated project ID (unique)
- `name`, `symbol`, `description`: Collection metadata
- `avatarUrl`, `bannerUrl`: Media URLs
- `chainId`: Blockchain network identifier
- `contractAddress`: Smart contract address
- `contractType`: ERC721AC, ERC721C, ERC1155C, or ERC20
- `ownerWalletAddress`: Collection owner

### Relationships
- Collections belong to a `project`
- Collections have many `products`
- Collections have many `likes`, `followers`, and `shares`
- Collections belong to an `owner` (user)

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | No |
| `DEFAULT_CHAIN_ID` | Default blockchain chain ID | Yes |

### Chain ID Format

Chain IDs are stored as hexadecimal strings (e.g., `0x14a34`). The service validates chain IDs against the `blockchain` table in the database.

## Deployment

### Docker

The service includes a multi-stage Dockerfile for optimized production builds:

```bash
docker build -t kami-collections-service .
docker run -p 3000:3000 --env-file .env kami-collections-service
```

### Production Build

```bash
pnpm build
pnpm start
```

The production server runs on port 3000 by default.

### GitHub Actions

The repository includes GitHub Actions workflows for:
- AMD64 builds (`.github/workflows/amd64.yml`)
- ARM64 builds (`.github/workflows/arm64.yml`)

## API Response Format

### Collection Object

```typescript
{
  collectionId: number;
  category: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  createdAt: number;
  ownerWalletAddress: string;
  products: Product[];
  collaborators: Collaborator[];
  type?: 'ERC721AC' | 'ERC721C' | 'ERC1155C' | 'ERC20';
  likes: number;
  shares: number;
  follows: number;
  likedByMe: boolean;
  followedByMe: boolean;
  isPublished: boolean;
  isOwnedByMe: boolean;
  owner: User;
  chainId: string;
}
```

### Product Object

```typescript
{
  productId: number;
  ownerWalletAddress: string;
  name: string;
  description: string;
  imageUrl?: string;
  animationUrl?: string;
  traits?: Array<{ trait_type: string; value: string }>;
  bundle?: Bundle[];
  tokenId?: string;
  price: number;
  availableQuantity?: number;
  maxQuantity?: number;
  consumerAction?: ConsumerAction;
  audience?: ProductAudience;
  likes: number;
  shares: number;
  follows: number;
  likedByMe: boolean;
  followedByMe: boolean;
  createdAt: number;
}
```

## Error Handling

The API returns standard HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors, missing required fields)
- `500` - Internal Server Error

Error responses follow this format:
```json
{
  "error": "Error message description"
}
```

## Testing

API examples are provided in `tests/collections.http`. You can use these with REST client extensions in your IDE (e.g., REST Client for VS Code).

## Contributing

1. Follow the existing code style and TypeScript conventions
2. Ensure all API endpoints have proper error handling
3. Update this README when adding new features or endpoints
4. Test your changes thoroughly before submitting

## License

[Add your license information here]

## Support

For issues, questions, or contributions, please contact the KAMI platform development team.
