/**
 * Validates user identifiers (email or phone number)
 * @param identifier - User identifier to validate
 * @returns boolean indicating if the identifier is valid
 */
export function validateIdentifier(identifier: string): boolean {
	// Email regex pattern
	const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	// Phone number pattern (simplified - adjust based on your requirements)
	const phonePattern = /^\+?[\d\s-]{10,}$/;

	return emailPattern.test(identifier) || phonePattern.test(identifier);
}
