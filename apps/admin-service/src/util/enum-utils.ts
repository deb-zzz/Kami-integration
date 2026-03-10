/**
 * Converts a PascalCase or camelCase enum key into a user-friendly label
 * by inserting spaces between words.
 *
 * Useful for displaying enum keys in a readable UI format.
 *
 * @param key - The enum key to convert (e.g. "ChargeLocation").
 * @returns A label string with spaces inserted (e.g. "Charge Location").
 *
 * @example
 * ```ts
 * import { ChargeLocation } from '@prisma/client';
 *
 * const options = Object.entries(ChargeLocation).map(([key, value]) => ({
 *   label: toLabel(key),
 *   value,
 * }));
 * // "SampleEnum" → "Sample Enum"
 * ```
 * */
export function toLabel(key: string) {
    return key.replace(/([a-z])([A-Z])/g, '$1 $2');
}