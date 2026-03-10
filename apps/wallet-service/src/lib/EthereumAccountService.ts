import { HDNodeWallet, Wallet, Mnemonic } from 'ethers';
import { createHash } from 'crypto';

/**
 * Service responsible for Ethereum account operations
 */
export class EthereumAccountService {
	/**
	 * Generates a deterministic Ethereum account based on login credentials
	 * @param identifier - User's email or phone number
	 * @param salt - Additional entropy for account generation
	 * @returns Generated Ethereum wallet
	 */
	public generateAccount(identifier: string, salt: string): HDNodeWallet {
		// Create a deterministic seed based on the identifier and salt
		const seed = this.generateDeterministicSeed(identifier, salt);

		// Create and return a new wallet from the seed
		const wallet = Wallet.fromPhrase(seed);
		return wallet;
	}

	/**
	 * Generates a deterministic seed phrase from user credentials
	 * @param identifier - User's email or phone number
	 * @param salt - Additional entropy for seed generation
	 * @returns Deterministic seed phrase
	 * @private
	 */
	private generateDeterministicSeed(identifier: string, salt: string): string {
		// Create a hash of the identifier and salt
		const hash = createHash('sha256').update(`${identifier}${salt}`).digest('hex');

		// Convert the hash to a valid BIP39 mnemonic (12 words)
		const words = this.hashToMnemonic(hash);

		return words;
	}

	/**
	 * Converts a hash to a BIP39 mnemonic phrase
	 * @param hash - Input hash to convert
	 * @returns BIP39 mnemonic phrase
	 * @private
	 */
	private hashToMnemonic(hash: string): string {
		// Convert the hex hash to bytes
		const entropy = Buffer.from(hash, 'hex');

		// Generate a deterministic mnemonic from the entropy
		return Mnemonic.fromEntropy(entropy).phrase;
	}
}
