import { PrismaClient } from '@prisma/client';
// import Redis from 'ioredis';
// import { createPrismaRedisCache } from 'prisma-redis-middleware';

/* eslint-disable @typescript-eslint/no-explicit-any */
// const redis: any = new Redis(process.env.REDIS_URL as string);

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

// const cacheMiddleware: Prisma.Middleware = createPrismaRedisCache({
// 	models: [
// 		{
// 			model: 'user',
// 			cacheTime: 60,
// 			excludeMethods: ['findMany', 'findFirst', 'findFirstOrThrow'],
// 			invalidateRelated: ['tags', 'like', 'comment', 'post', 'follows', 'followedBy'],
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

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		// log: ['query'],
	});

// prisma.$use(cacheMiddleware);
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
