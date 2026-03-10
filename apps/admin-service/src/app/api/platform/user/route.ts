import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);

	const email = searchParams.get('email');
	const name = searchParams.get('name');

	try {
		// Build WHERE conditions dynamically
		const conditions: string[] = [];
		if (email) {
			conditions.push(`LOWER(a.email) LIKE LOWER('%${email.trim().toLowerCase()}%')`);
		}
		if (name) {
			conditions.push(`LOWER(u."userName") LIKE LOWER('%${name.trim().toLowerCase()}%')`);
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

		const userAccounts = await prisma.$queryRawUnsafe(`
			SELECT a."walletAddress", a.email, a."createdAt", u."userName", u."avatarUrl"
			FROM "account" a
			LEFT JOIN "user" u ON a."walletAddress" = u."walletAddress"
			${whereClause}
		`);

		return NextResponse.json(userAccounts);
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}

export async function DELETE(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const walletAddress = searchParams.get('walletAddress');
	const email = searchParams.get('email');

	if (!walletAddress && !email) {
		return NextResponse.json({ error: 'Either wallet address or email is required' }, { status: 400 });
	}

	try {
		let userWalletAddress = walletAddress;

		// If email provided, look up the wallet address
		if (email) {
			const account = await prisma.account.findFirst({
				where: { email },
			});
			if (!account) {
				return NextResponse.json({ error: 'User not found' }, { status: 404 });
			}
			userWalletAddress = account.walletAddress ?? undefined;
		}

		if (!userWalletAddress) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		const collaborators = await prisma.collaborators.findMany({
			where: { userWalletAddress },
			include: {
				project: { include: { product: true } },
			},
		});

		// Check if user is a collaborator in other projects
		const collaborationsInOtherProjects = await prisma.collaborators.findMany({
			where: { userWalletAddress },
		});

		if (collaborationsInOtherProjects.length > 1) {
			return NextResponse.json(
				{
					error: 'Cannot delete user - they are a collaborator in other projects',
					collaborations: collaborationsInOtherProjects,
				},
				{ status: 400 }
			);
		}

		// Check if user owns projects with collaborators
		const projectsWithCollaborators = await prisma.project.findMany({
			where: {
				walletAddress: userWalletAddress,
				collaborators: {
					some: {}, // Has any collaborators
				},
			},
			include: {
				collaborators: true,
			},
		});

		if (projectsWithCollaborators.length > 0 && collaborators.length > 1) {
			return NextResponse.json(
				{
					error: 'Cannot delete user - they are involved in projects with other active collaborators',
					projects: projectsWithCollaborators,
				},
				{ status: 400 }
			);
		}

		const projectsImCollaboratingIn = await prisma.collaborators.findMany({
			where: {
				userWalletAddress,
			},
			include: {
				project: true,
			},
		});

		if (projectsImCollaboratingIn.length > 0 && collaborators.length > 1) {
			return NextResponse.json(
				{
					error: 'Cannot delete user - they are involved in projects with other active collaborators',
					projects: projectsImCollaboratingIn,
				},
				{ status: 400 }
			);
		}

		const assets = await prisma.asset.findMany({
			where: {
				walletAddress: userWalletAddress,
			},
		});

		if (assets.length > 0) {
			return NextResponse.json(
				{
					error: 'Cannot delete user - they have assets',
					assets: assets,
				},
				{ status: 400 }
			);
		}

		// Delete all associated records in a transaction
		await prisma.$transaction(async (tx) => {
			// Delete user's logs
			await tx.logs.deleteMany({
				where: {
					OR: [{ primaryWalletAddress: userWalletAddress }, { secondaryWalletAddress: userWalletAddress }],
				},
			});

			// Delete user's likes, follows, tips, etc
			await tx.like.deleteMany({
				where: { OR: [{ fromWalletAddress: userWalletAddress }, { toWalletAddress: userWalletAddress }] },
			});
			await tx.follow.deleteMany({
				where: { OR: [{ fromWalletAddress: userWalletAddress }, { toWalletAddress: userWalletAddress }] },
			});
			await tx.tip.deleteMany({
				where: { OR: [{ fromWalletAddress: userWalletAddress }, { toWalletAddress: userWalletAddress }] },
			});

			// Delete user's content
			await tx.playlist.deleteMany({ where: { walletAddress: userWalletAddress } });
			await tx.post.deleteMany({ where: { createdByAddress: userWalletAddress } });
			await tx.comment.deleteMany({ where: { createdByAddress: userWalletAddress } });
			await tx.voucher.deleteMany({ where: { walletAddress: userWalletAddress } });
			await tx.collaborators.deleteMany({ where: { userWalletAddress } });
			await tx.product.deleteMany({ where: { ownerWalletAddress: userWalletAddress } });
			await tx.collection.deleteMany({ where: { ownerWalletAddress: userWalletAddress } });
			await tx.project.deleteMany({ where: { walletAddress: userWalletAddress } });

			// Delete user's other records
			await tx.cartItems.deleteMany({ where: { walletAddress: userWalletAddress } });
			await tx.notifications.deleteMany({ where: { walletAddress: userWalletAddress } });

			// Finally delete the user and account records
			await tx.user.delete({ where: { walletAddress: userWalletAddress } });
			await tx.account.delete({ where: { walletAddress: userWalletAddress } });
		});

		return NextResponse.json({ message: 'User deleted successfully' });
	} catch (error) {
		console.error('Error deleting user:', error);
		return NextResponse.json({ error: `Internal server error${error instanceof Error ? `: ${error.message}` : ''}` }, { status: 500 });
	}
}
