export function serializePrisma<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) => {
      if (typeof value === 'bigint') return value.toString();
      if (value && value.constructor?.name === 'Decimal') return value.toString();
      return value;
    })
  );
}

/**
 * Converts an ISO 8601 date string into a Unix timestamp (in seconds).
 *
 * @param iso - The ISO 8601 date string to convert (e.g., "2025-10-31T12:34:56Z").
 * @returns The Unix timestamp in seconds, or `undefined` if no input is provided.
 *
 * @example
 * ```ts
 * isoToUnixSeconds("2025-10-31T12:34:56Z");
 * // → 1761904496
 * ```
 * */
export const isoToUnixSeconds = (iso?: string) =>
    iso ? Math.floor(new Date(iso).getTime() / 1000) : undefined;

/**
 * Converts an ISO 8601 date string into a Unix timestamp milliseconds (ms)
 *
 * @param iso - The ISO 8601 date string to convert (e.g., "2025-10-31T12:34:56.000Z").
 * @returns The Unix timestamp in milliseconds, or `undefined` if no input is provided.
 */
export const isoToUnixMilliseconds = (iso?: string) =>
    iso ? Math.floor(new Date(iso).getTime()) : undefined;

/**
 * Validates whether a given string is a proper Ethereum address.
 *
 * The function checks that the address:
 * - starts with `0x`
 * - contains exactly 40 hexadecimal characters
 *
 * @param addr - The wallet address to validate.
 * @returns `true` if the address is a valid Ethereum address, otherwise `false`.
 */
export const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);