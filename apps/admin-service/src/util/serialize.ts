import { Prisma } from "@prisma/client";
const { Decimal } = Prisma;

export function serializePrisma<T>(obj: T): unknown {
    if (obj instanceof Decimal) {
        return obj.toNumber();
    }
    if (typeof obj === "bigint") {
        return obj.toString(); // number (safe for timestamps)
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