/**
 * @fileoverview Database client configuration and setup.
 * 
 * This module exports a singleton Prisma client instance that is reused across
 * the application. In development, the client is stored in the global object to
 * prevent multiple instances during hot reloading.
 * 
 * Redis caching middleware is available but currently commented out. It can be
 * enabled by uncommenting the relevant sections.
 * 
 * @module lib/db
 */

import { PrismaClient } from '@prisma/client';
// import Redis from 'ioredis';
// import { createPrismaRedisCache } from 'prisma-redis-middleware';

/**
 * Redis client initialization (currently disabled).
 * 
 * To enable Redis caching:
 * 1. Uncomment the Redis import and client initialization
 * 2. Uncomment the cacheMiddleware configuration
 * 3. Uncomment the prisma.$use(cacheMiddleware) line
 * 
 * @type {Redis}
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// const redis: any = new Redis(process.env.REDIS_URL as string);
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Global object to store the Prisma client instance.
 * 
 * In non-production environments (development), Next.js hot reloading can create
 * multiple instances of modules. Storing the Prisma client in the global object
 * ensures we reuse the same instance across hot reloads, preventing connection
 * pool exhaustion.
 * 
 * @type {Object}
 */
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

/**
 * Middleware for caching Prisma queries using Redis.
 *
 * @type {Prisma.Middleware}
 *
 * Models Configuration:
 * - `user`: Caches for 60 seconds, excludes `findMany`, `findFirst`, `findFirstOrThrow` methods, and invalidates related `tags`, `like`, `comment`, `post`.
 * - `tag`: Caches for 60 seconds, excludes `findMany`, `findFirstOrThrow`, `findFirst` methods.
 *
 * Storage Configuration:
 * - Uses Redis with a references TTL of 60 seconds.
 *
 * Exclusions:
 * - Models: `project`, `like`, `comment`
 * - Methods: `count`, `groupBy`
 *
 * Event Handlers:
 * - `onHit`: Logs cache hits.
 * - `onMiss`: Logs cache misses.
 * - `onError`: Logs cache errors.
 */
// const cacheMiddleware: Prisma.Middleware = createPrismaRedisCache({
// 	models: [
// 		{
// 			model: 'user',
// 			cacheTime: 60,
// 			excludeMethods: ['findMany', 'findFirst', 'findFirstOrThrow'],
// 			invalidateRelated: ['tags', 'like', 'comment', 'post'],
// 		},
// 		{ model: 'tag', cacheTime: 60, excludeMethods: ['findMany', 'findFirstOrThrow', 'findFirst'] },
// 	],
// 	storage: { type: 'redis', options: { client: redis, invalidation: { referencesTTL: 60 }, log: console } },
// 	cacheTime: 60,
// 	excludeModels: ['project', 'like', 'comment'],
// 	excludeMethods: ['count', 'groupBy'],
// 	onHit: (key) => {
// 		console.log('hit', key);
// 	},
// 	onMiss: (key) => {
// 		console.log('miss', key);
// 	},
// 	onError: (key) => {
// 		console.log('error', key);
// 	},
// });

/**
 * Singleton Prisma client instance for database operations.
 * 
 * This client is configured to:
 * - Reuse existing instances in development (via global object)
 * - Create new instances in production
 * - Support optional query logging (currently disabled)
 * 
 * Usage:
 * ```typescript
 * import { prisma } from '@/lib/db';
 * const users = await prisma.user.findMany();
 * ```
 *
 * @type {PrismaClient}
 */
export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		// Enable query logging for debugging (uncomment to enable)
		// log: ['query'],
	});

/**
 * Redis cache middleware for Prisma (currently disabled).
 * 
 * When enabled, this middleware will cache Prisma queries using Redis.
 * See the cacheMiddleware configuration above for details on which models
 * and methods are cached.
 * 
 * To enable:
 * 1. Uncomment the cacheMiddleware definition above
 * 2. Uncomment the line below: prisma.$use(cacheMiddleware)
 */
// prisma.$use(cacheMiddleware);

/**
 * Store Prisma client in global object for development hot reloading.
 * 
 * In non-production environments, Next.js hot module replacement can cause
 * modules to be reloaded. By storing the Prisma client in the global object,
 * we ensure the same instance is reused, preventing database connection issues.
 */
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
