import { prisma } from '@/lib/db';
import { tag, TagTypes } from '@prisma/client';

import { NextRequest, NextResponse } from 'next/server';

type Body = {
	tag: string;
	type: TagTypes;
};

type Props = {
	params: { walletAddress: string };
};

type Success = {
	success: true;
	tags: tag[];
};

type Fail = {
	success: false;
	error?: string;
};

type Result = Success | Fail;

const writeTag = async (tag: string, type: TagTypes, walletAddress: string) => {
	try {
		const tags = await prisma.tag.upsert({
			where: { type_tag: { tag: tag.toUpperCase(), type: type } },
			update: {
				users: {
					connect: {
						walletAddress: walletAddress,
					},
				},
				createdAt: new Date().getTime() / 1000,
			},
			create: {
				tag: tag.toUpperCase(),
				type: type,
				createdAt: new Date().getTime() / 1000,
				users: {
					connect: {
						walletAddress: walletAddress,
					},
				},
			},
		});
		return tags;
	} catch (error) {
		console.error('Error creating tag:', (error as Error).message);
		return null;
	}
};

export async function POST(req: NextRequest, { params }: Props): Promise<NextResponse<Result>> {
	const body: Body | Body[] = await req.json();
	const walletAddress = params.walletAddress;

	try {
		if (Array.isArray(body)) {
			const tags = await Promise.all(body.map((tag) => writeTag(tag.tag, tag.type, walletAddress)));
			return NextResponse.json({ success: true, tags: tags.filter((tag) => tag !== null) }, { status: 201 });
		} else {
			const tags = await writeTag(body.tag, body.type, walletAddress);
			if (tags === null) return NextResponse.json({ success: false, error: 'Failed to create tag' }, { status: 400 });
			return NextResponse.json({ success: true, tags: [tags] }, { status: 201 });
		}
	} catch (error) {
		console.error('Error creating tag(s):', (error as Error).message);
		return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
	}
}

const deleteTag = async (tagId: number, walletAddress: string) => {
	try {
		const tags = await prisma.tag.update({
			where: { id: tagId },
			data: {
				users: {
					disconnect: {
						walletAddress: walletAddress,
					},
				},
			},
		});
		return tags;
	} catch (error) {
		console.error('Error deleting tag:', (error as Error).message);
		return null;
	}
};

type DeleteBody = {
	tagId: number | number[];
};

export async function DELETE(req: NextRequest, { params }: Props): Promise<NextResponse<Result>> {
	const { tagId }: DeleteBody = await req.json();
	const walletAddress = params.walletAddress;
	try {
		if (Array.isArray(tagId)) {
			const tags = await Promise.all(tagId.map((tag) => deleteTag(tag, walletAddress)));
			return NextResponse.json({ success: true, tags: tags.filter((tag) => tag !== null) }, { status: 201 });
		} else {
			const tags = await deleteTag(tagId, walletAddress);
			if (tags === null) return NextResponse.json({ success: false, error: 'Failed to create tag' }, { status: 400 });
			return NextResponse.json({ success: true, tags: [tags] }, { status: 201 });
		}
	} catch (error) {
		console.error('Error deleting tag(s):', (error as Error).message);
		return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
	}
}
