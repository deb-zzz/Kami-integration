/**
 * Represents the request structure for whitelisting a user
 * At least one of the optional fields should be provided
 */
export type WhitelistRequest = {
	walletAddress?: string; // Optional wallet address for whitelist entry
	email?: string; // Optional email address for whitelist entry
	phoneNumber?: string; // Optional phone number for whitelist entry
};

/**
 * Represents the response structure after a successful whitelist operation
 */
export type WhitelistResponse = {
	id: number; // Unique identifier for the whitelist entry
	walletAddress: string | null; // Wallet address associated with the whitelist entry
	email: string | null; // Email address associated with the whitelist entry
	phoneNumber: string | null; // Phone number associated with the whitelist entry
	createdAt: number; // Unix timestamp when the whitelist entry was created
};
