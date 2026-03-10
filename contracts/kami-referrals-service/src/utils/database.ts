/**
 * @fileoverview Database utility functions for the Kami platform.
 * @description This file contains utility functions for interacting with the database.
 * @module utils/database
 */

import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Prisma client instance for database operations.
 * This is the default export and can be used directly for custom database queries.
 */
const prisma = new PrismaClient();

export default prisma;

/**
 * Response type for user referral points endpoint.
 */
export type UserReferralPointsResponse = {
	walletAddress: string;
	userName: string;
	referralPoints: number;
	sigilTokenId: number | null;
};

/**
 * Retrieves the first platform record from the database.
 * @returns The platform record, or null if none exists.
 */
export const getPlatform = async (): Promise<Prisma.platformGetPayload<{}> | null> => {
	const platform = await prisma.platform.findFirst();
	return platform;
};

/**
 * Retrieves the first blockchain record from the database.
 * @returns The blockchain record, or null if none exists.
 */
export const getBlockchain = async (): Promise<Prisma.blockchainGetPayload<{}> | null> => {
	const blockchain = await prisma.blockchain.findFirst();
	return blockchain;
};

/**
 * Updates a user's sigil token ID in the database.
 * @param walletAddress - The wallet address of the user to update.
 * @param tokenId - The sigil token ID to assign to the user.
 * @throws {Error} Throws an error if the user is not found.
 */
export const updateUserWithSigil = async (walletAddress: string, tokenId: number): Promise<void> => {
	const user = await prisma.user.findUnique({ where: { walletAddress } });
	if (!user) throw new Error('User not found');

	await prisma.user.update({
		where: { walletAddress },
		data: { sigilTokenId: tokenId },
	});
};

/**
 * Retrieves the referral points (sigil token ID) for a user.
 * Note: This function appears to return the sigil token ID, not referral points.
 * @param walletAddress - The wallet address of the user.
 * @returns The user's sigil token ID, or 0 if not set.
 * @throws {Error} Throws an error if the user is not found.
 */
export const getUserReferralPoints = async (walletAddress: string): Promise<UserReferralPointsResponse> => {
	try {
		const user = await prisma.user.findUnique({
			where: { walletAddress },
			select: { walletAddress: true, userName: true, referralPoints: true, sigilTokenId: true },
		});
		if (!user) throw new Error('User not found');
		return {
			walletAddress: user.walletAddress,
			userName: user.userName,
			referralPoints: user.referralPoints,
			sigilTokenId: user.sigilTokenId ?? null,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to get user referral points';
		throw new Error(errorMessage);
	}
};

/**
 * Adds referral points to a user's account.
 * @param walletAddress - The wallet address of the user.
 * @param points - The number of points to add.
 * @throws {Error} Throws an error if the user is not found.
 */
export const addReferralPoints = async (walletAddress: string, points: number): Promise<void> => {
	const user = await prisma.user.findUnique({ where: { walletAddress } });
	if (!user) throw new Error('User not found');
	await prisma.user.update({
		where: { walletAddress },
		data: { referralPoints: { increment: points } },
	});
};

/**
 * Subtracts referral points from a user's account.
 * @param walletAddress - The wallet address of the user.
 * @param points - The number of points to subtract.
 * @throws {Error} Throws an error if the user is not found.
 */
export const subtractReferralPoints = async (walletAddress: string, points: number): Promise<void> => {
	const user = await prisma.user.findUnique({ where: { walletAddress } });
	if (!user) throw new Error('User not found');
	await prisma.user.update({
		where: { walletAddress },
		data: { referralPoints: { decrement: points } },
	});
};

/**
 * Marks a referral code as used in the database.
 * @param code - The referral code to mark as used.
 * @throws {Error} Throws an error if the referral code is not found.
 */
export const setReferralCodeAsUsed = async (code: string): Promise<void> => {
	const referralCode = await prisma.referralCode.findUnique({ where: { code } });
	if (referralCode) {
		await prisma.referralCode.update({
			where: { code: referralCode.code },
			data: { used: true },
		});
		return;
	}
	const parentReferralCode = await prisma.parentReferralCode.findUnique({ where: { code } });
	if (parentReferralCode) {
		await prisma.parentReferralCode.update({ where: { code: parentReferralCode.code }, data: { used: true } });
		return;
	}
	throw new Error('Referral code not found');
};

/**
 * Marks a referral code as unused in the database.
 * @param code - The referral code to mark as unused.
 * @throws {Error} Throws an error if the referral code is not found.
 */
export const setReferralCodeAsUnused = async (code: string): Promise<void> => {
	const referralCode = await prisma.referralCode.findUnique({ where: { code } });
	if (referralCode) {
		await prisma.referralCode.update({ where: { code: referralCode.code }, data: { used: false } });
		return;
	}
	const parentReferralCode = await prisma.parentReferralCode.findUnique({ where: { code } });
	if (parentReferralCode) {
		await prisma.parentReferralCode.update({ where: { code: parentReferralCode.code }, data: { used: false } });
		return;
	}
	throw new Error('Referral code not found');
};

/**
 * Deletes a referral record from the database.
 * @param code - The code of the referral to delete.
 * @param walletAddress - The wallet address of the user being referred.
 * @returns True if the referral was deleted, false otherwise.
 */
export const deleteReferral = async (code: string, walletAddress: string): Promise<boolean> => {
	const referral = await prisma.referral.findUnique({ where: { code_walletAddress: { code, walletAddress } } });
	if (!referral) return false;
	await prisma.referral.delete({ where: { code_walletAddress: { code, walletAddress } } });
	return true;
};

/**
 * Retrieves a referral code by its code string.
 * @param code - The referral code to look up.
 * @returns The referral code record, or null if not found.
 */
export const getReferralCode = async (
	code: string
): Promise<Prisma.referralCodeGetPayload<{}> | Prisma.parentReferralCodeGetPayload<{}> | null> => {
	const referralCode = await prisma.referralCode.findUnique({ where: { code } });
	if (referralCode) return referralCode;
	const parentReferralCode = await prisma.parentReferralCode.findUnique({ where: { code } });
	if (parentReferralCode) return parentReferralCode;
	return null;
};

/**
 * Retrieves all referral codes associated with a user.
 * @param walletAddress - The wallet address of the user.
 * @returns The user record with their referral codes.
 * @throws {Error} Throws an error if the user is not found.
 */
export const getReferralCodesForUser = async (
	walletAddress: string
): Promise<Prisma.userGetPayload<{ include: { referralCodes: true } }>> => {
	const referralCodes = await prisma.user.findUnique({
		where: { walletAddress },
		include: { referralCodes: true },
	});
	if (!referralCodes) throw new Error('User not found');
	return referralCodes;
};

/**
 * Checks if a referral code is already used.
 * @param code - The referral code to check.
 * @returns True if the code is used, false otherwise.
 */
export const isReferralCodeUsed = async (code: string): Promise<boolean> => {
	const referralCode = await prisma.referralCode.findUnique({ where: { code } });
	if (referralCode) return referralCode.used;
	const parentReferralCode = await prisma.parentReferralCode.findUnique({ where: { code } });
	if (parentReferralCode) return parentReferralCode.used;
	throw new Error('Referral code not found');
};

/**
 * Creates a new referral record linking a wallet address to a referral code.
 * @param walletAddress - The wallet address of the user being referred.
 * @param code - The referral code being used.
 * @param source - Optional source identifier for the referral (e.g., 'twitter', 'discord').
 * @returns The newly created referral record.
 * @throws {Error} Throws an error if the referral code is not found.
 */
export const addReferral = async (walletAddress: string, code: string, source?: string): Promise<Prisma.referralGetPayload<{}>> => {
	const referralCode = await prisma.referralCode.findUnique({ where: { code } });
	if (referralCode) {
		if (walletAddress === referralCode.walletAddress)
			throw new Error('Wallet address cannot be the same as the referrer wallet address');
		const referredUser = await prisma.user.findUnique({ where: { walletAddress } });
		if (!referredUser) throw new Error('Referred user not found');
		const referral = await prisma.referral.create({
			data: {
				walletAddress,
				code: referralCode.code,
				createdAt: Math.floor(Date.now() / 1000),
				source: source ? source.toLowerCase() : undefined,
			},
		});
		return referral;
	}
	const parentReferralCode = await prisma.parentReferralCode.findUnique({ where: { code } });
	if (parentReferralCode) {
		const referredUser = await prisma.user.findUnique({ where: { walletAddress } });
		if (!referredUser) throw new Error('Referred user not found');
		const referral = await prisma.referral.create({
			data: {
				walletAddress,
				code: parentReferralCode.code,
				createdAt: Math.floor(Date.now() / 1000),
				source: source ? source.toLowerCase() : undefined,
			},
		});
		return referral;
	}
	throw new Error('Referral code not found');
};

/**
 * Retrieves all referral records for a specific user.
 * @param walletAddress - The wallet address of the user.
 * @returns An array of referral records for the user.
 */
export const getReferralsForUser = async (walletAddress: string): Promise<Prisma.referralGetPayload<{}>[]> => {
	try {
		const referrals = await prisma.referral.findMany({ where: { walletAddress } });
		return referrals;
	} catch (error) {
		return [];
	}
};

/**
 * Retrieves all referral records for a specific referral code.
 * @param code - The referral code to look up.
 * @returns An array of referral records using the specified code.
 */
export const getReferralsForCode = async (code: string): Promise<Prisma.referralGetPayload<{}>[]> => {
	try {
		const referrals = await prisma.referral.findMany({ where: { code } });
		return referrals;
	} catch (error) {
		return [];
	}
};

/**
 * Retrieves all referral records from a specific source.
 * @param source - The source identifier (e.g., 'twitter', 'discord').
 * @returns An array of referral records from the specified source.
 */
export const getReferralsForSource = async (source: string): Promise<Prisma.referralGetPayload<{}>[]> => {
	try {
		const referrals = await prisma.referral.findMany({ where: { source } });
		return referrals;
	} catch (error) {
		return [];
	}
};

/**
 * Get the leaderboard of referral points.
 * @returns An array of objects with the wallet address, user name, and the number of referral points.
 */
export const getLeaderboard = async (
	offset: number = 0,
	limit: number = 10
): Promise<{ walletAddress: string; userName: string; referralPoints: number }[]> => {
	const leaderboard = await prisma.user.findMany({
		orderBy: [{ referralPoints: 'desc' }, { userName: 'asc' }],
		skip: offset,
		take: limit,
		select: {
			walletAddress: true,
			userName: true,
			referralPoints: true,
		},
	});
	return leaderboard;
};

/**
 * Get the total number of referrals for a specific source.
 * @param source - The source identifier (e.g., 'twitter', 'discord').
 * @returns The total number of referrals for the specified source.
 */
export const getTotalReferralsForSource = async (source: string): Promise<number> => {
	const total = await prisma.referral.count({ where: { source } });
	return total;
};

/**
 * Get the total number of referrals for a specific user.
 * @param walletAddress - The wallet address of the user.
 * @returns The total number of referrals for the specified user.
 */
export const getTotalReferralsForUser = async (walletAddress: string): Promise<number> => {
	const total = await prisma.referral.count({ where: { walletAddress } });
	return total;
};

/**
 * Get a users sigil
 * @param walletAddress - The wallet address of the user.
 * @returns The sigil image URL for the user.
 * @throws {Error} Throws an error if the user is not found or if the sigil image URL is not found.
 */
export const getUserSigilId = async (walletAddress: string): Promise<number | null> => {
	const user = await prisma.user.findUnique({ where: { walletAddress }, select: { sigilTokenId: true } });
	if (!user) throw new Error('User not found');
	if (!user.sigilTokenId) return null;
	return user.sigilTokenId as number;
};

/** Add refgerral links for later analysis
 * @param walletAddress - The wallet address of the user.
 * @param link - The link to add.
 * @param source - The source of the link.
 * @returns The success message or the error message.
 */
export const addReferralLinks = async (
	walletAddress: string,
	link: string[],
	source?: string[]
): Promise<{ success: boolean; message: string }> => {
	try {
		const referralLinks = await prisma.referralLinks.createMany({
			data: link.map((link, index) => ({
				walletAddress,
				link,
				source: source?.[index] ? source[index].toLowerCase() : undefined,
				createdAt: Math.floor(Date.now() / 1000),
				updatedAt: Math.floor(Date.now() / 1000),
			})),
		});
		return { success: true, message: `Added ${referralLinks.count} referral links successfully` };
	} catch (error) {
		return { success: false, message: error instanceof Error ? error.message : 'Failed to add referral links' };
	}
};

/** Get all referral links for a user */
export const getReferralLinksForUser = async (walletAddress: string): Promise<Prisma.referralLinksGetPayload<{}>[]> => {
	const referralLinks = await prisma.referralLinks.findMany({ where: { walletAddress } });
	return referralLinks;
};

/* Check if referral link already exists */
export const checkIfReferralLinkExists = async (link: string[]): Promise<string[]> => {
	const referralLink = await prisma.referralLinks.findMany({ where: { link: { in: link } } });
	return referralLink.map((link) => link.link);
};

/** Update referral link quality */
export const updateReferralLinkQuality = async (linkId: string, quality: number): Promise<void> => {
	const referralLink = await prisma.referralLinks.findUnique({ where: { id: linkId } });
	if (!referralLink) throw new Error('Referral link not found');
	await prisma.referralLinks.update({ where: { id: linkId }, data: { quality } });
};

/**
 * Generates a random 6-digit code (000000 to 999999).
 * @returns A 6-digit code as a string with leading zeros.
 */
const generateSixDigitCode = (): string => {
	return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Checks if a code already exists in either referralCode or parentReferralCode tables.
 * @param code - The code to check.
 * @returns True if the code exists, false otherwise.
 */
const codeExists = async (code: string): Promise<boolean> => {
	const [inReferralCode, inParentReferralCode] = await Promise.all([
		prisma.referralCode.findUnique({ where: { code } }),
		prisma.parentReferralCode.findUnique({ where: { code } }),
	]);
	return inReferralCode !== null || inParentReferralCode !== null;
};

/**
 * Generates unique parent referral codes.
 * Each code is a 6-digit number that doesn't exist in referralCode or parentReferralCode tables,
 * and is unique within the current batch.
 * @param quantity - The number of codes to generate.
 * @throws {Error} Throws an error if unable to generate enough unique codes after maximum attempts.
 */
export const generateParentReferralCodes = async (quantity: number): Promise<string[]> => {
	const codes: string[] = [];
	const usedCodes = new Set<string>();
	const maxAttempts = quantity * 1000; // Maximum attempts to prevent infinite loops
	let attempts = 0;

	while (codes.length < quantity && attempts < maxAttempts) {
		attempts++;
		const code = generateSixDigitCode();

		// Skip if already generated in this batch
		if (usedCodes.has(code)) {
			continue;
		}

		// Check if code exists in database
		if (await codeExists(code)) {
			usedCodes.add(code);
			continue;
		}

		// Code is unique, add to batch
		codes.push(code);
		usedCodes.add(code);
	}

	if (codes.length < quantity) {
		throw new Error(`Failed to generate ${quantity} unique codes. Generated ${maxAttempts} attempts. Generated ${codes.length} codes.`);
	}

	const timestamp = Math.floor(Date.now() / 1000);
	const data = codes.map((code) => ({
		code,
		createdAt: timestamp,
	}));

	await prisma.parentReferralCode.createMany({
		data,
	});

	return codes;
};

/** Set parent points
 * @param parentCode - The parent code to set points for.
 * @param points - The number of points to set.
 * @returns The parent user
 */
export const setParentPoints = async (parentCode: string, points: number): Promise<Prisma.userGetPayload<{}> | null> => {
	const parent = await getParent(parentCode);
	if (!parent) throw new Error('Parent referral code not found');
	await addReferralPoints(parent.walletAddress, points);
	return parent;
};

/** Get parent
 * @param parentCode - The parent code to get points for.
 * @returns The parent user
 */
export const getParent = async (parentCode: string): Promise<Prisma.userGetPayload<{}> | null> => {
	const parentReferralCode = await prisma.parentReferralCode.findUnique({ where: { code: parentCode } });
	if (!parentReferralCode) return null;
	const referral = await prisma.referral.findFirst({ where: { code: parentCode } });
	if (!referral) return null;
	const parentUser = await prisma.user.findUnique({ where: { walletAddress: referral.walletAddress } });
	if (!parentUser) return null;
	return parentUser;
};
