import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';

type Props = {
	params: {
		productId?: string;
	};
};

export async function GET(req: NextRequest, { params }: Props) {
	try {
		const { productId } = params;
		const product = await prisma.product.findFirst({
			where: {
				id: Number(productId),
			},
			include: {
				tags: true,
			},
		});
		if (!product) {
			return new Response(JSON.stringify({ error: 'Product not found' }), { status: 404 });
		}
		return new Response(JSON.stringify({ tags: product.tags }), { status: 200 });
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Internal Server Error: ' + (error as Error).message }), { status: 500 });
	}
}
