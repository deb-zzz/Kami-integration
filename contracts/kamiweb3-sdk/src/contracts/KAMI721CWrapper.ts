import { ethers, Contract, Signer, BigNumberish, BytesLike } from 'ethers';
import { arrayify } from 'ethers/lib/utils';
import {
	RoyaltyData,
	SignerOrProvider,
	RentalDetails,
	RoyaltyInfo,
	DEFAULT_ADMIN_ROLE,
	OWNER_ROLE,
	PLATFORM_ROLE,
	RENTER_ROLE,
	PAUSER_ROLE,
} from '../types';
import KAMI721CArtifact from '../abis/KAMI721C.json';
import KAMI721CUpgradeableArtifact from '../abis/KAMI721CUpgradeable.json';

/**
 * Wraps an instance of the KAMI721C contract (standard or upgradeable proxy) to provide typed methods.
 */
export class KAMI721CWrapper {
	public readonly contract: Contract;
	public readonly address: string;
	public readonly abi: any;

	/**
	 * Creates an instance of KAMI721CWrapper.
	 * @param address The address of the standard contract or the proxy contract.
	 * @param signerOrProvider A Signer (for transactions) or Provider (for read-only).
	 * @param contractAbi (Optional) The ABI to use. Defaults to the standard KAMI721C ABI. Provide the KAMI721CUpgradeable ABI when attaching to a proxy.
	 */
	constructor(address: string, signerOrProvider: SignerOrProvider, contractAbi?: any) {
		// Use provided ABI or default to standard KAMI721C ABI
		this.abi = contractAbi || KAMI721CArtifact.abi;

		if (!this.abi || this.abi.length === 0) {
			// Check if the default was attempted and failed
			if (!contractAbi && (!KAMI721CArtifact || !KAMI721CArtifact.abi)) {
				throw new Error('Default KAMI721C ABI not found or invalid.');
			} else {
				throw new Error('Provided ABI is invalid or ABI not found.');
			}
		}
		this.contract = new Contract(address.toString(), this.abi, signerOrProvider);
		this.address = address.toString();
	}

	// === Core ERC721 Functions ===

	/**
	 * Returns the number of tokens in `owner`'s account.
	 * @throws {Error} If owner is the zero address.
	 */
	async balanceOf(owner: string): Promise<bigint> {
		if (owner === '0x0000000000000000000000000000000000000000') throw new Error('ERC721: balance query for the zero address');
		return this.contract.balanceOf(owner);
	}

	/**
	 * Returns the owner of the `tokenId` token.
	 * @throws {Error} If the token does not exist.
	 */
	async ownerOf(tokenId: BigNumberish): Promise<string> {
		return this.contract.ownerOf(tokenId);
	}

	/**
	 * Safely transfers `tokenId` token from `from` to `to`.
	 * @throws {Error} If caller is not owner nor approved, or if `to` is zero address.
	 */
	async safeTransferFrom(from: string, to: string, tokenId: BigNumberish, data: BytesLike = '0x', overrides: any = {}): Promise<any> {
		this.requireSigner();
		if (to === '0x0000000000000000000000000000000000000000') throw new Error('ERC721: transfer to the zero address');
		// Ensure correct overload is called (based on presence/absence of data argument)
		if (data && data !== '0x' && arrayify(data).length > 0) {
			return this.contract['safeTransferFrom(address,address,uint256,bytes)'](from, to, tokenId, data, overrides);
		} else {
			return this.contract['safeTransferFrom(address,address,uint256)'](from, to, tokenId, overrides);
		}
	}

	/**
	 * Transfers `tokenId` token from `from` to `to`.
	 * Note: Usage of this method is discouraged, use `safeTransferFrom` whenever possible.
	 * @throws {Error} If caller is not owner nor approved, or if `to` is zero address.
	 */
	async transferFrom(from: string, to: string, tokenId: BigNumberish, overrides: any = {}): Promise<any> {
		this.requireSigner();
		if (to === '0x0000000000000000000000000000000000000000') throw new Error('ERC721: transfer to the zero address');
		return this.contract.transferFrom(from, to, tokenId, overrides);
	}

	/**
	 * Gives permission to `to` to transfer `tokenId` token to another account.
	 * The approval is cleared when the token is transferred.
	 * @throws {Error} If `to` is the zero address.
	 */
	async approve(to: string, tokenId: BigNumberish, overrides: any = {}): Promise<any> {
		this.requireSigner();
		if (to === '0x0000000000000000000000000000000000000000') throw new Error('ERC721: approve to the zero address');
		return this.contract.approve(to, tokenId, overrides);
	}

	/**
	 * Returns the account approved for `tokenId` token.
	 * @throws {Error} If the token does not exist.
	 */
	async getApproved(tokenId: BigNumberish): Promise<string> {
		return this.contract.getApproved(tokenId);
	}

	/**
	 * Approve or remove `operator` as an operator for the caller.
	 */
	async setApprovalForAll(operator: string, approved: boolean, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.setApprovalForAll(operator, approved, overrides);
	}

	/**
	 * Returns if the `operator` is allowed to manage all of the assets of `owner`.
	 */
	async isApprovedForAll(owner: string, operator: string): Promise<boolean> {
		return this.contract.isApprovedForAll(owner, operator);
	}

	/**
	 * Returns the token collection name.
	 */
	async name(): Promise<string> {
		return this.contract.name();
	}

	/**
	 * Returns the token collection symbol.
	 */
	async symbol(): Promise<string> {
		return this.contract.symbol();
	}

	/**
	 * Returns the Uniform Resource Identifier (URI) for `tokenId` token.
	 * @throws {Error} If the token does not exist.
	 */
	async tokenURI(tokenId: BigNumberish): Promise<string> {
		return this.contract.tokenURI(tokenId);
	}

	// === ERC721Enumerable Functions ===

	/**
	 * Returns the total amount of tokens stored by the contract.
	 */
	async totalSupply(): Promise<bigint> {
		const result = await this.contract.totalSupply();
		return BigInt(result.toString());
	}

	/**
	 * Returns a token ID owned by `owner` at a given `index` of its token list.
	 * Use along with {balanceOf} to enumerate all of ``owner``'s tokens.
	 * @throws {Error} If `index` >= `balanceOf(owner)` or `owner` is zero address.
	 */
	async tokenOfOwnerByIndex(owner: string, index: BigNumberish): Promise<bigint> {
		if (owner === '0x0000000000000000000000000000000000000000') throw new Error('Enumerable: owner index query for the zero address');
		return this.contract.tokenOfOwnerByIndex(owner, index);
	}

	/**
	 * Returns a token ID at a given `index` of all the tokens stored by the contract.
	 * Use along with {totalSupply} to enumerate all tokens.
	 * @throws {Error} If `index` >= `totalSupply()`.
	 */
	async tokenByIndex(index: BigNumberish): Promise<bigint> {
		return this.contract.tokenByIndex(index);
	}

	// === ERC2981 Royalty Standard ===

	/**
	 * Returns royalty information for a given token and sale price.
	 * @param tokenId The token ID to get royalty information for.
	 * @param salePrice The sale price to calculate royalties for.
	 * @returns RoyaltyInfo object containing receiver address and royalty amount.
	 */
	async royaltyInfo(tokenId: BigNumberish, salePrice: BigNumberish): Promise<RoyaltyInfo> {
		const result = await this.contract.royaltyInfo(tokenId, salePrice);
		return {
			receiver: result[0],
			royaltyAmount: result[1],
		};
	}

	// === KAMI721C Specific Functions ===

	/**
	 * Mints a new token to the caller.
	 * @throws {Error} If caller doesn't have sufficient USDC or approval.
	 */
	async mint(overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.mint(overrides);
	}

	/**
	 * Sells a token to a buyer for a specified price.
	 * @param to The address to sell the token to.
	 * @param tokenId The ID of the token to sell.
	 * @param salePrice The price to sell the token for.
	 * @throws {Error} If caller is not owner nor approved, or if buyer doesn't have sufficient USDC.
	 */
	async sellToken(to: string, tokenId: BigNumberish, salePrice: BigNumberish, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.sellToken(to, tokenId, salePrice, overrides);
	}

	/**
	 * Rents a token for a specified duration and price.
	 * @param tokenId The ID of the token to rent.
	 * @param duration The duration of the rental in seconds.
	 * @param rentalPrice The price for the rental.
	 * @throws {Error} If caller doesn't have sufficient USDC or approval.
	 */
	async rentToken(tokenId: BigNumberish, duration: BigNumberish, rentalPrice: BigNumberish, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.rentToken(tokenId, duration, rentalPrice, overrides);
	}

	/**
	 * Ends a rental for a token.
	 * @param tokenId The ID of the token to end the rental for.
	 * @throws {Error} If caller is not the renter or rental has already ended.
	 */
	async endRental(tokenId: BigNumberish, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.endRental(tokenId, overrides);
	}

	/**
	 * Extends a rental for a token with additional duration and payment.
	 * @param tokenId The ID of the token to extend the rental for.
	 * @param additionalDuration The additional duration in seconds.
	 * @param additionalPayment The additional payment for the extension.
	 * @throws {Error} If caller is not the renter or doesn't have sufficient USDC.
	 */
	async extendRental(
		tokenId: BigNumberish,
		additionalDuration: BigNumberish,
		additionalPayment: BigNumberish,
		overrides: any = {}
	): Promise<any> {
		this.requireSigner();
		return this.contract.extendRental(tokenId, additionalDuration, additionalPayment, overrides);
	}

	/**
	 * Gets rental details for a specific token.
	 * @param tokenId The ID of the token to get rental details for.
	 * @returns A promise that resolves to the rental details.
	 */
	async getRentalDetails(tokenId: BigNumberish): Promise<RentalDetails> {
		const result = await this.contract.getRentalInfo(tokenId);
		return {
			renter: result[0],
			startTime: BigInt(result[1].toString()),
			endTime: BigInt(result[2].toString()),
			rentalPrice: BigInt(result[3].toString()),
			active: result[4],
		};
	}

	/**
	 * Checks if a user has active rentals.
	 * @param user The address to check for active rentals.
	 * @returns True if the user has active rentals, false otherwise.
	 */
	async hasActiveRentals(user: string): Promise<boolean> {
		return this.contract.hasActiveRentals(user);
	}

	// === Royalty Management ===

	/**
	 * Sets mint royalties for the contract.
	 * @param royalties Array of RoyaltyData objects.
	 * @throws {Error} If caller doesn't have OWNER_ROLE.
	 */
	async setMintRoyalties(royalties: RoyaltyData[], overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.setMintRoyalties(royalties, overrides);
	}

	/**
	 * Sets transfer royalties for the contract.
	 * @param royalties Array of RoyaltyData objects.
	 * @throws {Error} If caller doesn't have OWNER_ROLE.
	 */
	async setTransferRoyalties(royalties: RoyaltyData[], overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.setTransferRoyalties(royalties, overrides);
	}

	/**
	 * Sets mint royalties for a specific token.
	 * @param tokenId The ID of the token to set royalties for.
	 * @param royalties Array of RoyaltyData objects.
	 * @throws {Error} If caller doesn't have OWNER_ROLE.
	 */
	async setTokenMintRoyalties(tokenId: BigNumberish, royalties: RoyaltyData[], overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.setTokenMintRoyalties(tokenId, royalties, overrides);
	}

	/**
	 * Sets transfer royalties for a specific token.
	 * @param tokenId The ID of the token to set royalties for.
	 * @param royalties Array of RoyaltyData objects.
	 * @throws {Error} If caller doesn't have OWNER_ROLE.
	 */
	async setTokenTransferRoyalties(tokenId: BigNumberish, royalties: RoyaltyData[], overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.setTokenTransferRoyalties(tokenId, royalties, overrides);
	}

	/**
	 * Gets mint royalty receivers for a token.
	 * @param tokenId The ID of the token to get royalty receivers for.
	 * @returns Array of RoyaltyData objects.
	 */
	async getMintRoyaltyReceivers(tokenId: BigNumberish): Promise<RoyaltyData[]> {
		const result = await this.contract.getMintRoyaltyReceivers(tokenId);
		console.log('DEBUG: getMintRoyaltyReceivers result:', result);
		console.log('DEBUG: result type:', typeof result);
		console.log('DEBUG: result length:', result.length);
		console.log('DEBUG: result[0]:', result[0]);

		// Handle different possible response formats
		if (Array.isArray(result)) {
			if (result.length === 0) {
				return [];
			}

			// Check if it's already in the expected format
			if (typeof result[0] === 'object' && result[0].receiver) {
				return result.map((item: any) => ({
					receiver: item.receiver,
					feeNumerator: BigInt(item.feeNumerator.toString()),
				}));
			}

			// Try the split format: [receiver1, receiver2, ..., fee1, fee2, ...]
			const halfLength = result.length / 2;
			const receivers = result.slice(0, halfLength);
			const fees = result.slice(halfLength);

			return receivers.map((receiver: string, index: number) => ({
				receiver,
				feeNumerator: BigInt(fees[index].toString()),
			}));
		}

		// Fallback: return empty array
		return [];
	}

	/**
	 * Gets transfer royalty receivers for a token.
	 * @param tokenId The ID of the token to get royalty receivers for.
	 * @returns Array of RoyaltyData objects.
	 */
	async getTransferRoyaltyReceivers(tokenId: BigNumberish): Promise<RoyaltyData[]> {
		const result = await this.contract.getTransferRoyaltyReceivers(tokenId);
		console.log('DEBUG: getTransferRoyaltyReceivers result:', result);
		console.log('DEBUG: result type:', typeof result);
		console.log('DEBUG: result length:', result.length);
		console.log('DEBUG: result[0]:', result[0]);

		// Handle different possible response formats
		if (Array.isArray(result)) {
			if (result.length === 0) {
				return [];
			}

			// Check if it's already in the expected format
			if (typeof result[0] === 'object' && result[0].receiver) {
				return result.map((item: any) => ({
					receiver: item.receiver,
					feeNumerator: BigInt(item.feeNumerator.toString()),
				}));
			}

			// Try the split format: [receiver1, receiver2, ..., fee1, fee2, ...]
			const halfLength = result.length / 2;
			const receivers = result.slice(0, halfLength);
			const fees = result.slice(halfLength);

			return receivers.map((receiver: string, index: number) => ({
				receiver,
				feeNumerator: BigInt(fees[index].toString()),
			}));
		}

		// Fallback: return empty array
		return [];
	}

	// === Configuration Functions ===

	/**
	 * Sets the mint price for the contract.
	 * @param newMintPrice The new mint price in USDC.
	 * @throws {Error} If caller doesn't have OWNER_ROLE.
	 */
	async setMintPrice(newMintPrice: BigNumberish, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.setMintPrice(newMintPrice, overrides);
	}

	/**
	 * Gets the current mint price.
	 * @returns The current mint price in USDC.
	 */
	async getMintPrice(): Promise<bigint> {
		const result = await this.contract.mintPrice();
		return BigInt(result.toString());
	}

	/**
	 * Sets the platform commission percentage and address.
	 * @param newPercentage The new commission percentage in basis points.
	 * @param newPlatformAddress The new platform address.
	 * @throws {Error} If caller doesn't have OWNER_ROLE.
	 */
	async setPlatformCommission(newPercentage: BigNumberish, newPlatformAddress: string, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.setPlatformCommission(newPercentage, newPlatformAddress, overrides);
	}

	/**
	 * Gets the platform address.
	 * @returns The platform address.
	 */
	async getPlatformAddress(): Promise<string> {
		return this.contract.platformAddress();
	}

	/**
	 * Gets the platform commission percentage.
	 * @returns The platform commission percentage in basis points.
	 */
	async getPlatformCommissionPercentage(): Promise<bigint> {
		const result = await this.contract.platformCommissionPercentage();
		return BigInt(result.toString());
	}

	/**
	 * Sets the base URI for token metadata.
	 * @param baseURI The new base URI.
	 * @throws {Error} If caller doesn't have OWNER_ROLE.
	 */
	async setBaseURI(baseURI: string, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.setBaseURI(baseURI, overrides);
	}

	/**
	 * Gets the base URI for token metadata.
	 * @returns The base URI.
	 */
	async getBaseURI(): Promise<string> {
		return this.contract.getBaseURI();
	}

	/**
	 * Gets the USDC token address.
	 * @returns The USDC token address.
	 */
	async usdc(): Promise<string> {
		return this.contract.usdc();
	}

	// === Pausable Functions ===

	/**
	 * Pauses the contract.
	 * @throws {Error} If caller doesn't have PAUSER_ROLE.
	 */
	async pause(overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.pause(overrides);
	}

	/**
	 * Checks if the contract is paused.
	 * @returns True if the contract is paused, false otherwise.
	 */
	async paused(): Promise<boolean> {
		return this.contract.paused();
	}

	/**
	 * Unpauses the contract.
	 * @throws {Error} If caller doesn't have PAUSER_ROLE.
	 */
	async unpause(overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.unpause(overrides);
	}

	// === Burning ===

	/**
	 * Burns a token.
	 * @param tokenId The ID of the token to burn.
	 * @throws {Error} If caller is not owner nor approved.
	 */
	async burn(tokenId: BigNumberish, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.burn(tokenId, overrides);
	}

	// === Access Control ===

	/**
	 * Checks if an account has a specific role.
	 * @param role The role to check.
	 * @param account The account to check.
	 * @returns True if the account has the role, false otherwise.
	 */
	async hasRole(role: BytesLike, account: string): Promise<boolean> {
		return this.contract.hasRole(role, account);
	}

	/**
	 * Gets the admin role for a specific role.
	 * @param role The role to get the admin for.
	 * @returns The admin role.
	 */
	async getRoleAdmin(role: BytesLike): Promise<string> {
		return this.contract.getRoleAdmin(role);
	}

	/**
	 * Grants a role to an account.
	 * @param role The role to grant.
	 * @param account The account to grant the role to.
	 * @throws {Error} If caller doesn't have the admin role.
	 */
	async grantRole(role: BytesLike, account: string, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.grantRole(role, account, overrides);
	}

	/**
	 * Revokes a role from an account.
	 * @param role The role to revoke.
	 * @param account The account to revoke the role from.
	 * @throws {Error} If caller doesn't have the admin role.
	 */
	async revokeRole(role: BytesLike, account: string, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.revokeRole(role, account, overrides);
	}

	/**
	 * Renounces a role from the caller.
	 * @param role The role to renounce.
	 * @throws {Error} If caller doesn't have the role.
	 */
	async renounceRole(role: BytesLike, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.renounceRole(role, overrides);
	}

	// === Utility Methods ===

	/**
	 * Requires that the current signerOrProvider is a Signer.
	 * @throws {Error} If the current signerOrProvider is not a Signer.
	 */
	private requireSigner(): Signer {
		if (!this.contract.signer) {
			throw new Error('This operation requires a signer');
		}
		return this.contract.signer;
	}

	/**
	 * Requires that the caller has a specific role.
	 * @param role The role to check.
	 * @param errorMessage The error message to throw if the caller doesn't have the role.
	 * @throws {Error} If the caller doesn't have the role.
	 */
	private async requireRole(role: BytesLike, errorMessage?: string): Promise<void> {
		const signer = this.requireSigner();
		const signerAddress = await signer.getAddress();
		const hasRole = await this.hasRole(role, signerAddress);
		if (!hasRole) {
			throw new Error(errorMessage || `Caller doesn't have role ${role}`);
		}
	}

	/**
	 * Creates a new wrapper instance connected to a different signer or provider.
	 * @param signerOrProvider The new signer or provider to connect to.
	 * @returns A new KAMI721CWrapper instance.
	 */
	connect(signerOrProvider: SignerOrProvider): KAMI721CWrapper {
		return new KAMI721CWrapper(this.address, signerOrProvider, this.abi);
	}
}
