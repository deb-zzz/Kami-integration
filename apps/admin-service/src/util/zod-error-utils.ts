import { z } from "zod";

/**
 * Formats a Zod validation error into a flat record of field-to-error-message mappings.
 *
 * This function is useful when you only need to display a single validation error
 * message per field in your UI (the first one encountered).
 *
 * @param err - A {@link z.ZodError} object returned from a failed Zod schema parse or validation.
 * @returns A record where each key is a field path (e.g., `"user.email"`) and the value is
 * the first associated error message string.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * import { formatZodError } from "./formatZodError";
 *
 * const schema = z.object({
 *   name: z.string().min(1, "Name is required"),
 *   age: z.number().min(18, "Must be 18 or older"),
 * });
 *
 * const result = schema.safeParse({ name: "", age: 15 });
 * if (!result.success) {
 *   console.log(formatZodError(result.error));
 *   // Output:
 *   // { name: "Name is required", age: "Must be 18 or older" }
 * }
 * ```
 */
export function formatZodError(err: z.ZodError) {
    const fieldErrors: Record<string, string> = {};

    for (const issue of err.issues) {
        const field = issue.path.join(".");
        // Only store the first error per field
        if (!fieldErrors[field]) {
            fieldErrors[field] = issue.message;
        }
    }

    return fieldErrors;
}

/**
 * Formats a Zod validation error into a record of field-to-multiple-error-messages mappings.
 *
 * This variant preserves all validation messages for each field instead of keeping only the first one.
 * It's ideal for forms or APIs that display or log multiple validation messages per field.
 *
 * @param err - A {@link z.ZodError} object returned from a failed Zod schema parse or validation.
 * @returns A record where each key is a field path (e.g., `"user.email"`) and the value is
 * an array of all associated error messages.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * import { formatZodMultiError } from "./formatZodError";
 *
 * const schema = z.object({
 *   password: z.string()
 *     .min(8, "Password must be at least 8 characters")
 *     .regex(/[A-Z]/, "Password must contain an uppercase letter"),
 * });
 *
 * const result = schema.safeParse({ password: "short" });
 * if (!result.success) {
 *   console.log(formatZodMultiError(result.error));
 *   // Output:
 *   // { password: [
 *   //   "Password must be at least 8 characters",
 *   //   "Password must contain an uppercase letter"
 *   // ] }
 * }
 * ```
 */
export function formatZodMultiError(err: z.ZodError) {
    //return { fieldErrors: z.treeifyError(err).fieldErrors }
    const fieldErrors: Record<string, string[]> = {};

    for (const issue of err.issues) {
        const field = issue.path.join(".");
        if (!fieldErrors[field]) {
            fieldErrors[field] = [];
        }
        fieldErrors[field].push(issue.message);
    }

    return fieldErrors;
}