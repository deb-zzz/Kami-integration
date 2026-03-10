import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatZodError } from "@/util/zod-error-utils";
import { ChargeLocation } from "@prisma/client";

const baseChargeSchema = z.object({
    typeId: z.string().nonempty("Required."),
    location: z.enum(ChargeLocation),
    description: z.string().optional(),
    currency: z.string().optional(),
    fixedAmount: z.number().nonnegative("Must be non-negative value").default(0),
    percentage: z.number().nonnegative("Must be non-negative value").default(0),
});

const createChargeSchema = baseChargeSchema;
const updateChargeSchema = baseChargeSchema.safeExtend({
    id: z.string().nonempty("Required."),
});

export type CreateChargeInput = z.infer<typeof createChargeSchema>;
export type UpdateChargeInput = z.infer<typeof updateChargeSchema>;

export async function validateCreateChargeInput(
    input: unknown
) {
    const parsed = createChargeSchema.safeParse(input);
    let fieldErrors: Record<string, string> = {};

    if (!parsed.success) {
        fieldErrors = formatZodError(parsed.error);
        return { ok: false, fieldErrors };
    }

    const data = parsed.success ? parsed.data : (input as Partial<CreateChargeInput>);

    if (data?.typeId && data?.location) {
        const [chargeType, existing] = await Promise.all([
            prisma.chargeType.findFirst({
                where: {
                    id: data.typeId,
                    deletedAt: null,
                }
            }),
            // Check for an existing active same charge type and location
            prisma.charge.findFirst({
                where: {
                    typeId: data.typeId,
                    location: data.location,
                    deletedAt: null,
                },
            }),
        ]);

        if (!chargeType) {
            fieldErrors.typeId = "Charge type not found.";
        }
        if (existing) {
            fieldErrors.typeId = "Already exists with the same location.";
            fieldErrors.location = "Already exists with the same charge type.";
        }
    }

    if (Object.keys(fieldErrors).length > 0) {
        return { ok: false, fieldErrors };
    }
    return { ok: true, data: parsed.data };
}

export async function validateUpdateChargeInput(
    input: unknown
) {
    const parsed = updateChargeSchema.safeParse(input);
    let fieldErrors: Record<string, string> = {};

    if (!parsed.success) {
        fieldErrors = formatZodError(parsed.error);
        return { ok: false, fieldErrors };
    }

    const data = parsed.success ? parsed.data : (input as Partial<UpdateChargeInput>);

    if (data?.typeId && data?.location) {
        const target = await prisma.charge.findFirst({
            where: {
                id: data.id,
                deletedAt: null,
            },
        });
        if (!target) {
            fieldErrors.id = "Charge to update not found.";
        } else {
            const [chargeType, existing] = await Promise.all([
                prisma.chargeType.findFirst({
                    where: {
                        id: data.typeId,
                        deletedAt: null,
                    },
                }),
                // Check for an existing active same charge type and location (excluding self)
                prisma.charge.findFirst({
                    where: {
                        typeId: data.typeId,
                        location: data.location,
                        deletedAt: null,
                        NOT: { id: data.id }, // Exclude self
                    },
                }),
            ]);

            if (!chargeType) {
                fieldErrors.typeId = "Charge type not found.";
            }
            if (existing) {
                fieldErrors.typeId = "Already exists with the same location.";
                fieldErrors.location = "Already exists with the same charge type.";
            }
        }
    }

    if (Object.keys(fieldErrors).length > 0) {
        return { ok: false, fieldErrors };
    }
    return { ok: true, data: parsed.data };
}
