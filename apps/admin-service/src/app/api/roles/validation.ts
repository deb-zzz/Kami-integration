import { z } from "zod";
import { formatZodError } from "@/util/zod-error-utils";
import { prisma } from "@/lib/db";

const baseRoleSchema = z.object({
    name: z.string("Required.").trim().min(1, "Required."),
    description: z.string().optional(),
    isSystemGenerated: z.boolean().default(false),
    permissionIds: z
        .array(z.string().trim().min(1))
        .nonempty("At least one permission is required.")
});

const createRoleSchema = baseRoleSchema;
const updateRoleSchema = baseRoleSchema.safeExtend({
    id: z.string().nonempty("Required."),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

/**
 * Validates input for creating a new role.
 *
 * Checks:
 * - Schema validation with Zod.
 * - Role name uniqueness among non-deleted roles.
 *
 * @param input - Unknown input object from request body
 * @returns Object containing:
 *   - `ok: boolean` — true if valid
 *   - `data` — parsed input if valid
 *   - `fieldErrors` — record of validation errors keyed by field
 */
export async function validateCreateRoleInput(input: unknown) {
    const parsed = createRoleSchema.safeParse(input);
    let fieldErrors: Record<string, string> = {};

    if (!parsed.success) {
        fieldErrors = formatZodError(parsed.error);
        return { ok: false, fieldErrors };
    }

    const data = parsed.success ? parsed.data : (input as Partial<CreateRoleInput>);

    if (data.name) {
        const role = await prisma.role.findFirst({
            where: {
                name: data.name,
                deletedAt: null
            }
        });
        if (role) fieldErrors.name = "Already exists.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        return { ok: false, fieldErrors };
    }
    return { ok: true, data: parsed.data };
}

/**
 * Validates input for updating an existing role.
 *
 * Checks:
 * - Schema validation with Zod.
 * - Role to update existing, not system-generated, and not deleted.
 * - Role name uniqueness among non-deleted roles.
 *
 * @param input - Unknown input object from request body
 * @returns Object containing:
 *   - `ok: boolean` — true if valid
 *   - `data` — parsed input if valid
 *   - `fieldErrors` — record of validation errors keyed by field
 */
export async function validateUpdateRoleInput(input: unknown) {
    const parsed = updateRoleSchema.safeParse(input);
    let fieldErrors: Record<string, string> = {};

    if (!parsed.success) {
        fieldErrors = formatZodError(parsed.error);
        return { ok: false, fieldErrors };
    }

    const data = parsed.success ? parsed.data : (input as Partial<UpdateRoleInput>);

    const target = await prisma.role.findFirst({
        where: { id: data.id },
    });
    if (!target) {
        fieldErrors.generic = "NOT_FOUND";
    } else if (target.isSystemGenerated) {
        fieldErrors.generic = "SYSTEM_LOCK";
    } else if (target.deletedAt) {
        fieldErrors.generic = "DELETED";
    } else {
        const existingRole = await prisma.role.findFirst({
            where: {
                name: data.name,
                deletedAt: null,
                NOT: { id: data.id }, // Exclude self
            },
        });
        if (existingRole) fieldErrors.name = "Already exists.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        return { ok: false, fieldErrors };
    }
    return { ok: true, data: parsed.data };
}