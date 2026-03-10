import { Profile } from '@/types';
import { getAllCachedProfiles } from './mention-cache';

export interface ParsedMention {
	type: 'text' | 'mention';
	content: string;
	username?: string;
	walletAddress?: string;
}

/**
 * Parses comment text to identify @mentions and regular text
 * @param text - The comment text to parse
 * @returns Array of parsed segments (text or mention)
 */
export async function parseMentions(text: string): Promise<ParsedMention[]> {
	if (!text) return [];

	// Get all profiles from the global cache
	const profiles = await getAllCachedProfiles();

	// Create a map of usernames to profiles for quick lookup
	const profileMap = new Map<string, any>();
	profiles.forEach((profile) => {
		if (profile.userName) {
			profileMap.set(profile.userName.toLowerCase(), profile);
		}
	});

	const segments: ParsedMention[] = [];
	const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
	let lastIndex = 0;
	let match;

	while ((match = mentionRegex.exec(text)) !== null) {
		// Add text before the mention
		if (match.index > lastIndex) {
			segments.push({
				type: 'text',
				content: text.slice(lastIndex, match.index),
			});
		}

		const username = match[1];
		const profile = profileMap.get(username.toLowerCase());

		if (profile && profile.walletAddress) {
			// Valid mention - create clickable link
			segments.push({
				type: 'mention',
				content: `@${username}`,
				username: username,
				walletAddress: profile.walletAddress,
			});
		} else {
			// Invalid mention - treat as regular text
			segments.push({
				type: 'text',
				content: match[0],
			});
		}

		lastIndex = match.index + match[0].length;
	}

	// Add remaining text after the last mention
	if (lastIndex < text.length) {
		segments.push({
			type: 'text',
			content: text.slice(lastIndex),
		});
	}

	return segments;
}

/**
 * Extracts all usernames mentioned in a text
 * @param text - The text to scan for mentions
 * @returns Array of mentioned usernames
 */
export function extractMentionedUsernames(text: string): string[] {
	if (!text) return [];

	const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
	const usernames: string[] = [];
	let match;

	while ((match = mentionRegex.exec(text)) !== null) {
		usernames.push(match[1]);
	}

	return usernames;
}

/**
 * Detects if the cursor is currently in a mention context
 * @param text - The current text
 * @param cursorPosition - The cursor position in the text
 * @returns Object with mention info if cursor is in mention, null otherwise
 */
export function detectMentionContext(
	text: string,
	cursorPosition: number
): {
	query: string;
	startIndex: number;
	endIndex: number;
} | null {
	// Find the last @ symbol before the cursor
	const textBeforeCursor = text.slice(0, cursorPosition);
	const lastAtIndex = textBeforeCursor.lastIndexOf('@');

	if (lastAtIndex === -1) return null;

	// Check if there's a space between @ and cursor (invalid mention)
	const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
	if (textAfterAt.includes(' ')) return null;

	// Extract the query (text after @)
	const query = textAfterAt;

	// Find the end of the mention (next space or end of text)
	const textAfterCursor = text.slice(cursorPosition);
	const nextSpaceIndex = textAfterCursor.indexOf(' ');
	const endIndex = nextSpaceIndex === -1 ? text.length : cursorPosition + nextSpaceIndex;

	return {
		query,
		startIndex: lastAtIndex,
		endIndex,
	};
}

/**
 * Inserts a mention into text at the specified position
 * @param text - The original text
 * @param mention - The username to insert
 * @param startIndex - Start position of the mention
 * @param endIndex - End position of the mention
 * @returns The text with the mention inserted
 */
export function insertMention(text: string, mention: string, startIndex: number, endIndex: number): string {
	const beforeMention = text.slice(0, startIndex);
	const afterMention = text.slice(endIndex);
	return beforeMention + `@${mention}` + afterMention;
}
