import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatZodError } from "@/util/zod-error-utils";

// 🔹 Base schema
const baseChargeTypeSchema = z.object({
    name: z.string().trim().nonempty("Required."),
});

// 🔹 Create schema
export const createChargeTypeSchema = baseChargeTypeSchema;

// 🔹 Update schema (extends base)
export const updateChargeTypeSchema = baseChargeTypeSchema.extend({
    id: z.string().nonempty("Required."),
});

export type CreateChargeTypeInput = z.infer<typeof createChargeTypeSchema>;
export type UpdateChargeTypeInput = z.infer<typeof updateChargeTypeSchema>;


export async function validateCreateChargeTypeInput(input: unknown) {
    const parsed = createChargeTypeSchema.safeParse(input);
    let fieldErrors: Record<string, string> = {};

    if (!parsed.success) {
        fieldErrors = formatZodError(parsed.error);
        return { ok: false, fieldErrors };
    }

    const data = parsed.success ? parsed.data : (input as Partial<CreateChargeTypeInput>);

    if (data?.name) {
        // Check for an existing active same charge type
        const existing = await prisma.chargeType.findFirst({
            where: {
                name: data.name,
                deletedAt: null, // only active records count as duplicates
            },
        });
        if (existing) {
            fieldErrors.name = "Already exists.";
        }
    }

    if (Object.keys(fieldErrors).length > 0) {
        return { ok: false, fieldErrors };
    }
    return { ok: true, data: parsed.data };
}

export async function validateUpdateChargeTypeInput(input: unknown) {
    const parsed = updateChargeTypeSchema.safeParse(input);
    let fieldErrors: Record<string, string> = {};

    if (!parsed.success) {
        fieldErrors = formatZodError(parsed.error);
        return { ok: false, fieldErrors };
    }

    const data = parsed.success ? parsed.data : (input as Partial<UpdateChargeTypeInput>);

    if (data?.id && data?.name) {
        const target = await prisma.chargeType.findFirst({
            where: {
                id: data.id,
                deletedAt: null,
            },
        });
        if (!target) {
            fieldErrors.id = "Charge type to update not found.";
        } else {
            // Check for an existing active same charge type (excluding self)
            const existing = await prisma.chargeType.findFirst({
                where: {
                    name: data.name,
                    deletedAt: null,
                    NOT: { id: data.id },
                },
            });
            if (existing) {
                fieldErrors.name = "Already exists.";
            }
        }
    }

    if (Object.keys(fieldErrors).length > 0) {
        return { ok: false, fieldErrors };
    }
    return { ok: true, data: parsed.data };
}
