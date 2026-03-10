import { ethers, Contract, Signer, BigNumberish, BytesLike } from 'ethers';
import {
	RoyaltyData,
	SignerOrProvider,
	RentalDetails,
	DEFAULT_ADMIN_ROLE,
	OWNER_ROLE,
	PLATFORM_ROLE,
	RENTER_ROLE,
	MINTER_ROLE,
	PAUSER_ROLE,
} from '../types';
import KAMI1155CArtifact from '../abis/KAMI1155C.json';
import KAMI1155CUpgradeableArtifact from '../abis/KAMI1155CUpgradeable.json';

/**
 * Wraps an instance of the KAMI1155C contract (standard or upgradeable proxy) to provide typed methods.
 */
export class KAMI1155CWrapper {
	public readonly contract: Contract;
	public readonly address: string;
	public readonly abi: any;

	/**
	 * Creates an instance of KAMI1155CWrapper.
	 * @param address The address of the standard contract or the proxy contract.
	 * @param signerOrProvider A Signer (for transactions) or Provider (for read-only).
	 * @param contractAbi (Optional) The ABI to use. Defaults to the standard KAMI1155C ABI. Provide the KAMI1155CUpgradeable ABI when attaching to a proxy.
	 */
	constructor(address: string, signerOrProvider: SignerOrProvider, contractAbi?: any) {
		// Use provided ABI or default to standard KAMI1155C ABI
		this.abi = contractAbi || KAMI1155CArtifact.abi;

		if (!this.abi || this.abi.length === 0) {
			if (!contractAbi && (!KAMI1155CArtifact || !KAMI1155CArtifact.abi)) {
				throw new Error('Default KAMI1155C ABI not found or invalid.');
			} else {
				throw new Error('Provided ABI is invalid or ABI not found.');
			}
		}
		this.contract = new Contract(address.toString(), this.abi, signerOrProvider);
		this.address = address.toString();
	}

	// === Core ERC1155 Functions ===

	/**
	 * Gets the balance of a specific token ID for an account.
	 * @param account The address of the account.
	 * @param id The ID of the token.
	 * @returns A promise that resolves to the balance.
	 */
	async balanceOf(account: string, id: BigNumberish): Promise<bigint> {
		const result = await this.contract.balanceOf(account, id);
		return BigInt(result.toString());
	}

	/**
	 * Gets the balances of multiple token IDs for multiple accounts.
	 * @param accounts An array of account addresses.
	 * @param ids An array of token IDs.
	 * @returns A promise that resolves to an array of balances.
	 */
	async balanceOfBatch(accounts: string[], ids: BigNumberish[]): Promise<bigint[]> {
		if (accounts.length !== ids.length) {
			throw new Error('accounts and ids arrays must have the same length');
		}
		const result = await this.contract.balanceOfBatch(accounts, ids);
		return result.map((balance: any) => BigInt(balance.toString()));
	}

	/**
	 * Safely transfers tokens from one address to another.
	 * Requires the caller to be the owner, approved, or the approved operator.
	 * @param from The address to transfer from.
	 * @param to The address to transfer to.
	 * @param id The ID of the token to transfer.
	 * @param amount The amount of tokens to transfer.
	 * @param data Additional data with no specified format.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async safeTransferFrom(
		from: string,
		to: string,
		id: BigNumberish,
		amount: BigNumberish,
		data: BytesLike,
		overrides: any = {}
	): Promise<any> {
		this.requireSigner();
		const tx = await this.contract.safeTransferFrom(from, to, id, amount, data, overrides);
		return tx;
	}

	/**
	 * Safely transfers multiple token types from one address to another.
	 * Requires the caller to be the owner, approved, or the approved operator.
	 * @param from The address to transfer from.
	 * @param to The address to transfer to.
	 * @param ids An array of token IDs to transfer.
	 * @param amounts An array of amounts corresponding to each token ID.
	 * @param data Additional data with no specified format.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async safeBatchTransferFrom(
		from: string,
		to: string,
		ids: BigNumberish[],
		amounts: BigNumberish[],
		data: BytesLike,
		overrides: any = {}
	): Promise<any> {
		this.requireSigner();
		if (ids.length !== amounts.length) {
			throw new Error('ids and amounts arrays must have the same length');
		}
		const tx = await this.contract.safeBatchTransferFrom(from, to, ids, amounts, data, overrides);
		return tx;
	}

	/**
	 * Enables or disables approval for a third party ("operator") to manage all of the caller's tokens.
	 * @param operator Address to add to the set of authorized operators.
	 * @param approved True if the operator is approved, false to revoke approval.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async setApprovalForAll(operator: string, approved: boolean, overrides: any = {}): Promise<any> {
		this.requireSigner();
		const tx = await this.contract.setApprovalForAll(operator, approved, overrides);
		return tx;
	}

	/**
	 * Queries the approval status of an operator for a given owner.
	 * @param owner The owner of the tokens.
	 * @param operator The address of the operator.
	 * @returns True if the operator is approved, false otherwise.
	 */
	async isApprovedForAll(owner: string, operator: string): Promise<boolean> {
		return this.contract.isApprovedForAll(owner, operator);
	}

	/**
	 * Returns the URI for a given token ID.
	 * @param id The ID of the token.
	 * @returns A promise that resolves to the URI string.
	 */
	async uri(id: BigNumberish): Promise<string> {
		return this.contract.uri(id);
	}

	/**
	 * Returns the next token ID to be minted.
	 * @returns A promise that resolves to the next token ID.
	 */
	async nextTokenId(): Promise<bigint> {
		const result = await this.contract.nextTokenId();
		return BigInt(result.toString());
	}

	async supportsInterface(interfaceId: BytesLike): Promise<boolean> {
		return this.contract.supportsInterface(interfaceId);
	}

	// === KAMI Specific Functions ===

	/**
	 * Mint tokens to the caller. (Matches contract: mint(uint256 amount))
	 */
	async mint(amount: BigNumberish, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.mint(amount, overrides);
	}

	/**
	 * Mint batches of tokens to the caller. (Matches contract: mintBatch(uint256[] amounts))
	 */
	async mintBatch(amounts: BigNumberish[], overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.mintBatch(amounts, overrides);
	}

	/**
	 * Sells tokens from the owner to a buyer.
	 * Requires the seller (signer) to own or be approved for the tokens.
	 * Requires the buyer to have approved the contract to spend the salePrice in USDC.
	 * @param to The address of the buyer.
	 * @param id The ID of the token being sold.
	 * @param amount The amount of tokens being sold.
	 * @param salePrice The price in USDC for the tokens.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async sellToken(to: string, id: BigNumberish, amount: BigNumberish, salePrice: BigNumberish, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.sellToken(to, id, amount, salePrice, overrides);
	}

	/**
	 * Rents tokens for a specified duration and price.
	 * Requires the renter to have approved the contract to spend the rentalPrice in USDC.
	 * @param id The ID of the token to rent.
	 * @param duration The duration of the rental in seconds.
	 * @param rentalPrice The price in USDC for the rental.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async rentToken(id: BigNumberish, duration: BigNumberish, rentalPrice: BigNumberish, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.rentToken(id, duration, rentalPrice, overrides);
	}

	/**
	 * Ends a rental for a token.
	 * Can only be called by the renter or after the rental period has expired.
	 * @param id The ID of the token to end the rental for.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async endRental(id: BigNumberish, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.endRental(id, overrides);
	}

	/**
	 * Extends a rental for a token with additional duration and payment.
	 * Can only be called by the current renter.
	 * @param id The ID of the token to extend the rental for.
	 * @param additionalDuration The additional duration in seconds.
	 * @param additionalPayment The additional payment in USDC.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async extendRental(
		id: BigNumberish,
		additionalDuration: BigNumberish,
		additionalPayment: BigNumberish,
		overrides: any = {}
	): Promise<any> {
		this.requireSigner();
		return this.contract.extendRental(id, additionalDuration, additionalPayment, overrides);
	}

	/**
	 * Gets rental details for a specific token.
	 * @param id The ID of the token to get rental details for.
	 * @returns A promise that resolves to the rental details.
	 */
	async getRentalDetails(id: BigNumberish): Promise<RentalDetails> {
		const result = await this.contract.getRentalInfo(id);
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
	 * @returns A promise that resolves to true if the user has active rentals, false otherwise.
	 */
	async hasActiveRentals(user: string): Promise<boolean> {
		return this.contract.hasActiveRentals(user);
	}

	// === Royalty Management ===

	/**
	 * Sets mint royalties for the contract.
	 * @param royalties Array of RoyaltyData objects.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async setMintRoyalties(royalties: RoyaltyData[], overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.setMintRoyalties(royalties, overrides);
	}

	/**
	 * Sets transfer royalties for the contract.
	 * @param royalties Array of RoyaltyData objects.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async setTransferRoyalties(royalties: RoyaltyData[], overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.setTransferRoyalties(royalties, overrides);
	}

	/**
	 * Sets mint royalties for a specific token.
	 * @param id The ID of the token to set royalties for.
	 * @param royalties Array of RoyaltyData objects.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async setTokenMintRoyalties(id: BigNumberish, royalties: RoyaltyData[], overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.setTokenMintRoyalties(id, royalties, overrides);
	}

	/**
	 * Sets transfer royalties for a specific token.
	 * @param id The ID of the token to set royalties for.
	 * @param royalties Array of RoyaltyData objects.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async setTokenTransferRoyalties(id: BigNumberish, royalties: RoyaltyData[], overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.setTokenTransferRoyalties(id, royalties, overrides);
	}

	/**
	 * Gets mint royalty receivers for a token.
	 * @param id The ID of the token to get royalty receivers for.
	 * @returns A promise that resolves to an array of RoyaltyData objects.
	 */
	async getMintRoyaltyReceivers(id: BigNumberish): Promise<RoyaltyData[]> {
		const result = await this.contract.getMintRoyaltyReceivers(id);
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
	 * @param id The ID of the token to get royalty receivers for.
	 * @returns A promise that resolves to an array of RoyaltyData objects.
	 */
	async getTransferRoyaltyReceivers(id: BigNumberish): Promise<RoyaltyData[]> {
		const result = await this.contract.getTransferRoyaltyReceivers(id);
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
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async setMintPrice(newMintPrice: BigNumberish, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.setMintPrice(newMintPrice, overrides);
	}

	/**
	 * Gets the current mint price.
	 * @returns A promise that resolves to the current mint price in USDC.
	 */
	async getMintPrice(): Promise<bigint> {
		const result = await this.contract.mintPrice();
		return BigInt(result.toString());
	}

	/**
	 * Sets the platform commission percentage and address.
	 * @param newPercentage The new commission percentage in basis points.
	 * @param newPlatformAddress The new platform address.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async setPlatformCommission(newPercentage: BigNumberish, newPlatformAddress: string, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.setPlatformCommission(newPercentage, newPlatformAddress, overrides);
	}

	/**
	 * Gets the platform address.
	 * @returns A promise that resolves to the platform address.
	 */
	async getPlatformAddress(): Promise<string> {
		return this.contract.platformAddress();
	}

	/**
	 * Gets the platform commission percentage.
	 * @returns A promise that resolves to the platform commission percentage in basis points.
	 */
	async getPlatformCommissionPercentage(): Promise<bigint> {
		const result = await this.contract.platformCommissionPercentage();
		return BigInt(result.toString());
	}

	/**
	 * Sets the base URI for token metadata.
	 * @param baseURI The new base URI.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async setBaseURI(baseURI: string, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.setBaseURI(baseURI, overrides);
	}

	/**
	 * Gets the base URI for token metadata.
	 * @returns A promise that resolves to the base URI.
	 */
	async getBaseURI(): Promise<string> {
		return this.contract.getBaseURI();
	}

	// === Pausable Functions ===

	/**
	 * Pauses the contract.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async pause(overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.pause(overrides);
	}

	/**
	 * Checks if the contract is paused.
	 * @returns A promise that resolves to true if the contract is paused, false otherwise.
	 */
	async paused(): Promise<boolean> {
		return this.contract.paused();
	}

	/**
	 * Unpauses the contract.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async unpause(overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.unpause(overrides);
	}

	// === Access Control ===

	/**
	 * Checks if an account has a specific role.
	 * @param role The role to check.
	 * @param account The account to check.
	 * @returns A promise that resolves to true if the account has the role, false otherwise.
	 */
	async hasRole(role: BytesLike, account: string): Promise<boolean> {
		return this.contract.hasRole(role, account);
	}

	/**
	 * Gets the admin role for a specific role.
	 * @param role The role to get the admin for.
	 * @returns A promise that resolves to the admin role.
	 */
	async getRoleAdmin(role: BytesLike): Promise<string> {
		return this.contract.getRoleAdmin(role);
	}

	/**
	 * Grants a role to an account.
	 * @param role The role to grant.
	 * @param account The account to grant the role to.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async grantRole(role: BytesLike, account: string, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.grantRole(role, account, overrides);
	}

	/**
	 * Revokes a role from an account.
	 * @param role The role to revoke.
	 * @param account The account to revoke the role from.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async revokeRole(role: BytesLike, account: string, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.revokeRole(role, account, overrides);
	}

	/**
	 * Renounces a role from the caller.
	 * @param role The role to renounce.
	 * @param account The account to renounce the role from.
	 * @param overrides Optional transaction overrides.
	 * @returns A promise that resolves to the transaction response.
	 */
	async renounceRole(role: BytesLike, account: string, overrides: any = {}): Promise<any> {
		this.requireSigner();
		return this.contract.renounceRole(role, account, overrides);
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
	 * @returns A new KAMI1155CWrapper instance.
	 */
	connect(signerOrProvider: SignerOrProvider): KAMI1155CWrapper {
		return new KAMI1155CWrapper(this.address, signerOrProvider, this.abi);
	}
}
