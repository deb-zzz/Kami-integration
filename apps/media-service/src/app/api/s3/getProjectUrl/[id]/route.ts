import { NextRequest, NextResponse } from 'next/server';
import { S3Path } from '@/Constants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const key = req.nextUrl.searchParams.get('key');
	const url = new URL(S3Path + `Project/${id}/${key}`);
	return NextResponse.json(url.toString());
}
