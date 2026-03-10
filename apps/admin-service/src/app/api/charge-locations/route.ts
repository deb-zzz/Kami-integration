import { NextResponse } from 'next/server'
import { ChargeLocation } from '@prisma/client'
import { toLabel } from "@/util/enum-utils";

/**
 * GET /api/charge-locations
 *
 * Get a list of `ChargeLocation` enum mapped in UI friendly for select options.
 * @return List of mapping consist of `label` and `value` properties.
 * */
export async function GET() {
    const options = Object.entries(ChargeLocation).map(([key, value]) => ({
        label: toLabel(key),
        value: value,
    }))
    return NextResponse.json(options)
}
