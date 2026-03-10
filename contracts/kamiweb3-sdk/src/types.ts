import { ethers, Signer, BigNumberish, BytesLike } from 'ethers';

/**
 * Represents a signer capable of signing transactions or a provider for read-only access.
 * Can be an ethers Wallet, JsonRpcSigner, etc.
 */
export type SignerOrProvider = Signer | any;

/**
 * Structure for defining royalty recipients and their share.
 */
export interface RoyaltyData {
	receiver: string; // Address of the royalty recipient
	feeNumerator: BigNumberish; // Royalty percentage numerator (e.g., 500 for 5%)
}

/**
 * Structure for ERC2981 royalty info.
 */
export interface RoyaltyInfo {
	receiver: string;
	royaltyAmount: bigint;
}

/**
 * Structure for rental details returned by the contract.
 */
export interface RentalDetails {
	renter: string;
	startTime: bigint;
	endTime: bigint;
	rentalPrice: bigint;
	active: boolean;
}

// === Role Constants ===
// These are standard keccak256 hashes of the role names

/** Default admin role identifier (`bytes32(0)`). */
export const DEFAULT_ADMIN_ROLE: BytesLike = '0x0000000000000000000000000000000000000000000000000000000000000000';

/** Owner role identifier (`keccak256("OWNER_ROLE")`). Typically manages contract settings. */
export const OWNER_ROLE: BytesLike = '0x62e90394363c0c65b394931c5d711e17313d54945e70303c5f59e390ca312e41';

/** Platform role identifier (`keccak256("PLATFORM_ROLE")`). Typically receives platform fees. */
export const PLATFORM_ROLE: BytesLike = '0xcca28a504f5a679491a993faf8a0a648565a095744c9a0a61445b54935096959';

/** Renter role identifier (`keccak256("RENTER_ROLE")`). Granted to users actively renting. */
export const RENTER_ROLE: BytesLike = '0xfa4a388d366d36b64818ec5143f36a110a1b9a02a93906072ffe6a80f0e7a2d6';

/** Minter role identifier (`keccak256("MINTER_ROLE")`). Allowed to mint new tokens. */
export const MINTER_ROLE: BytesLike = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6';

/** Pauser role identifier (`keccak256("PAUSER_ROLE")`). Allowed to pause/unpause the contract. */
export const PAUSER_ROLE: BytesLike = '0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a';

/** Upgrader role identifier (`keccak256("UPGRADER_ROLE")`). Allowed to upgrade the contract (relevant for UUPS). */
export const UPGRADER_ROLE: BytesLike = '0x189ab7a9244df0848122154315af71fe140f3db0fe014031783b0946b8c9d2e3';

// Add other common types here as needed, e.g.:
// export type Address = string;
// export type TokenId = BigNumberish;
