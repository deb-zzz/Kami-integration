import { prisma } from '@/lib/db';
import { Prisma, product, like, asset, voucher, collection } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Profile = Prisma.userGetPayload<{
	include: {
		_count: { select: { likedBy: true; followedBy: true; cartItems: true } };
		assets: true;
		vouchers: true;
		product: {
			include: {
				collection: true;
				asset: true;
				voucher: true;
				likes: true;
			};
		};
		project: true;
	};
}>;

type ProductWithLikes = product & {
	likedByMe: boolean;
	likes: like[];
	asset: asset[];
	voucher: voucher | null;
	collection: collection | null;
};

type ProfileOutIntermediate = Profile & {
	counts: {
		likes: number;
		follows: number;
		cartItems: number;
	};
};

type ProfileOut = Omit<ProfileOutIntermediate, '_count'> & {
	product:
		| (product & {
				likedByMe: boolean;
				likes: like[];
				asset: asset[];
				voucher: voucher | null;
				collection: collection | null;
		  })[]
		| undefined;
};

type Success = {
	success: true;
	profile: ProfileOut;
};

type Fail = {
	success: false;
	error?: string;
};

type Props = { params: { walletAddress: string } };

export async function GET(req: NextRequest, { params }: Props): Promise<NextResponse<Success | Fail>> {
	// Validate the request
	const walletAddress = params.walletAddress;
	if (!walletAddress) {
		return NextResponse.json({ success: false, error: 'Missing wallet address parameter' }, { status: 400 });
	}

	// Set the selection flags
	const withAssets = (req.nextUrl.searchParams.get('withAssets') ?? undefined) !== undefined;
	const withProducts = (req.nextUrl.searchParams.get('withProducts') ?? undefined) !== undefined;
	const withProjects = (req.nextUrl.searchParams.get('withProjects') ?? undefined) !== undefined;

	// Fetch the user's profile from the database
	const profile = await prisma.user.findUnique({
		where: { walletAddress },
		include: {
			_count: { select: { likedBy: true, followedBy: true, cartItems: true } },
			assets: withAssets ? { include: { collection: true } } : undefined,
			vouchers: withAssets ? { include: { collection: true } } : undefined,
			product: withProducts ? { include: { collection: true, asset: true, voucher: true, likes: true } } : undefined,
			project: withProjects ? { include: { category: true, collaborators: true, collection: true } } : undefined,
			tags: true,
		},
	});

	// If the profile is not found, return a 404 response
	if (!profile) {
		console.log(JSON.stringify({ success: false, error: 'User profile not found' }));
		return NextResponse.json({ success: false, error: 'User profile not found' }, { status: 404 });
	}

	type ProfileWithProductWithLikes = Omit<Profile, 'product'> & {
		product: ProductWithLikes[] | undefined;
	};

	const profileWithProductWithLikes: ProfileWithProductWithLikes = {
		...profile,
		product:
			profile.product?.map(
				(product) =>
					({
						...product,
						likedByMe: false,
						likes: (product as ProductWithLikes).likes || [],
					} as ProductWithLikes)
			) || undefined,
	};

	// product liked by user
	if (profileWithProductWithLikes.product) {
		profileWithProductWithLikes.product.forEach((product) => {
			(product as ProductWithLikes).likedByMe = (product as ProductWithLikes).likes.some(
				(like) => like.fromWalletAddress === profile.walletAddress
			);
		});
	}

	const outputProfile = withProducts ? { ...profileWithProductWithLikes } : { ...profile, product: undefined };

	const profileOut: ProfileOut = {
		...outputProfile,
		counts: {
			likes: outputProfile._count.likedBy,
			follows: outputProfile._count.followedBy,
			cartItems: outputProfile._count.cartItems,
		},
		product:
			profile.product?.map(
				(product) =>
					({
						...product,
						likedByMe: Object.keys(profile).includes('product')
							? (product as ProductWithLikes).likes?.some((like: like) => like.fromWalletAddress === profile.walletAddress)
							: undefined,
						likes: (product as ProductWithLikes).likes || [],
					} as ProductWithLikes)
			) || undefined,
	};

	// Return the user's profile as JSON
	console.log(JSON.stringify({ success: true, profile }, null, 4));
	return NextResponse.json({ success: true, profile: profileOut });
}

export async function PUT(req: NextRequest, { params }: Props): Promise<NextResponse<Success | Fail>> {
	const walletAddress = params.walletAddress;
	if (!walletAddress) {
		return NextResponse.json({ success: false, error: 'Missing wallet address parameter' }, { status: 400 });
	}

	const body = await req.json();

	// Set the selection flags
	const withAssets = (req.nextUrl.searchParams.get('withAssets') ?? undefined) !== undefined;
	const withProducts = (req.nextUrl.searchParams.get('withProducts') ?? undefined) !== undefined;
	const withProjects = (req.nextUrl.searchParams.get('withProjects') ?? undefined) !== undefined;

	const profile = await prisma.user.update({
		where: { walletAddress },
		data: {
			...body,
			updatedAt: new Date().getTime() / 1000,
		},
		include: {
			_count: { select: { likedBy: true, followedBy: true, cartItems: true } },
			assets: withAssets,
			vouchers: withAssets,
			product: withProducts ? { include: { collection: true, asset: true, voucher: true } } : undefined,
			project: withProjects ? { include: { category: true, collaborators: true } } : undefined,
			tags: true,
		},
	});

	// Map the output
	const profileOut: ProfileOut = {
		...profile,
		counts: {
			likes: profile._count.likedBy,
			follows: profile._count.followedBy,
			cartItems: profile._count.cartItems,
		},
		product:
			profile.product?.map(
				(product) =>
					({
						...product,
						likedByMe: Object.keys(profile).includes('product')
							? (product as ProductWithLikes).likes?.some((like: like) => like.fromWalletAddress === profile.walletAddress)
							: undefined,
						likes: (product as ProductWithLikes).likes || [],
					} as ProductWithLikes)
			) || undefined,
	};
	return NextResponse.json({ success: true, profile: profileOut });
}
