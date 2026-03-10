# KAMI Platform Social Service

A Next.js-based REST API service for the KAMI platform that handles social media interactions including posts, comments, likes, shares, follows, and user profiles. This service integrates with a Prisma database and Redis caching layer to provide efficient social networking functionality.

## Overview

This service provides a comprehensive API for social media features including:

- **Posts**: Create, retrieve, and manage posts with product associations
- **Comments**: Add comments to posts with nested reply support
- **Likes**: Like/unlike posts, products, collections, comments, and profiles
- **Shares**: Share posts and products
- **Follows**: Follow/unfollow users and retrieve follower/following lists
- **Profiles**: Retrieve user profiles with posts and statistics
- **Products**: Retrieve products associated with users (liked or shared)
- **Collections**: Like/unlike NFT collections
- **Statistics**: Platform-wide statistics with trending scores
 
## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis (for statistics caching)
- **Language**: TypeScript
- **Package Manager**: pnpm

## Project Structure

```
src/
├── app/
│   └── api/
│       ├── [walletAddress]/          # User-specific endpoints
│       │   ├── collection/            # Collection interactions
│       │   ├── comment/               # Comment interactions
│       │   ├── post/                  # Post operations
│       │   ├── product/              # Product operations
│       │   └── profile/               # Profile operations
│       └── stats/                     # Platform statistics
├── lib/
│   ├── db.ts                          # Prisma client configuration
│   └── utils.ts                       # Utility functions for formatting
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (or npm/yarn)
- PostgreSQL database
- Redis server (optional, for caching)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd kami-platform-social-service
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
# Copy .env.example to .env and fill in your values
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
```

4. Set up the database:
```bash
# Generate Prisma client
cd kami-platform-v1-schema
pnpm prisma generate

# Run migrations (if applicable)
pnpm prisma migrate dev
```

5. Start the development server:
```bash
pnpm dev
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Posts

- `GET /api/[walletAddress]/post/following` - Get posts from followed users
- `GET /api/[walletAddress]/post/favorites` - Get liked posts
- `GET /api/[walletAddress]/post/[postId]/feed` - Get post interaction details
- `POST /api/[walletAddress]/post/[postId]/like` - Like a post
- `DELETE /api/[walletAddress]/post/[postId]/like` - Unlike a post
- `POST /api/[walletAddress]/post/[postId]/share` - Share a post
- `POST /api/[walletAddress]/post/[postId]/comment` - Add a comment
- `DELETE /api/[walletAddress]/post/[postId]/comment` - Delete a comment

### Products

- `GET /api/[walletAddress]/product` - Get products (liked or shared by user)
- `POST /api/[walletAddress]/product/[productId]/like` - Like a product
- `DELETE /api/[walletAddress]/product/[productId]/like` - Unlike a product
- `POST /api/[walletAddress]/product/[productId]/share` - Share a product

### Collections

- `POST /api/[walletAddress]/collection/[collectionId]/like` - Like a collection
- `DELETE /api/[walletAddress]/collection/[collectionId]/like` - Unlike a collection

### Comments

- `POST /api/[walletAddress]/comment/[commentId]/like` - Like a comment
- `DELETE /api/[walletAddress]/comment/[commentId]/like` - Unlike a comment

### Profiles

- `GET /api/[walletAddress]/profile/posts/me` - Get user's own posts
- `GET /api/[walletAddress]/profile/posts/others` - Get posts liked/shared by user
- `GET /api/[walletAddress]/profile/followers` - Get user's followers
- `GET /api/[walletAddress]/profile/following` - Get users being followed
- `POST /api/[walletAddress]/profile/[targetWalletAddress]/follow` - Follow a user
- `DELETE /api/[walletAddress]/profile/[targetWalletAddress]/follow` - Unfollow a user
- `POST /api/[walletAddress]/profile/[targetWalletAddress]/like` - Like a profile
- `DELETE /api/[walletAddress]/profile/[targetWalletAddress]/like` - Unlike a profile

### Statistics

- `GET /api/stats` - Get platform statistics (cached for 6 minutes)
- `POST /api/stats` - Force refresh platform statistics

## Features

### Notifications

The service integrates with a notification service to send push notifications for:
- Post likes
- Post comments
- Product likes
- Collection likes
- Profile likes
- New followers

Notifications are sent asynchronously and failures don't affect the main operation.

### Caching

Statistics are cached in Redis for 6 minutes to reduce database load. The cache is automatically invalidated when new statistics are generated.

### Trending Algorithm

Posts are scored using a weighted algorithm that considers:
- Likes (30% weight)
- Shares (40% weight)
- Views (20% weight)
- Time decay (10% weight)

## Development

### Running Tests

Test files are available in the `tests/` directory using HTTP format. You can use tools like REST Client or Postman to test the endpoints.

### Code Style

The project uses:
- TypeScript for type safety
- ESLint for code linting
- JSDoc for documentation

### Database Schema

The database schema is managed through Prisma and located in `kami-platform-v1-schema/prisma/schema.prisma`. 

## Environment Variables

Required environment variables:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string (optional, for caching)
- `NODE_ENV`: Environment (development/production)

## Deployment

### Build

```bash
pnpm build
```

### Start Production Server

```bash
pnpm start
```

### Docker

A Dockerfile is provided for containerized deployment. Build and run:

```bash
docker build -t kami-social-service .
docker run -p 3000:3000 kami-social-service
```

## Contributing

1. Follow the existing code style and documentation patterns
2. Add JSDoc comments for all new functions
3. Update this README for significant changes
4. Test your changes thoroughly

## License

[Add your license information here]
