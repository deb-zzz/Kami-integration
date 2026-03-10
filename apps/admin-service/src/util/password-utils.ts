/**
 * Regular expression for validating strong passwords.
 *
 * Rules enforced:
 * - At least 8 characters long
 * - Contains at least one lowercase letter
 * - Contains at least one uppercase letter
 * - Contains at least one numeric digit
 * - Contains at least one special character (symbol)
 */
export const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/**
 * Password Encoding Utility
 *
 * Encodes plain text passwords using SHA-256 hashing for secure storage.
 * This function is used when creating users with plain text passwords.
 *
 * @param {string} password - The plain text password to encode
 * @returns {Promise<string>} The SHA-256 hash of the password
 *
 * @example
 * const hashedPassword = await encodePassword('myPassword123');
 * // Returns: SHA-256 hash as string
 *
 * @security Uses Web Crypto API for cryptographically secure hashing
 * @note This is a basic implementation - consider using bcrypt or Argon2 for production
 */
export async function encodePassword(password: string) {
    // Use Web Crypto API to create SHA-256 hash of the password
    const passwordHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    // Convert the hash buffer to a string for storage
    return new TextDecoder().decode(passwordHash);
}