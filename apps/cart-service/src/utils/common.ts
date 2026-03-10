import { z } from "zod";
import { Prisma } from "@prisma/client";
const { Decimal } = Prisma;

export function exclude<T extends Record<string, any>, K extends keyof T>(
    obj: T,
    keys: readonly K[]
): Omit<T, K> {
    return Object.fromEntries(
        Object.entries(obj).filter(([key]) => !keys.includes(key as K))
    ) as Omit<T, K>;
}

export function formatZodError(err: z.ZodError) {
    return err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
    }));
}

export function serializePrisma(obj: any): any {
    if (obj instanceof Decimal) {
        return obj.toNumber();
    }
    if (typeof obj === "bigint") {
        return Number(obj); // number (safe for timestamps)
    }
    if (Array.isArray(obj)) {
        return obj.map(serializePrisma);
    }
    if (obj !== null && typeof obj === "object") {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, serializePrisma(value)])
        );
    }
    return obj;
}
