import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
	const mailingList = await prisma.mailing_list.findMany();
	const data = JSON.stringify(mailingList, (key, value) => {
		return typeof value === 'bigint' ? Number(value) : value;
	});

	return NextResponse.json({ success: true, data: JSON.parse(data) });
}

type NewListEntry = {
	email: string;
	name?: string;
	community?: string;
};

export async function POST(request: NextRequest) {
	const { email, name, community }: NewListEntry = await request.json();
	const mailingList = await prisma.mailing_list.upsert({
		where: { email },
		update: {
			name,
			community,
			updatedAt: Date.now(),
		},
		create: {
			email,
			name,
			community,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			subscribed: true,
			subscribedAt: Date.now(),
		},
	});

	const data = JSON.stringify(mailingList, (key, value) => {
		return typeof value === 'bigint' ? Number(value) : value;
	});

	return NextResponse.json({ success: true, data: JSON.parse(data) });
}
