import { PrismaClient } from '@prisma/client';

// NOTE: Prisma 6 removed $use() middleware. Redis caching can be re-added via
// Prisma Client extensions or an external cache layer.

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		// log: ['query'],
	});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
