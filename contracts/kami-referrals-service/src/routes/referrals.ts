/**
 * @fileoverview Referrals API routes for managing referral codes, tracking referrals,
 * retrieving leaderboards, and fetching user sigil information.
 * @module routes/referrals
 */

import { Router, Request, Response } from 'express';
import {
	addReferral,
	addReferralPoints,
	getLeaderboard,
	getReferralCode,
	getReferralCodesForUser,
	getReferralsForSource,
	getReferralsForUser,
	getUserReferralPoints,
	getUserSigilId,
	isReferralCodeUsed,
	setReferralCodeAsUsed,
	setReferralCodeAsUnused,
	updateUserWithSigil,
	UserReferralPointsResponse,
	getReferralsForCode,
	deleteReferral,
	addReferralLinks,
	checkIfReferralLinkExists,
	getReferralLinksForUser,
	updateReferralLinkQuality,
	generateParentReferralCodes,
	setParentPoints,
} from '../utils/database';
import { getUri, mint } from '../services/contract';
import { Prisma } from '@prisma/client';
import type { Address } from 'viem';

const router: Router = Router();

/**
 * Request body type for creating a new referral.
 */
type ReferralRequest = {
	/** The referral code to associate with the user */
	code: string;
	/** The source/platform where the referral originated */
	source?: string;
	/** The wallet address of the user being referred */
	walletAddress: string;
	/** Whether the user is an existing user */
	existingUser?: boolean;
};

type ReferralPointsResponse = {
	success: boolean;
	totalPoints: number;
};

/**
 * Request query parameters for paginating the leaderboard.
 */
type LeaderboardRequest = {
	/** Number of records to skip (for pagination) - comes as string from query */
	offset?: string;
	/** Maximum number of records to return - comes as string from query */
	limit?: string;
};

/**
 * Request query parameters for wallet-based queries.
 */
type WalletRequest = {
	/** The wallet address to query */
	walletAddress?: string;
};

/**
 * Request query parameters for source-based referral queries.
 */
type ReferralsSourceRequest = {
	/** The source/platform to filter referrals by */
	source?: string;
};

/**
 * Response type for referral creation endpoint.
 */
type ReferralResponse = {
	referral: Prisma.referralGetPayload<{}>;
};

/**
 * Error response type.
 */
type ErrorResponse = {
	error: string;
};

type SuccessResponse = {
	success: boolean;
};

/**
 * POST /referral
 * Creates a new referral entry for a user.
 *
 * @route POST /referral
 * @param {ReferralRequest} req.body - The referral data containing code, source, and walletAddress
 * @returns {Object} 200 - Success response with the created referral object
 * @returns {Object} 400 - Bad request if required fields are missing
 * @example
 * // Request body:
 * {
 *   "code": "REF123",
 *   "source": "twitter",
 *   "walletAddress": "0x123..."
 * }
 */
router.post(
	'/referral',
	async (req: Request<{}, ReferralResponse | ErrorResponse, ReferralRequest>, res: Response<ReferralResponse | ErrorResponse>) => {
		try {
			const { code, source, walletAddress, existingUser = false }: ReferralRequest = req.body;
			if (!code || !walletAddress) {
				return res.status(400).json({ error: 'Code and walletAddress are required' });
			}

			// check if the code is already used
			const referralCode = await getReferralCode(code);
			if (!referralCode) {
				return res.status(400).json({ error: 'Referral code not found' });
			}
			if (referralCode.used) {
				return res.status(400).json({ error: 'Code is already used' });
			}

			// Add the referral
			const referral = await addReferral(walletAddress, code, source);

			// If the user is an existing user, return the referral without adding points
			if (existingUser) {
				res.json({ referral });
				return;
			}

			// Add the referral points
			if (referralCode && 'walletAddress' in referralCode && referralCode.walletAddress !== walletAddress) {
				const referrerWalletAddress = referralCode.walletAddress;

				await addReferralPoints(referrerWalletAddress, process.env.REFERRAL_POINTS ? parseInt(process.env.REFERRAL_POINTS) : 100);

				// Set the code as used
				await setReferralCodeAsUsed(code);

				// Check if all the referrer's referral codes are used (bonus for referrer, not referred user)
				const referrerCodes = await getReferralCodesForUser(referrerWalletAddress);
				if (referrerCodes.referralCodes.length > 0 && referrerCodes.referralCodes.every((code) => code.used)) {
					await addReferralPoints(
						referrerWalletAddress,
						process.env.POINTS_ALL_USED ? parseInt(process.env.POINTS_ALL_USED) : 100
					);
				}
			} else {
				// Set the parent code as used
				await setReferralCodeAsUsed(code);
			}

			// Set parent points
			if (referralCode && 'parentCode' in referralCode && referralCode.parentCode) {
				const parent = await setParentPoints(
					referralCode.parentCode,
					process.env.POINTS_FOR_PARENT ? parseInt(process.env.POINTS_FOR_PARENT) : 0
				);
				// Set grandparent points
				if (parent) {
					await addReferralPoints(
						parent.walletAddress,
						process.env.POINTS_FOR_GRANDPARENT ? parseInt(process.env.POINTS_FOR_GRANDPARENT) : 0
					);
				}
			}

			res.json({ referral });
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to create referral';
			res.status(500).json({ error: errorMessage });
		}
	}
);

/**
 * Response type for referrals list endpoint.
 */
type ReferralsResponse = {
	referrals: Prisma.referralGetPayload<{}>[];
};

/**
 * GET /referrals
 * Retrieves all referrals associated with a specific wallet address.
 *
 * @route GET /referrals
 * @param {string} req.query.walletAddress - The wallet address to query referrals for
 * @returns {Object} 200 - Success response with an array of referrals
 * @returns {Object} 400 - Bad request if wallet address is missing
 * @example
 * // Request: GET /referrals?walletAddress=0x123...
 * // Response:
 * {
 *   "referrals": [...]
 * }
 */
router.get(
	'/referrals',
	async (req: Request<{}, ReferralsResponse | ErrorResponse, {}, WalletRequest>, res: Response<ReferralsResponse | ErrorResponse>) => {
		try {
			const { walletAddress } = req.query;
			if (!walletAddress || typeof walletAddress !== 'string') {
				return res.status(400).json({ error: 'Wallet address is required' });
			}
			const referrals = await getReferralsForUser(walletAddress);
			res.json({ referrals });
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to get referrals';
			res.status(500).json({ error: errorMessage });
		}
	}
);

/**
 * GET /referrals/source
 * Retrieves all referrals filtered by a specific source/platform.
 *
 * @route GET /referrals/source
 * @param {string} req.query.source - The source/platform to filter referrals by
 * @returns {Object} 200 - Success response with an array of referrals from the specified source
 * @returns {Object} 400 - Bad request if source is missing
 * @example
 * // Request: GET /referrals/source?source=twitter
 * // Response:
 * {
 *   "referrals": [...]
 * }
 */
router.get(
	'/referrals/source',
	async (
		req: Request<{}, ReferralsResponse | ErrorResponse, {}, ReferralsSourceRequest>,
		res: Response<ReferralsResponse | ErrorResponse>
	) => {
		try {
			const { source } = req.query;
			if (!source || typeof source !== 'string') {
				return res.status(400).json({ error: 'Source is required' });
			}
			const referrals = await getReferralsForSource(source);
			res.json({ referrals });
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to get referrals by source';
			res.status(500).json({ error: errorMessage });
		}
	}
);

/**
 * Response type for leaderboard endpoint.
 */
type LeaderboardResponse = {
	leaderboard: { walletAddress: string; userName: string; referralPoints: number }[];
};

/**
 * GET /leaderboard
 * Retrieves the referral leaderboard with optional pagination.
 *
 * @route GET /leaderboard
 * @param {number} [req.query.offset] - Number of records to skip (for pagination)
 * @param {number} [req.query.limit] - Maximum number of records to return
 * @returns {Object} 200 - Success response with leaderboard data
 * @example
 * // Request: GET /leaderboard?offset=0&limit=10
 * // Response:
 * {
 *   "leaderboard": [...]
 * }
 */
router.get(
	'/leaderboard',
	async (
		req: Request<{}, LeaderboardResponse | ErrorResponse, {}, LeaderboardRequest>,
		res: Response<LeaderboardResponse | ErrorResponse>
	) => {
		try {
			const { offset, limit } = req.query;
			const parsedOffset = offset ? parseInt(offset, 10) : undefined;
			const parsedLimit = limit ? parseInt(limit, 10) : undefined;

			if (parsedOffset !== undefined && (isNaN(parsedOffset) || parsedOffset < 0)) {
				return res.status(400).json({ error: 'Invalid offset parameter' });
			}
			if (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit < 0)) {
				return res.status(400).json({ error: 'Invalid limit parameter' });
			}

			const leaderboard = await getLeaderboard(parsedOffset, parsedLimit);
			res.json({ leaderboard });
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to get leaderboard';
			res.status(500).json({ error: errorMessage });
		}
	}
);

/**
 * GET /userReferralPoints
 * Retrieves the total referral points for a specific wallet address.
 *
 * @route GET /userReferralPoints
 * @param {string} req.query.walletAddress - The wallet address to query points for
 * @returns {UserReferralPointsResponse} 200 - Success response with the user's referral points
 * @returns {Object} 400 - Bad request if wallet address is missing
 * @example
 * // Request: GET /userReferralPoints?walletAddress=0x123...
 * // Response:
 * {
 *   "walletAddress": "0x123...",
 *   "userName": "user123",
 *   "referralPoints": 150,
 *   "sigilTokenId": 1
 * }
 */
router.get(
	'/userReferralPoints',
	async (
		req: Request<{}, UserReferralPointsResponse | ErrorResponse, {}, WalletRequest>,
		res: Response<UserReferralPointsResponse | ErrorResponse>
	) => {
		try {
			const { walletAddress } = req.query;
			if (!walletAddress || typeof walletAddress !== 'string') {
				return res.status(400).json({ error: 'Wallet address is required' });
			}
			const points = await getUserReferralPoints(walletAddress);
			res.json(points);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to get user referral points';
			res.status(500).json({ error: errorMessage });
		}
	}
);

/**
 * Response type for sigil endpoint.
 */
type SigilResponse = {
	sigil: string;
};

/**
 * GET /sigil
 * Retrieves the sigil URI (metadata) for a user's wallet address.
 * Fetches the sigil ID from the database and then retrieves the URI from the smart contract.
 *
 * @route GET /sigil
 * @param {string} req.query.walletAddress - The wallet address to query sigil for
 * @returns {SigilResponse} 200 - Success response with the sigil URI
 * @returns {Object} 400 - Bad request if wallet address is missing
 * @returns {Object} 500 - Internal server error if sigil ID or URI cannot be fetched
 * @example
 * // Request: GET /sigil?walletAddress=0x123...
 * // Response:
 * {
 *   "sigil": {
 *     "metadataUrl": "https://www.kamiunlimited.com/sigils/1.json",
 *     "type": 1
 *   }
 * }
 */
router.get(
	'/sigil',
	async (req: Request<{}, SigilResponse | ErrorResponse, {}, WalletRequest>, res: Response<SigilResponse | ErrorResponse>) => {
		const { walletAddress } = req.query;
		if (!walletAddress || typeof walletAddress !== 'string') {
			return res.status(400).json({ error: 'Wallet address is required' });
		}
		try {
			const sigilId = await getUserSigilId(walletAddress);
			if (sigilId == null) {
				return res.status(400).json({ error: 'User does not have a sigil' });
			}
			try {
				const contractAddress = process.env.CONTRACT_ADDRESS as Address | undefined;
				const uri = await getUri(BigInt(sigilId), contractAddress);
				res.json({ sigil: uri });
			} catch (e: unknown) {
				const errorMessage = e instanceof Error ? e.message : 'Failed to fetch URI for sigil';
				return res.status(500).json({ error: errorMessage });
			}
		} catch (e: unknown) {
			const errorMessage = e instanceof Error ? e.message : 'Unknown error';
			return res.status(500).json({ error: `Failed to fetch URI for sigil: ${errorMessage}` });
		}
	}
);

/**
 * Response type for create sigil endpoint.
 */
type CreateSigilResponse = {
	success: boolean;
	sigil: { metadataUrl: string; type: number };
};

/**
 * Error response type for create sigil endpoint.
 */
type CreateSigilErrorResponse = {
	success: false;
	error: string;
};

/**
 * Create a Sigil NFT for a user
 * @route POST /createSigil
 * @param {string} req.body.walletAddress - The wallet address to create a sigil for
 * @param {number} req.body.tokenId - The token ID of the sigil to create
 * @returns {CreateSigilResponse} 200 - Success response with the created sigil object
 * @returns {CreateSigilErrorResponse} 400 - Bad request if wallet address is missing or token ID is not between 1 and 6
 * @returns {CreateSigilErrorResponse} 500 - Internal server error if sigil cannot be created
 * @example
 * // Request: POST /createSigil
 * // Request body:
 * {
 *   "walletAddress": "0x123...",
 *   "tokenId": 1
 * }
 * // Response:
 * {
 *   "success": true,
 *   "sigil": {
 *     "metadataUrl": "https://www.kamiunlimited.com/sigils/1.json",
 *     "type": 1
 *   }
 * }
 */
router.post(
	'/createSigil',
	async (
		req: Request<{}, CreateSigilResponse | ErrorResponse, { walletAddress: string; tokenId: number }>,
		res: Response<CreateSigilResponse | ErrorResponse>
	) => {
		const { walletAddress, tokenId } = req.body;
		if (!walletAddress || typeof walletAddress !== 'string') {
			return res.status(400).json({ success: false, error: 'Wallet address is required' });
		}
		if (typeof tokenId !== 'number' || tokenId < 1 || tokenId > 6) {
			return res.status(400).json({ success: false, error: 'Token ID must be between 1 and 6' });
		}
		try {
			const hasSigil = await getUserSigilId(walletAddress);
			if (hasSigil != null) {
				return res.status(400).json({ success: false, error: 'User already has a sigil' });
			}
			await mint(BigInt(tokenId), BigInt(1), walletAddress as Address);
			await updateUserWithSigil(walletAddress, tokenId);
			const uri = await getUri(BigInt(tokenId), process.env.CONTRACT_ADDRESS as Address | undefined);
			res.json({ success: true, sigil: { metadataUrl: uri, type: tokenId } });
		} catch (e: unknown) {
			const errorMessage = e instanceof Error ? e.message : 'Failed to mint sigil';
			return res.status(500).json({ success: false, error: errorMessage });
		}
	}
);

type ReferralCodesResponse = {
	referralCodes: Prisma.referralCodeGetPayload<{}>[];
};

/** get all referral codes for user
 * @route GET /referralCodes
 * @param {string} req.query.walletAddress - The wallet address to query referral codes for
 * @returns {ReferralCodesResponse} 200 - Success response with an array of referral codes
 * @returns {Object} 400 - Bad request if wallet address is missing
 * @example
 * // Request: GET /referralCodes?walletAddress=0x123...
 * // Response:
 * {
 *   "referralCodes": [...]
 * }
 */
router.get(
	'/referralCodes',
	async (
		req: Request<{}, ReferralCodesResponse | ErrorResponse, {}, WalletRequest>,
		res: Response<ReferralCodesResponse | ErrorResponse>
	) => {
		try {
			const walletAddress = req.query.walletAddress as string | undefined;
			if (!walletAddress || typeof walletAddress !== 'string') {
				return res.status(400).json({ error: 'Wallet address is required' });
			}
			const referralCodes = await getReferralCodesForUser(walletAddress);
			res.json({ referralCodes: referralCodes.referralCodes });
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to get referral codes';
			return res.status(500).json({ error: errorMessage });
		}
	}
);

/** Add referral points to a user */
router.post(
	'/addReferralPoints',
	async (
		req: Request<{}, ReferralPointsResponse | ErrorResponse, { walletAddress: string; pointsToAdd: number }>,
		res: Response<ReferralPointsResponse | ErrorResponse>
	) => {
		try {
			const { walletAddress, pointsToAdd } = req.body;
			if (!walletAddress || typeof walletAddress !== 'string') {
				return res.status(400).json({ error: 'Wallet address is required' });
			}
			if (!pointsToAdd || typeof pointsToAdd !== 'number' || pointsToAdd <= 0) {
				return res.status(400).json({ error: 'Points to add are required and must be greater than 0' });
			}
			await addReferralPoints(walletAddress, pointsToAdd);
			const totalPoints = await getUserReferralPoints(walletAddress);
			res.json({ success: true, totalPoints: totalPoints.referralPoints });
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to add referral points';
			return res.status(500).json({ success: false, error: errorMessage });
		}
	}
);

/** Set referral code as unused */
router.post(
	'/setReferralCodeAsUnused',
	async (
		req: Request<{}, SuccessResponse | ErrorResponse, { code: string; force?: boolean }>,
		res: Response<SuccessResponse | ErrorResponse>
	) => {
		const { code, force = false } = req.body;
		if (!code || typeof code !== 'string') {
			return res.status(400).json({ error: 'Code is required' });
		}
		try {
			if (await isReferralCodeUsed(code)) {
				const referrals = await getReferralsForCode(code);
				if (referrals.length > 0 && !force) {
					return res.status(400).json({ error: 'Code already has referrals' });
				} else if (referrals.length > 0 && force) {
					for (const referral of referrals) {
						await deleteReferral(code, referral.walletAddress);
					}
				}
				await setReferralCodeAsUnused(code);
			}
			res.status(200).json({ success: true });
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to set referral code as unused';
			return res.status(500).json({ success: false, error: errorMessage });
		}
	}
);

type AddReferralLinksErrorResponse = ErrorResponse & {
	success: false;
	existingLinks?: string[];
};

/** Add referral links to the database */
router.post(
	'/addReferralLinks',
	async (
		req: Request<{}, SuccessResponse | AddReferralLinksErrorResponse, { walletAddress: string; links: string[]; sources?: string[] }>,
		res: Response<SuccessResponse | AddReferralLinksErrorResponse>
	) => {
		const { walletAddress, links, sources } = req.body;
		if (!walletAddress || typeof walletAddress !== 'string') {
			return res.status(400).json({ success: false, error: 'Wallet address is required' });
		}
		if (!links || !Array.isArray(links) || links.length === 0) {
			return res.status(400).json({ success: false, error: 'Links are required' });
		}
		const existingLinks = await checkIfReferralLinkExists(links);
		if (existingLinks.length > 0) {
			return res.status(400).json({ success: false, existingLinks: existingLinks, error: 'Some links already exist' });
		}
		if (sources && (!Array.isArray(sources) || sources.length !== links.length)) {
			return res.status(400).json({ success: false, error: 'If provided, sources must be an array of the same length as links' });
		}
		const result = await addReferralLinks(walletAddress, links, sources);
		res.status(200).json({ success: result.success });
	}
);

type ReferralLinksResponse = {
	success: true;
	referralLinks: Prisma.referralLinksGetPayload<{}>[] | { link: string; source?: string }[];
};

/** Get referral links for a user
 * @route GET /referralLinks
 * @param {string} req.query.walletAddress - The wallet address to query referral links for
 * @returns {ReferralLinksResponse} 200 - Success response with an array of referral links
 * @returns {Object} 400 - Bad request if wallet address is missing
 * @example
 * // Request: GET /referralLinks?walletAddress=0x123...
 * // Response:
 * {
 *   "referralLinks": [...]
 */
router.get(
	'/referralLinks',
	async (
		req: Request<{}, ReferralLinksResponse | ErrorResponse, {}, WalletRequest>,
		res: Response<ReferralLinksResponse | ErrorResponse>
	) => {
		const { walletAddress, full } = req.query as { walletAddress: string; full?: boolean };
		if (!walletAddress || typeof walletAddress !== 'string') {
			return res.status(400).json({ error: 'Wallet address is required' });
		}
		try {
			const referralLinks = await getReferralLinksForUser(walletAddress as string);
			if (full) {
				return res.json({ success: true, referralLinks: referralLinks as Prisma.referralLinksGetPayload<{}>[] });
			} else {
				return res.json({
					success: true,
					referralLinks: referralLinks.map((link) => ({ link: link.link, source: link.source })) as {
						link: string;
						source?: string;
					}[],
				});
			}
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to get referral links';
			return res.status(500).json({ error: errorMessage });
		}
	}
);

/** Update referral link quality
 * @route PUT /updateReferralLinkQuality
 * @param {number} req.body.linkId - The ID of the link to update
 * @param {number} req.body.quality - The quality of the link
 * @returns {SuccessResponse | ErrorResponse} 200 - Success response or error response
 * @returns {Object} 400 - Bad request if link ID or quality is missing
 * @example
 */
router.put(
	'/updateReferralLinkQuality',
	async (
		req: Request<{}, SuccessResponse | ErrorResponse, { linkId: string; quality: number }>,
		res: Response<SuccessResponse | ErrorResponse>
	) => {
		const { linkId, quality } = req.body as { linkId: string; quality: number };
		if (!linkId || typeof linkId !== 'string') {
			return res.status(400).json({ error: 'Link is required' });
		}
		if (!quality || typeof quality !== 'number' || quality < 1 || quality > 100) {
			return res.status(400).json({ error: 'Quality must be between 1 and 100' });
		}
		try {
			await updateReferralLinkQuality(linkId, quality);
			res.status(200).json({ success: true });
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to update referral link quality';
			return res.status(500).json({ success: false, error: errorMessage });
		}
	}
);

type GenerateParentReferralCodesResponse = {
	success: true;
	codes: string[];
};

/** Generate parent referral codes */
/**
 * @route PATCH /generateParentReferralCodes
 * @param {number} req.body.quantity - The number of codes to generate
 * @returns {GenerateParentReferralCodesResponse} 200 - Success response with an array of codes
 * @returns {Object} 400 - Bad request if quantity is missing or not between 1 and 100
 * @returns {Object} 500 - Internal server error if parent referral codes cannot be generated
 */
router.patch(
	'/generateParentReferralCodes',
	async (
		req: Request<{}, GenerateParentReferralCodesResponse | ErrorResponse, { quantity: number }>,
		res: Response<GenerateParentReferralCodesResponse | ErrorResponse>
	) => {
		const { quantity } = req.body as { quantity: number };
		if (!quantity || typeof quantity !== 'number' || quantity < 1 || quantity > 100) {
			return res.status(400).json({ error: 'Quantity must be between 1 and 100' });
		}
		try {
			const codes = await generateParentReferralCodes(quantity);
			res.status(200).json({ success: true, codes: codes });
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to generate parent referral codes';
			return res.status(500).json({ error: errorMessage });
		}
	}
);

export default router;
