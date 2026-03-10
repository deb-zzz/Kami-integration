import { cachedGetSinglePost } from '@/apihandler/Post';
import PostPageComponent from './PostPageComponent';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { id: string } }) {
	const post = await cachedGetSinglePost(Number(params?.id));
	// console.log(JSON.stringify(post, null, 2));
	const data: Metadata = {
		title: post.posts[0].content[0].product.name,
		description: post.posts[0].caption,
		openGraph: {
			title: post.posts[0].content[0].product.name,
			description: post.posts[0].caption,
			images: [
				{
					url:
						post.posts[0].content[0].product.voucher?.mediaUrl ??
						post.posts[0].content[0].product.asset?.[0]?.mediaUrl ??
						'',
					alt: post.posts[0].content[0].product.name,
					secureUrl:
						post.posts[0].content[0].product.voucher?.mediaUrl ??
						post.posts[0].content[0].product.asset?.[0]?.mediaUrl ??
						'',
				},
			],
			type: 'website',
		},
	};
	// console.log(JSON.stringify(data, null, 2));
	return data;
}

export default function Post({ params }: { params: { id: string } }) {
	return <PostPageComponent postId={params.id} />;
}
