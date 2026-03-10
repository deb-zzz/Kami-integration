import { prisma } from '@/lib/db';
import { registered } from '@prisma/client';

/**
 * Checks if a user is registered based on their email and wallet address.
 *
 * @param {Object} params - The parameters for the function.
 * @param {string} [params.email] - The email of the user.
 * @param {string} [params.walletAddress] - The wallet address of the user.
 * @returns {Promise<boolean>} - Returns a promise that resolves to true if the user is registered and false otherwise.
 */
export async function isRegistered({ email, walletAddress }: { email?: string; walletAddress?: string }): Promise<boolean> {
	try {
		if (!email || !walletAddress) {
			console.log('isRegistered: No email or wallet address provided');
			return false;
		}
		const registered = await prisma.registered.findUniqueOrThrow({
			where: { email },
		});
		await addToWhitelist(email, walletAddress);
		await addProfile(registered, walletAddress);
		await addTag(registered, walletAddress);
		return true;
	} catch (error) {
		console.error('isRegistered: ' + (error as Error).message);
		return false;
	}
}

/**
 * Adds an email to the whitelist if the whitelist is not empty.
 *
 * @param {string} email - The email to be added to the whitelist.
 * @throws Will throw an error if adding to the whitelist fails.
 */
async function addToWhitelist(email: string, walletAddress: string) {
	try {
		const count = await prisma.whitelist.count();
		if (count == 0) return;
		await prisma.whitelist.create({ data: { email, walletAddress, createdAt: Math.floor(Date.now() / 1000) } });
	} catch (error) {
		const err = new Error(`Error adding to whitelist: ${email}: ` + (error as Error).message);
		console.error(err.message);
		throw err;
	}
}

/**
 * Creates a user profile with the given registered data and wallet address.
 *
 * @param {registered} registered - The registered data of the user.
 * @param {string} walletAddress - The wallet address of the user.
 * @throws Will throw an error if creating the user profile fails.
 */
async function addProfile(registered: registered, walletAddress: string) {
	try {
		await prisma.user.create({
			data: {
				walletAddress,
				createdAt: Math.floor(Date.now() / 1000),
				userName: registered.name ?? registered.email.split('@')[0],
				description: registered.description,
				instagramUrl: registered.instagramHandle
					? `https://instagram.com/${registered.instagramHandle.replace('@', '')}`
					: undefined,
				xUrl: registered.xHandle ? `https://x.com/${registered.xHandle.replace('@', '')}` : undefined,
				youtubeUrl: registered.youtubeHandle ? `https://youtube.com/${registered.youtubeHandle.replace('@', '')}` : undefined,
				telegramUrl: registered.telegramHandle ? `https://t.me/${registered.telegramHandle.replace('@', '')}` : undefined,
			},
		});
	} catch (error) {
		const err = new Error(`Error adding profile: ${registered.email}/${walletAddress}: ` + (error as Error).message);
		console.error(err.message);
		throw err;
	}
}

/**
 * Adds a tag based on the user's interests if they exist.
 *
 * @param {registered} registered - The registered data of the user.
 * @throws Will throw an error if adding the tag fails.
 */
async function addTag(registered: registered, walletAddress: string) {
	if (!registered.interests) return;
	try {
		await prisma.tag.createMany({
			data: [{ tag: registered.interests.toUpperCase(), type: 'Interest', createdAt: Math.floor(Date.now() / 1000) }],
			skipDuplicates: true,
		});
		await prisma.tag.update({
			where: { type_tag: { type: 'Interest', tag: registered.interests.toUpperCase() } },
			data: {
				users: {
					connect: { walletAddress: walletAddress },
				},
			},
		});
	} catch (error) {
		const err = new Error(`Error adding tag: ${registered.email}/${registered.interests}: ` + (error as Error).message);
		console.error(err.message);
		throw err;
	}
}
