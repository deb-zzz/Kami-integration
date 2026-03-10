import { PrismaClient } from '@prisma/client';

/**
 * Global object to store the Prisma client instance.
 * This helps in reusing the Prisma client across multiple invocations in a non-production environment.
 * @type {Object}
 */
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

/**
 * Initializes a Prisma client instance.
 *
 * If a Prisma client instance already exists in the global object (in non-production environments), it reuses that instance.
 * Otherwise, it creates a new Prisma client instance.
 *
 * @type {PrismaClient}
 */
export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		// log: ['query'],
	});

/**
 * In non-production environments, stores the Prisma client instance in the global object for reuse.
 */
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
