# KAMI Platform Web3 Service - Development Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [Development Environment](#development-environment)
4. [API Development](#api-development)
5. [Testing](#testing)
6. [Code Style](#code-style)
7. [Debugging](#debugging)
8. [Contributing](#contributing)

## Getting Started

### Prerequisites

-   Node.js 18+ (recommended: use nvm)
-   PostgreSQL 13+
-   pnpm (recommended) or npm/yarn
-   Git

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd kami-platform-web3-service

# Install dependencies
pnpm install

# Deploy gasless infrastructure
pnpm tsx scripts/setup-gasless-infrastructure.ts 84532 0x1234...

# Start development server
pnpm dev
```

## Project Structure

```
src/
├── app/
│   └── api/                    # API routes (Next.js App Router)
│       ├── publish/            # NFT publishing
│       ├── checkout/           # Checkout (sync + async status/stream)
│       ├── product/            # Product management + audience, setPrice
│       ├── asset/              # Asset list, details, setPrice, setAudience, setConsumerAction
│       ├── ipfs/upload/        # IPFS upload (Filebase)
│       ├── nft/[productId]/stopMinting/
│       └── blockchain/        # deploy, deployAndMint, mint, setTokenPrice, nft, getTotalSupply/Minted, [walletAddress]/getTokenBalance, sponsoredPaymentTokenTransfer
├── lib/                        # Library functions
│   ├── gasless-nft.ts          # Gasless operations facade
│   ├── gasless-nft/            # Deploy, mint, sell, operations, signatures
│   ├── checkout-processor/    # Checkout orchestration (deploy/mint/buy)
│   ├── checkout-job.ts         # Async checkout job
│   ├── db.ts                   # Database connection
│   ├── redis.ts                # Optional Redis
│   ├── types.ts                # TypeScript definitions
│   ├── ipfs.ts / ipfs2.ts      # IPFS integration (ipfs2 = Filebase)
│   ├── kami-config.ts          # KAMI configuration
│   └── gasless-config.ts       # Gasless configuration (from database)
└── scripts/                    # Deployment scripts
    ├── setup-gasless-infrastructure.ts
    ├── deploy-simpleaccount.ts
    ├── deploy-contractdeployer.ts
    └── deploy-libraries.ts

kami-platform-v1-schema/       # Git submodule
└── prisma/
    └── schema.prisma          # Database schema (run prisma from repo root)

docs/                          # Documentation
├── OVERVIEW.md                # Business overview
├── development/
│   ├── ARCHITECTURE.md        # System design and data flows
│   ├── DEVELOPMENT.md         # This file
│   ├── DATABASE_SCHEMA.md     # Data model reference
│   └── GASLESS_NFT.md         # Gasless library docs
├── api/
│   ├── API_REFERENCE.md       # Full API reference
│   └── CLIENT_INTEGRATION.md  # Frontend integration
└── CHANGELOG.md
```

## Development Environment

### IDE Setup

Recommended VS Code extensions:

-   Prisma
-   TypeScript Importer
-   ESLint
-   Prettier
-   REST Client (for testing APIs)

### TypeScript Configuration

The project uses multiple TypeScript configurations:

-   `tsconfig.json` - Main configuration
-   `tsconfig.minimal.json` - Minimal configuration for scripts
-   `tsconfig.test.json` - Test configuration

### Database Schema

The database schema is in the **git submodule** `kami-platform-v1-schema/prisma/schema.prisma`. Run `npx prisma generate` and migrations from the repo root (see [package.json](../../package.json) `prisma.schema` path). See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for the full data model. Key models include:

-   **user** - User profiles and wallet information
-   **project** - Project management
-   **collection** - NFT collection contracts
-   **product** - Product definitions
-   **asset** - Individual NFT assets
-   **voucher** - Lazy minting vouchers
-   **transaction** - Blockchain transaction records

## API Development

### Creating New Endpoints

1. Create a new route file in `src/app/api/`
2. Export HTTP method functions (GET, POST, PUT, DELETE)
3. Use Prisma for database operations
4. Use gasless-nft functions for blockchain operations
5. Return proper NextResponse objects

Example:

```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
	try {
		const data = await prisma.example.findMany();
		return NextResponse.json({ success: true, data });
	} catch (error) {
		return NextResponse.json({ success: false, error: 'Failed to fetch data' }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const data = await prisma.example.create({ data: body });
		return NextResponse.json({ success: true, data });
	} catch (error) {
		return NextResponse.json({ success: false, error: 'Failed to create data' }, { status: 500 });
	}
}
```

### Error Handling

Always use try-catch blocks and return consistent error responses:

```typescript
try {
	// Your code here
	return NextResponse.json({ success: true, data });
} catch (error) {
	console.error('Error:', error);
	return NextResponse.json(
		{
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		},
		{ status: 500 }
	);
}
```

### Validation

Use TypeScript types and runtime validation:

```typescript
import { z } from 'zod';

const schema = z.object({
	name: z.string().min(1),
	price: z.string().regex(/^\d+$/),
	quantity: z.number().min(1).max(100000),
});

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const validatedData = schema.parse(body);
		// Use validatedData
	} catch (error) {
		return NextResponse.json({ success: false, error: 'Invalid input data' }, { status: 400 });
	}
}
```

## Testing

### Unit Testing

```bash
# Run TypeScript compilation
npx tsc --project tsconfig.test.json

# Run compiled tests
node dist/tests/yourTestFile.js
```

### API Testing

Use the provided Postman collection or REST client:

```bash
# Test with curl
curl -X POST http://localhost:3000/api/publish \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Collection", "symbol": "TEST"}'
```

### Integration Testing

```bash
# Test specific functions
pnpm tsx -e "import { deployKami721CContract } from './src/lib/gasless-nft'; console.log('Test passed');"
```

### Test Files

Create test files in the `tests/` directory:

```typescript
// tests/gasless-nft.test.ts
import { describe, it, expect } from 'vitest';
import { deployKami721CContract } from '../src/lib/gasless-nft';

describe('Gasless NFT Operations', () => {
	it('should deploy contract successfully', async () => {
		// Test implementation
	});
});
```

## Code Style

### TypeScript

-   Use strict TypeScript configuration
-   Define proper types for all functions and variables
-   Use interfaces for complex objects
-   Avoid `any` type unless absolutely necessary

### Naming Conventions

-   Use camelCase for variables and functions
-   Use PascalCase for classes and interfaces
-   Use UPPER_CASE for constants
-   Use descriptive names

### File Organization

-   Group related functions together
-   Use barrel exports (`index.ts`) for clean imports
-   Keep files focused on a single responsibility
-   Use meaningful file names

### Comments

```typescript
/**
 * Deploy a KAMI721C contract gaslessly
 * @param chainId - The blockchain chain ID
 * @param params - Deployment parameters
 * @returns Promise with deployment result
 */
export async function deployKami721CContract(chainId: string, params: DeployParams): Promise<DeployResult> {
	// Implementation
}
```

## Debugging

### Enable Debug Logging

Set environment variable:

```bash
NODE_ENV=development
```

### Prisma Debugging

Enable query logging in `src/lib/db.ts`:

```typescript
export const prisma = new PrismaClient({
	log: ['query', 'info', 'warn', 'error'],
});
```

### Console Logging

Use structured logging:

```typescript
console.log('Deploying contract:', {
	chainId,
	contractType,
	name,
	symbol,
});
```

### Error Tracking

Always log errors with context:

```typescript
try {
	// Your code
} catch (error) {
	console.error('Failed to deploy contract:', {
		error: error instanceof Error ? error.message : error,
		chainId,
		contractType,
		timestamp: new Date().toISOString(),
	});
	throw error;
}
```

## Contributing

### Git Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Test your changes thoroughly
4. Commit with descriptive messages: `git commit -m "Add new API endpoint for user profiles"`
5. Push to your branch: `git push origin feature/your-feature`
6. Create a pull request

### Commit Messages

Use conventional commit format:

-   `feat:` - New features
-   `fix:` - Bug fixes
-   `docs:` - Documentation changes
-   `style:` - Code style changes
-   `refactor:` - Code refactoring
-   `test:` - Test additions/changes
-   `chore:` - Build process or auxiliary tool changes

Examples:

```
feat: add user profile API endpoint
fix: resolve database connection timeout issue
docs: update API reference with new endpoints
```

### Code Review

Before submitting a PR:

1. Ensure all tests pass
2. Check for TypeScript errors
3. Verify API endpoints work correctly
4. Update documentation if needed
5. Test with different blockchain networks

### Pull Request Template

```markdown
## Description

Brief description of changes

## Type of Change

-   [ ] Bug fix
-   [ ] New feature
-   [ ] Breaking change
-   [ ] Documentation update

## Testing

-   [ ] Unit tests pass
-   [ ] Integration tests pass
-   [ ] Manual testing completed

## Checklist

-   [ ] Code follows style guidelines
-   [ ] Self-review completed
-   [ ] Documentation updated
-   [ ] No breaking changes (or documented)
```

## Troubleshooting

### Common Issues

#### Database Connection

```bash
# Check if PostgreSQL is running
pg_ctl status

# Test connection
psql -h localhost -U username -d kami_platform
```

#### Prisma Issues

```bash
# Regenerate Prisma client
npx prisma generate

# Reset database
npx prisma migrate reset
```

#### Blockchain Issues

```bash
# Check RPC URL
curl -X POST https://sepolia.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

#### IPFS Issues

```bash
# Test IPFS service
curl -X POST http://ipfs-service/api/upload \
  -F "file=@test.jpg"
```

### Getting Help

1. Check the [Architecture](./ARCHITECTURE.md)
2. Review the [API Reference](../api/API_REFERENCE.md)
3. Check the [Database Schema](./DATABASE_SCHEMA.md)
4. Check existing issues in the repository
5. Contact the development team

---

**Version**: 1.0.0  
**Last Updated**: January 2026
