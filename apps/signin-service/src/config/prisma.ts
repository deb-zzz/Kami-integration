import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * Global object to store the Prisma client instance.
 * This helps in reusing the Prisma client across multiple invocations in a non-production environment.
 */
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

/**
 * Initializes a Prisma client instance.
 *
 * If a Prisma client instance already exists in the global object (in non-production environments), it reuses that instance.
 * Otherwise, it creates a new Prisma client instance.
 */
export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
	});

/**
 * In non-production environments, stores the Prisma client instance in the global object for reuse.
 */
if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}

/**
 * Gracefully disconnect Prisma client
 */
export const disconnectPrisma = async (): Promise<void> => {
	try {
		await prisma.$disconnect();
		logger.info('Prisma client disconnected successfully');
	} catch (error) {
		logger.error('Error disconnecting Prisma client:', error);
	}
};
