import { prisma } from '@/lib/db';
import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Type definition for the route parameters.
 */
type Props = {
	params: {
		walletAddress: string;
		postId: string;
	};
};

/**
 * Type definition for the comment data.
 */
type Comment = {
	comment: string;
	replyToCommentId?: string;
};

/**
 * Handles POST requests to create a new comment on a post.
 * 
 * Creates a comment record in the database. If the comment is a reply (has replyToCommentId),
 * a notification is sent to the original comment author. Otherwise, a notification is sent
 * to the post creator. No notification is sent if the user is commenting on their own post/comment.
 *
 * @param request - The incoming request object containing the comment data in the body
 * @param params - The route parameters containing walletAddress and postId
 * @returns Promise resolving to NextResponse with success status
 * 
 * @example
 * POST /api/0x123.../post/456/comment
 * Body: { comment: "Great post!", replyToCommentId: "789" }
 * Response: { success: true }
 */
export async function POST(request: NextRequest, { params }: Props): Promise<NextResponse<{ success: boolean }>> {
	const { walletAddress, postId } = params;
	const { comment, replyToCommentId }: Comment = await request.json();
	
	try {
		// Create the comment record
		const camment = await prisma.comment.create({
			data: {
				createdAt: Date.now() / 1000,
				comment: comment,
				createdByAddress: walletAddress,
				postId: Number(postId),
				replyToCommentId: replyToCommentId ? Number(replyToCommentId) : null,
			},
			include: {
				createdByUser: true,
				post: true,
				replyToComment: true,
			},
		});

		// Determine who should receive the notification
		// If it's a reply, notify the comment author; otherwise notify the post creator
		const personToGetNotifications = replyToCommentId
			? camment.replyToComment?.createdByAddress
			: camment.post.createdByAddress;
		
		// Don't send notification if user is commenting on their own content
		if (personToGetNotifications === walletAddress) return NextResponse.json({ success: true });

		// Send notification to the appropriate recipient
		try {
			await axios.post(
				`http://notifications-service:3000/api/web-push/send?walletAddress=${personToGetNotifications}`,
				{
					topic: 'post-comment',
					payload: {
						postId: camment.postId,
						walletAddress: walletAddress,
						from: {
							avatarUrl: camment.createdByUser?.avatarUrl ?? null,
							userName: camment.createdByUser?.userName ?? null,
						},
						camment,
					},
					message: `${camment.createdByUser?.userName ? camment.createdByUser?.userName : 'Someone'} commented on your post`,
				}
			);
		} catch (error) {
			// Log notification error but don't fail the request
			console.log((error as Error).message);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false });
	}
}

/**
 * Handles DELETE requests to remove a comment.
 * 
 * Deletes a comment from the database. If the comment is a top-level comment (not a reply),
 * all of its replies are also deleted. If it's a reply, only that specific comment is deleted.
 *
 * @param request - The incoming request object containing the comment ID in the body
 * @returns Promise resolving to NextResponse with success status
 * 
 * Request body should contain:
 * - id: The ID of the comment to be deleted
 * 
 * @example
 * DELETE /api/0x123.../post/456/comment
 * Body: { id: 789 }
 * Response: { success: true }
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<{ success: boolean }>> {
	const { id }: { id: number } = await request.json();
	
	try {
		const comment = await prisma.comment.findUniqueOrThrow({ where: { id } });
		
		// If it's a reply, only delete that comment
		// If it's a top-level comment, delete it and all its replies
		if (comment.replyToCommentId) {
			await prisma.comment.delete({ where: { id } });
		} else {
			// Delete the comment and all replies to it
			await prisma.comment.deleteMany({
				where: {
					OR: [{ id }, { replyToCommentId: id }],
				},
			});
		}
		
		return NextResponse.json({ success: true });
	} catch (error) {
		console.log((error as Error).message);
		return NextResponse.json({ success: false });
	}
}
