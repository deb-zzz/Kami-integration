import { NextResponse } from 'next/server'
import { WalletType } from '@prisma/client'
import { toLabel } from "@/util/enum-utils";

/**
 * GET /api/wallet-types
 *
 * Get a list of `WalletType` enum mapped in UI friendly for select options.
 * @return List of mapping consist of `label` and `value` properties.
 * */
export async function GET() {
    const options = Object.entries(WalletType).map(([key, value]) => ({
        label: toLabel(key),
        value: value,
    }))
    return NextResponse.json(options)
}