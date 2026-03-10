import { prisma } from '@/lib/db';
import { comment, Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Props type for the request parameters.
 * @typedef {Object} Props
 * @property {Object} params - The parameters object.
 * @property {string} params.walletAddress - The wallet address of the user.
 * @property {number} params.postId - The ID of the post.
 */
type Props = {
	params: {
		walletAddress: string;
		postId: number;
	};
};

/**
 * Successful response type for the GET request.
 * @typedef {Object} Posts
 * @property {boolean} success - Indicates the success of the request.
 * @property {boolean} iLike - Whether the user likes the post.
 * @property {number} likesCount - The total number of likes on the post.
 * @property {boolean} iBookmarked - Whether the user has bookmarked the post.
 * @property {number} bookmarksCount - The total number of bookmarks on the post.
 * @property {boolean} [iShared] - Whether the user has shared the post.
 * @property {number} [shareCount] - The total number of shares of the post.
 * @property {boolean} [iCommented] - Whether the user has commented on the post.
 * @property {comment[]} [comments] - The list of comments on the post.
 */
type Posts = {
	success: true;
	iLike: boolean;
	likesCount: number;
	iBookmarked: boolean;
	bookmarksCount: number;
	iShared?: boolean;
	shareCount?: number;
	iCommented?: boolean;
	comments?: comment[];
};

/**
 * Failure response type for the GET request.
 * @typedef {Object} Fail
 * @property {boolean} success - Indicates the failure of the request.
 * @property {string} error - The error message.
 */
type Fail = {
	success: false;
	error: string;
};

/**
 * Comment type with additional user information.
 * @typedef {Object} Comment
 * @property {Object} createdByUser - The user who created the comment.
 * @property {string} createdByUser.userName - The username of the comment creator.
 * @property {string} createdByUser.avatarUrl - The avatar URL of the comment creator.
 * @property {string} createdByUser.walletAddress - The wallet address of the comment creator.
 */
type Comment = Prisma.commentGetPayload<{
	include: { createdByUser: { select: { userName: true; avatarUrl: true; walletAddress: true } } };
}>;

/**
 * Handles GET requests to fetch post interaction details.
 *
 * @param {NextRequest} req - The incoming request object.
 * @param {Props} params - The request parameters containing walletAddress and postId.
 * @returns {Promise<NextResponse<Posts | Fail>>} - A promise that resolves to a NextResponse containing either a Posts or Fail object.
 */
export async function GET(req: NextRequest, { params }: Props): Promise<NextResponse<Posts | Fail>> {
	const { walletAddress, postId } = params;
	const inclComments = req.nextUrl.searchParams.get('comments') != null;
	try {
		// Count Likes
		const likes = await prisma.like.findMany({ where: { postId } });
		const likesCount = likes.length;
		const iLike = likes.findLast((like) => like.fromWalletAddress === walletAddress) !== undefined;

		// Other Counts
		const p = await prisma.post.findUnique({ where: { id: postId }, include: { savedBy: true, sharedBy: true } });
		const iBookmarked = p?.savedBy.findLast((bm) => bm.walletAddress === walletAddress) !== undefined;
		const bookmarksCount = p?.savedBy.length ?? 0;
		const iShared = p?.savedBy.findLast((s) => s.walletAddress === walletAddress) !== undefined;
		const shareCount = p?.sharedBy.length ?? 0;

		// Comments
		let comments: Comment[] | undefined = undefined;
		let iCommented: boolean | undefined = undefined;

		if (inclComments)
			comments = await prisma.comment.findMany({
				where: { postId },
				include: { createdByUser: { select: { userName: true, avatarUrl: true, walletAddress: true } } },
			});
		iCommented = comments?.findLast((c) => c.createdByUser.walletAddress === walletAddress) !== undefined;

		return NextResponse.json({
			success: true,
			iLike,
			likesCount: likesCount,
			iBookmarked,
			bookmarksCount,
			iShared,
			shareCount,
			iCommented,
			comments,
		});
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false, error: 'Failed to fetch likes' });
	}
}
