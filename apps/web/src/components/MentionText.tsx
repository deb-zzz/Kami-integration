import { ParsedMention, parseMentions } from '@/lib/mention-utils';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface MentionTextProps {
	text: string;
	router: AppRouterInstance;
	className?: string;
}

export const MentionText = ({ text, router, className = '' }: MentionTextProps) => {
	const [segments, setSegments] = useState<ParsedMention[]>([]);

	useEffect(() => {
		const loadSegments = async () => {
			const parsedSegments = await parseMentions(text);
			setSegments(parsedSegments);
		};
		loadSegments();
	}, [text]);

	// Show loading state or fallback to plain text while processing
	if (segments.length === 0) {
		return <span className={className}>{text}</span>;
	}

	return (
		<span className={className}>
			{segments.map((segment, index) => {
				if (segment.type === 'mention' && segment.walletAddress) {
					return (
						<Link
							key={index}
							href={`/profile/${segment.walletAddress}`}
							className='text-[#4A9EFF] hover:text-[#66B3FF] hover:underline cursor-pointer font-medium transition-colors duration-200'
							onClick={(e) => {
								e.stopPropagation();
								router.push(`/profile/${segment.walletAddress}`);
							}}>
							{segment.content}
						</Link>
					);
				}
				return <span key={index}>{segment.content}</span>;
			})}
		</span>
	);
};
