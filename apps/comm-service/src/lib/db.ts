import { PrismaClient } from '@prisma/client';

/**
 * Database Connection Management
 *
 * This module provides a singleton Prisma client instance that's properly
 * configured for both development and production environments. It implements
 * connection pooling and prevents multiple database connections during
 * hot reloads in development.
 */

/**
 * Global type declaration for Prisma client to enable proper typing
 * across the application while maintaining singleton pattern
 */
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

/**
 * Singleton Prisma client instance
 *
 * In development: Creates a new instance and stores it globally to prevent
 * multiple connections during hot reloads
 * In production: Creates a single instance for the application lifecycle
 *
 * @example
 * // Usage in other files:
 * import { prisma } from '@/lib/db';
 * const users = await prisma.user.findMany();
 */
export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		// Uncomment to enable query logging for debugging
		// log: ['query'],
	});

// In development, store the instance globally to prevent multiple connections
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
