import { z } from "zod";
import { formatZodError } from "@/util/zod-error-utils";
import { prisma } from "@/lib/db";
import { passwordRule } from "@/util/password-utils";

/**
 * Zod schema for creating a new administrator.
 *
 * Validates:
 * - `email` — must be a valid email address. Converted to lowercase automatically.
 * - `name` — optional.
 * - `password` — must meet strong password requirements:
 *   at least 8 characters, include uppercase, lowercase, number, and symbol.
 * - `roleId` — optional, must correspond to an existing role if provided.
 * - `encoded` — indicates whether the password is already hashed.
 */
const createAdminSchema = z.object({
    email: z.email("Invalid email format.").transform((val) => val.toLowerCase()),
    name: z.string().optional(),
    password: z.string("Required").trim().refine((val) =>
        passwordRule.test(val), "Password must be at least 8 characters long and include uppercase, lowercase, number, and symbol."
    ),
    roleId: z.string().optional(),
    encoded: z.boolean().default(true),
});

/**
 * Zod schema for updating an existing administrator.
 *
 * Validates:
 * - `id` — required, must correspond to an existing admin user.
 * - `name` — optional.
 * - `roleId` — optional, must correspond to an existing role if provided.
 */
const updateAdminSchema = z.object({
    id: z.string().trim().min(1, "Required."),
    name: z.string().optional(),
    roleId: z.string().optional(),
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type UpdateAdminInput = z.infer<typeof updateAdminSchema>;

/**
 * Validates input for creating a new administrator.
 *
 * Checks:
 * - Schema validation with Zod.
 * - Email uniqueness among non-deleted users.
 * - Role existence if `roleId` is provided.
 *
 * @param input - Unknown input object from request body
 * @returns Object containing:
 *   - `ok: boolean` — true if valid
 *   - `data` — parsed input if valid
 *   - `fieldErrors` — record of validation errors keyed by field
 */
export async function validateCreateAdminInput(input: unknown) {
    const parsed = createAdminSchema.safeParse(input);
    let fieldErrors: Record<string, string> = {};

    if (!parsed.success) {
        fieldErrors = formatZodError(parsed.error);
        return { ok: false, fieldErrors };
    }

    const data = parsed.success ? parsed.data : (input as Partial<CreateAdminInput>);

    if (data.email) {
        const admin = await prisma.administrator.findFirst({
            where: {
                email: data.email,
                deletedAt: null,
            }
        });
        if (admin) fieldErrors.email = "Already exists.";
    }
    if (data.roleId) {
        const role = await prisma.role.findUnique({
            where: { id: data.roleId }
        });
        if (!role) fieldErrors.roleId = "Role not found.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        return { ok: false, fieldErrors };
    }
    return { ok: true, data: parsed.data };
}

/**
 * Validates input for updating an existing administrator.
 *
 * Checks:
 * - Schema validation with Zod.
 * - Admin user to update existing, and not deleted.
 * - Role existence if `roleId` is provided.
 *
 * @param input - Unknown input object from request body
 * @returns Object containing:
 *   - `ok: boolean` — true if valid
 *   - `data` — parsed input if valid
 *   - `fieldErrors` — record of validation errors keyed by field
 */
export async function validateUpdateAdminInput(input: unknown) {
    const parsed = updateAdminSchema.safeParse(input);
    let fieldErrors: Record<string, string> = {};

    if (!parsed.success) {
        fieldErrors = formatZodError(parsed.error);
        return { ok: false, fieldErrors };
    }

    const data = parsed.success ? parsed.data : (input as Partial<UpdateAdminInput>);

    const target = await prisma.administrator.findFirst({
        where: { id: data.id },
    });
    if (!target) {
        fieldErrors.generic = "NOT_FOUND";
    } else if (target.deletedAt) {
        fieldErrors.generic = "DELETED";
    } else {
        // Process further validation if the admin exists
        if (data.roleId) {
            const role = await prisma.role.findUnique({
                where: { id: data.roleId },
            });
            if (!role) fieldErrors.roleId = "Role not found.";
        }
    }

    if (Object.keys(fieldErrors).length > 0) {
        return { ok: false, fieldErrors };
    }
    return { ok: true, data: parsed.data };
}