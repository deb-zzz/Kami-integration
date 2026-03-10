import { MentionDropdown } from '@/components/MentionDropdown';
import { detectMentionContext, insertMention } from '@/lib/mention-utils';
import { addToMentionCache } from '@/lib/mention-cache';
import { Profile } from '@/types';
import { Textarea, TextAreaProps } from '@nextui-org/react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface MentionTextareaProps extends Omit<TextAreaProps, 'onValueChange' | 'onKeyDown'> {
	onValueChange?: (value: string) => void;
	onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
	walletAddress: string;
}

export const MentionTextarea = ({ onValueChange, onKeyDown, walletAddress, ...textareaProps }: MentionTextareaProps) => {
	const [value, setValue] = useState('');
	const [showDropdown, setShowDropdown] = useState(false);
	const [mentionQuery, setMentionQuery] = useState('');
	const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
	const [cursorPosition, setCursorPosition] = useState(0);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Clear internal state when external value becomes empty
	useEffect(() => {
		if (textareaProps.value === '') {
			setValue('');
			setShowDropdown(false);
		}
	}, [textareaProps.value]);

	const handleValueChange = useCallback(
		(newValue: string) => {
			setValue(newValue);
			onValueChange?.(newValue);

			// Get cursor position
			const cursorPos = textareaRef.current?.selectionStart || 0;
			setCursorPosition(cursorPos);

			// Check for mention context
			const mentionContext = detectMentionContext(newValue, cursorPos);

			if (mentionContext && mentionContext.query.length > 0) {
				// Show dropdown with mention query
				setMentionQuery(mentionContext.query);
				setShowDropdown(true);
				setSelectedIndex(0); // Reset selection when opening dropdown

				// Calculate dropdown position
				if (textareaRef.current) {
					const rect = textareaRef.current.getBoundingClientRect();
					const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
					const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

					const position = {
						top: rect.bottom + scrollTop + 5, // Position below the textarea
						left: rect.left + scrollLeft,
					};

					setMentionPosition(position);
				}
			} else {
				setShowDropdown(false);
			}
		},
		[onValueChange]
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			// Handle keyboard navigation when dropdown is open
			if (showDropdown) {
				switch (e.key) {
					case 'Enter':
					case 'ArrowDown':
					case 'ArrowUp':
						e.preventDefault();
						// Let the dropdown handle these keys
						return;
					case 'Escape':
						e.preventDefault();
						setShowDropdown(false);
						return;
				}
			}

			onKeyDown?.(e);
		},
		[onKeyDown, showDropdown]
	);

	const handleMentionSelect = useCallback(
		(profile: Profile) => {
			if (!profile.userName) return;

			// Cache the selected profile for mention parsing
			addToMentionCache(profile);

			const mentionContext = detectMentionContext(value, cursorPosition);
			if (mentionContext) {
				const newValue = insertMention(value, profile.userName, mentionContext.startIndex, mentionContext.endIndex);

				setValue(newValue);
				onValueChange?.(newValue);
				setShowDropdown(false);

				// Focus back to textarea
				setTimeout(() => {
					textareaRef.current?.focus();
				}, 0);
			}
		},
		[value, cursorPosition, onValueChange]
	);

	const handleMentionClose = useCallback(() => {
		setShowDropdown(false);
	}, []);

	return (
		<div className='relative'>
			<Textarea {...textareaProps} ref={textareaRef} value={value} onValueChange={handleValueChange} onKeyDown={handleKeyDown} />
			<MentionDropdown
				isOpen={showDropdown}
				query={mentionQuery}
				onSelect={handleMentionSelect}
				onClose={handleMentionClose}
				position={mentionPosition}
				walletAddress={walletAddress}
				selectedIndex={selectedIndex}
				onSelectedIndexChange={setSelectedIndex}
			/>
		</div>
	);
};
