import { z } from "zod";

export const walletSchema = z.object({
  name: z.string().min(1, "Name is required"),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address format"),
  chainId: z.string().optional(),
  walletType: z.enum(["Platform", "Sponsor"]).default("Platform"),
  isActive: z.boolean().default(true),
  createdBy: z.string().min(1, "createdBy is required"),
  updatedBy: z.string().optional(),
});

/**
 * Safely performs an HTTP request using the Fetch API with consistent error handling.
 *
 * @template T - The expected type of the parsed JSON response.
 * @param {string} url - The endpoint URL to request.
 * @param {RequestInit} [options] - Optional fetch configuration such as method, headers, and body.
 * @returns {Promise<T>} A promise that resolves to the parsed JSON response typed as {@link T}.
 *
 * @throws {Error} If the network request fails, the response is not OK (non-2xx),
 * or the response body cannot be parsed as JSON.
 *
 * @example
 * ```ts
 * interface ApiResponse {
 *   success: boolean;
 *   data: string[];
 * }
 *
 * const result = await safeFetch<ApiResponse>('/api/data', {
 *   method: 'GET'
 * });
 * console.log(result.data);
 * ```
 * */
export async function safeFetch<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const text = await response.text().catch(() => "No response body");
      throw new Error(
          `Fetch failed with status ${response.status} ${response.statusText} | URL: ${url} | Response: ${text.slice(0, 300)}`
      );
    }

    // Attempt to parse JSON, throw descriptive error if invalid
    try {
      return (await response.json()) as T;
    } catch (jsonErr) {
      throw new Error(`Failed to parse JSON from ${url}: ${(jsonErr as Error).message}`);
    }

  } catch (err) {
    const reason = (err as Error)?.message ?? "Unknown error";
    console.error(`[Internal Service Fetch Error] URL: ${url}`, reason);
    throw new Error(`Internal service call failed: ${reason}`);
  }
}

export function classifyBalanceError(
    message?: string
): "INVALID_ADDRESS" | "INVALID_CHAIN" | "FETCH_ERROR" | null {
  if (!message) return null;

  if (/invalid wallet address/i.test(message)) return "INVALID_ADDRESS";
  if (/blockchain not found/i.test(message)) return "INVALID_CHAIN";

  return "FETCH_ERROR";
}