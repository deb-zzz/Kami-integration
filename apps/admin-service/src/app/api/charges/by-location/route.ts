import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ChargeLocation } from "@prisma/client";

/**
 * GET /api/charges/by-location?location=<Location>
 *
 * Retrieve a list of configured charges by location enum.
 * @param request - The incoming HTTP request.
 * @returns JSON response containing:
 *   - Success: List of configured charges for the location.
 *   - Error 400: When location parameter is missing.
 *   - Error 500: When database operation fails.
 *
 * @example
 * // Response structure
 * [
 *   {
 *     "id": "<charge_uuid>",
 *     "typeId": "<charge_type_uuid>",
 *     "description": "Optional explanation of the charge",
 *     "location": "Checkout", // PascalCase enum
 *     "fixedAmount": "5",
 *     "percentage": "0",
 *     "createdAt": 1758514800,
 *     "updatedAt": 1758514800,
 *     "deletedAt": null,
 *     "chargeType": {
 *       "id": "<charge_type_uuid>",
 *       "name": "Name of the charge type"
 *     }
 *   }
 *   // list of charges continues
 * ]
 * */
export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const locationParam = url.searchParams.get("location");
        if (!locationParam || !(locationParam in ChargeLocation)) {
            return NextResponse.json(
                { error: `Invalid or missing location. Allowed values: ${Object.values(ChargeLocation).join(", ")}` },
                { status: 400 }
            );
        }
        const location = locationParam as ChargeLocation;

        // Fetch all non-deleted charges by location
        const charges = await prisma.charge.findMany({
            where: {
                location: location,
                deletedAt: null,
            },
            orderBy: {
                chargeType: { name: "asc" },
            },
            include: {
                chargeType: { select: { id: true, name: true } },
            },
        });

        // Convert decimal (not JSON-serializable) into number for type error prevention.
        return NextResponse.json(
            charges.map((charge) => ({
                ...charge,
                fixedAmount: charge.fixedAmount.toNumber(),
                percentage: charge.percentage.toNumber(),
            }))
        );
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch charges: ' + (e as Error).message }, { status: 500 });
    }
}
