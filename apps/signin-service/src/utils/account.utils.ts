import { prisma } from '../config/prisma';

type AccountData = {
	walletAddress: string;
	email?: string;
	phone?: string;
};

/**
 * Creates a new account record in the database
 * @param data Account data including walletAddress and pk
 * @returns The created account record
 */
export async function createAccount(data: AccountData) {
	try {
		const account = await prisma.account.createMany({
			data: [
				{
					walletAddress: data.walletAddress,
					email: data.email,
					phone: data.phone,
					createdAt: Math.floor(Date.now() / 1000),
					updatedAt: Math.floor(Date.now() / 1000),
				},
			],
			skipDuplicates: true,
		});
		return account;
	} catch (error) {
		throw new Error(`Failed to create account: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Deletes an account record from the database
 * @param walletAddress The wallet address of the account to delete
 * @returns The deleted account record
 */
export async function deleteAccount(walletAddress: string) {
	try {
		const account = await prisma.account.delete({
			where: {
				walletAddress,
			},
		});
		return account;
	} catch (error) {
		throw new Error(`Failed to delete account: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Retrieves an account record by wallet address
 * @param walletAddress The wallet address to look up
 * @returns The account record if found, null otherwise
 */
export async function getAccount(walletAddress: string) {
	try {
		const account = await prisma.account.findUnique({
			where: {
				walletAddress,
			},
			select: {
				walletAddress: true,
				email: true,
				phone: true,
				createdAt: true,
				updatedAt: true,
			},
		});
		return account;
	} catch (error) {
		throw new Error(`Failed to get account: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
