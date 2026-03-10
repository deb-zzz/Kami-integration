import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';

type Props = {
	params: {
		walletAddress: string;
	};
};

export async function GET(req: NextRequest, { params }: Props) {
	try {
		const { walletAddress } = params;
		const user = await prisma.user.findUnique({
			where: {
				walletAddress: walletAddress,
			},
			include: {
				tags: true,
			},
		});
		if (!user) {
			return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
		}
		return new Response(JSON.stringify({ tags: user.tags }), { status: 200 });
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Internal Server Error: ' + (error as Error).message }), { status: 500 });
	}
}
