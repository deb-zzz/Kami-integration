import { comment, post, postContent, Prisma } from '@prisma/client';

export type PostData = Prisma.postGetPayload<{
	include: {
		comments: { include: { likes: true; replies: { include: { likes: true } } } };
		content: { include: { collection: true; product: { include: { asset: true; voucher: true } }; asset: true } };
		likes: true;
		createdBy: true;
		postedBy: true;
		sharedBy: true;
		parentPost: true;
		childPosts: true;
	};
}>;

export type SinglePostData = {
	id: number;
	likes: number;
	likedByMe: boolean;
	repost: boolean;
	shares: number;
	views: number;
	createdAt: number;
	postedAt: number;
	reposts: number;
	content: postContent[];
	comments: Prisma.commentGetPayload<
		{
			include: {
				// likes: true;
				replies: true;
			};
		} & {
			likedByMe: boolean;
			likes: number;
			replies: comment &
				{
					likedByMe: boolean;
					likes: number;
				}[];
		}
	>[];
	parentPostId: number;
	parentPost: post | null;
	caption: string;
	createdBy: {
		firstName: string;
		lastName: string;
		avatarUrl: string;
		userName: string;
		walletAddress: string;
		parentPost: post | null;
	};
	postedBy: {
		firstName: string;
		lastName: string;
		avatarUrl: string;
		userName: string;
		walletAddress: string;
	};
};

export type Success = {
	success: true;
	posts?: PostData[];
};

export type SuccessSingle = {
	success: true;
	posts?: SinglePostData[];
};

export type Fail = {
	success: false;
	error?: string;
};
