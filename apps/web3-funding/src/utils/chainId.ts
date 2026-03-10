/**
 * Validate and normalize chainId to hex string format
 * @param chainId - Chain ID as string (can be decimal or hex)
 * @returns Normalized hex string (e.g., "0x1", "0x14a33") or null if invalid
 */
export function normalizeChainId(chainId: string | number): string | null {
  // If it's already a hex string starting with 0x, validate and return
  if (typeof chainId === 'string' && chainId.startsWith('0x')) {
    // Validate hex format: 0x followed by 1 or more hex digits
    if (/^0x[0-9a-fA-F]+$/.test(chainId)) {
      return chainId.toLowerCase();
    }
    return null;
  }

  // If it's a number or numeric string, convert to hex
  const num = typeof chainId === 'number' ? chainId : parseInt(chainId, 10);
  
  if (isNaN(num) || num < 0) {
    return null;
  }

  // Convert to hex string with 0x prefix
  return `0x${num.toString(16)}`;
}

/**
 * Validate that a chainId is in hex string format
 * @param chainId - Chain ID to validate
 * @returns true if valid hex string format
 */
export function isValidHexChainId(chainId: string): boolean {
  return /^0x[0-9a-fA-F]+$/.test(chainId);
}
