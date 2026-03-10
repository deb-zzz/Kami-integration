import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { formatZodError } from "@/util/zod-error-utils";
import { encodePassword, passwordRule } from "@/util/password-utils";

/**
 * Zod schema for validating a password change request.
 *
 * Validates:
 * - `email` — must be a valid email address. Converted to lowercase automatically.
 * - `password` — current password (required).
 * - `newPassword` — must meet strong password requirements.
 * - `confirmNewPassword` — Must match `newPassword`. Required to confirm the new password.
 * - `encoded` — indicates whether the password is already encoded.
 */
const changePasswordSchema = z.object({
    email: z.email("Invalid email format.").transform((val) => val.toLowerCase()),
    currentPassword: z.string("Required.").trim().min(1, "Required."),
    newPassword:  z.string("Required.").trim().refine((val) =>
        passwordRule.test(val), "Password must be at least 8 characters long and include uppercase, lowercase, number, and symbol."
    ),
    confirmNewPassword: z.string("Required.").trim().min(1, "Required."),
    encoded: z.boolean().default(true),

}).refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match.",
    path: ["confirmNewPassword"], // assign error to this field
});

/**
 * PUT /api/user/change-password
 *
 * Handles a request to change an administrator's password.
 *
 * @param request - The incoming HTTP request (JSON body expected).
 * @returns A `NextResponse` containing the updated administrator record or an error message.
 *
 * ###### Request Body Example:
 * ```JSON
 * {
 *   "email": "admin@example.com",
 *   "password": "OldPass123!",
 *   "newPassword": "NewPass123!",
 *   "encoded": false
 * }
 * ```
 * ###### Response Codes:
 * - `200` — Password successfully changed.
 * - `400` — Validation failed (invalid email, incorrect password, etc.).
 * - `500` — Unexpected server error.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
    const body = await request.json();

    try {
        const parsed = changePasswordSchema.safeParse(body);
        let fieldErrors: Record<string, string> = {};
        if (!parsed.success) {
            fieldErrors = formatZodError(parsed.error);
            return NextResponse.json({ error: 'Validation failed', fieldErrors }, { status: 400 });
        }

        const data = parsed.data!;

        const existing = await prisma.administrator.findUnique({
            where: { email: data.email },
        });
        if (!existing) return NextResponse.json({ error: 'Email not found.'}, { status: 400 });
        else if (existing.deletedAt) {
            return NextResponse.json({ error: 'Unable to change password for deleted admin user.'}, { status: 400 });
        }

        // Handle password encoding if needed.
        const currentPassword = !data.encoded ? await encodePassword(data.currentPassword) : data.currentPassword;
        const newPassword = !data.encoded ? await encodePassword(data.newPassword) : data.newPassword;

        // Validate current password before proceed.
        if (existing.passwordHash !== currentPassword) fieldErrors.currentPassword = "Incorrect current password."
        if (Object.keys(fieldErrors).length > 0) {
            return NextResponse.json({ error: 'Validation failed', fieldErrors }, { status: 400 });
        }

        // Update password
        await prisma.administrator.update({
            where: { id: existing.id },
            data: {
                passwordHash: newPassword,
                updatedAt: Math.floor(Date.now() / 1000),
            },
            include: {
                role: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({ message: "Password successfully changed." });

    } catch (err) {
        return NextResponse.json({ error: 'Failed to change password: ' + (err as Error).message }, { status: 500 });
    }
}