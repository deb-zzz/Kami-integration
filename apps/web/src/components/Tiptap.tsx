'use client';

import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Toolbar from './Toolbar';
import Underline from '@tiptap/extension-underline';
import Paragraph from '@tiptap/extension-paragraph';
import { Color } from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import StripColorOnPaste from './StripColorOnPaste';

const Tiptap = React.forwardRef<
	HTMLDivElement,
	{
		onChange: (content: string) => void;
		content?: string;
		isColor?: boolean;
		focus?: boolean;
		tabIndex?: string;
		autoFocus?: boolean;
		onFocus?: () => void;
		isLightMode?: boolean;
	}
>(
	(
		{
			onChange,
			content,
			isColor,
			focus,
			tabIndex,
			autoFocus,
			onFocus,
			isLightMode = false,
		},
		ref
	) => {
		const handleChange = (newContent: string) => {
			onChange(newContent);
		};

		const editor = useEditor({
			extensions: [
				StarterKit,
				Paragraph,
				Underline,
				TextStyle,
				Color,
				...(isColor ? [] : [StripColorOnPaste]),
			],
			immediatelyRender: false,
			parseOptions: {
				preserveWhitespace: true,
			},
			editorProps: {
				attributes: {
					class: ` px-4 py-3 justify-start border-b border-x items-start w-full gap-3  text-[13px] pt-4 rounded-bl-md rounded-br-md outline-none ${
						isLightMode
							? 'text-[#1A1A1A] border-[#1A1A1A] caret-[#1A1A1A]'
							: 'text-[#f1f0eb]  border-[#979797] caret-[#f1f0eb]'
					}`,
					tabindex: tabIndex || '0',
				},
			},
			onUpdate: ({ editor }) => {
				handleChange(editor.getHTML());
			},
			content: content,
			autofocus: autoFocus,
		});

		// Handle focus prop
		React.useEffect(() => {
			if (focus && editor) {
				editor.commands.focus();
			}
		}, [focus, editor]);

		// Handle focus events
		React.useEffect(() => {
			if (editor) {
				editor.on('focus', () => {
					onFocus?.();
				});
			}
		}, [editor, onFocus]);

		const editorRef = React.useRef<HTMLDivElement>(null);

		return (
			<div className='w-full ' ref={ref}>
				<Toolbar
					editor={editor}
					isColor={isColor}
					isLightMode={isLightMode}
				/>
				<EditorContent
					ref={editorRef}
					style={{
						whiteSpace: 'pre-line',
						color: isLightMode ? '#1A1A1A' : '#f1f0eb',
					}}
					editor={editor}
				/>
			</div>
		);
	}
);

Tiptap.displayName = 'Tiptap';

export default Tiptap;
