import { prisma } from '@/lib/db';

export async function isWhitelisted({
	walletAddress,
	email,
	phoneNumber,
}: {
	walletAddress?: string;
	email?: string;
	phoneNumber?: string;
}): Promise<boolean> {
	try {
		const numRecords = await prisma.whitelist.count();
		console.log(`Number of records in whitelist: ${numRecords}`);
		if (numRecords == 0) return true;

		if (walletAddress) {
			// Check if user already has a profile
			const profile = await prisma.user.findFirst({
				where: { walletAddress },
			});
			if (profile) return true;
		}

		const whitelistEntry = await prisma.whitelist.findFirst({
			where: {
				OR: [
					{ walletAddress: walletAddress || undefined },
					{ email: email || undefined },
					{ phoneNumber: phoneNumber || undefined },
				],
			},
		});

		return !!(whitelistEntry ?? undefined);
	} catch (error) {
		console.error('Error checking whitelist:', (error as Error).message);
		return false;
	}
}
