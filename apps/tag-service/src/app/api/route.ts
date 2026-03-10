import { prisma } from '@/lib/db';
import { Prisma, TagTypes } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

type TagRecord = Prisma.tagGetPayload<Record<string, never>>;

type SuccessResponse = {
	success: true;
	tags: TagRecord[];
};

type Fail = {
	success: false;
	error: string;
};

type Response = SuccessResponse | Fail;

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse<Response>> {
	try {
		const startsWith = req.nextUrl.searchParams.get('startsWith') ?? undefined;
		const category = (req.nextUrl.searchParams.get('category') as TagTypes) ?? undefined;
		const tags = await prisma.tag.findMany({ where: { tag: { startsWith: startsWith?.toUpperCase() }, type: category } });
		return NextResponse.json({ success: true, tags }, { status: 200 });
	} catch (error) {
		return NextResponse.json({ success: false, error: 'Internal Server Error: ' + (error as Error).message }, { status: 500 });
	}
}
