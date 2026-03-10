/**
 * Currency Validation Module
 * 
 * This module provides validation schemas and functions for currency CRUD operations.
 * All Create, Update, and Delete operations require administrator authentication.
 * 
 * Administrator Validation:
 * - Extracts admin email from JWT token in Authorization header
 * - Validates that administrator exists in the database
 * - Checks that administrator account is active (status = "active")
 * - Ensures administrator account has not been deleted (deletedAt = null)
 * 
 * The administrator's email is stored in the updatedBy field for audit purposes.
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatZodError } from "@/util/zod-error-utils";
import { CurrencyType } from "@prisma/client";

// 🔹 Base schema
const baseCurrencySchema = z.object({
    symbol: z.string().trim().nonempty("Required.").toUpperCase(),
    name: z.string().trim().nonempty("Required."),
    type: z.enum(CurrencyType),
    isActive: z.boolean().optional().default(true),
});

// 🔹 Create schema
export const createCurrencySchema = baseCurrencySchema;

// 🔹 Update schema (extends base but makes symbol required for identification)
export const updateCurrencySchema = baseCurrencySchema.extend({
    symbol: z.string().trim().nonempty("Required.").toUpperCase(),
}).partial().required({ symbol: true });

export type CreateCurrencyInput = z.infer<typeof createCurrencySchema>;
export type UpdateCurrencyInput = z.infer<typeof updateCurrencySchema>;

/**
 * Validates that an administrator exists and is active
 * @param adminEmail - The email of the administrator to validate
 * @returns Object with ok status and optional error message
 */
export async function validateAdministrator(adminEmail: string | null) {
    if (!adminEmail) {
        return { ok: false, error: "Administrator email is required." };
    }

    const admin = await prisma.administrator.findUnique({
        where: { email: adminEmail },
    });

    if (!admin) {
        return { ok: false, error: "Administrator not found." };
    }

    if (admin.status !== "active") {
        return { ok: false, error: "Administrator account is not active." };
    }

    if (admin.deletedAt !== null) {
        return { ok: false, error: "Administrator account has been deleted." };
    }

    return { ok: true };
}

export async function validateCreateCurrencyInput(input: unknown) {
    const parsed = createCurrencySchema.safeParse(input);
    let fieldErrors: Record<string, string> = {};

    if (!parsed.success) {
        fieldErrors = formatZodError(parsed.error);
        return { ok: false, fieldErrors };
    }

    const data = parsed.success ? parsed.data : (input as Partial<CreateCurrencyInput>);

    if (data?.symbol) {
        // Check for an existing currency with the same symbol
        const existing = await prisma.currency.findFirst({
            where: {
                symbol: data.symbol,
                deletedAt: null, // only active records count as duplicates
            },
        });
        if (existing) {
            fieldErrors.symbol = "Already exists.";
        }
    }

    if (Object.keys(fieldErrors).length > 0) {
        return { ok: false, fieldErrors };
    }
    return { ok: true, data: parsed.data };
}

export async function validateUpdateCurrencyInput(input: unknown) {
    const parsed = updateCurrencySchema.safeParse(input);
    let fieldErrors: Record<string, string> = {};

    if (!parsed.success) {
        fieldErrors = formatZodError(parsed.error);
        return { ok: false, fieldErrors };
    }

    const data = parsed.success ? parsed.data : (input as Partial<UpdateCurrencyInput>);

    if (data?.symbol) {
        const target = await prisma.currency.findFirst({
            where: {
                symbol: data.symbol,
                deletedAt: null,
            },
        });
        if (!target) {
            fieldErrors.symbol = "Currency to update not found.";
        }
    }

    if (Object.keys(fieldErrors).length > 0) {
        return { ok: false, fieldErrors };
    }
    return { ok: true, data: parsed.data };
}
