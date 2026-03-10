'use client';

import React from 'react';
import { type Editor } from '@tiptap/react';
import Image from 'next/image';

type Props = {
	editor: Editor | null;
	isColor?: boolean;
	isLightMode?: boolean;
};

const Toolbar = ({ editor, isColor = false, isLightMode = false }: Props) => {
	if (!editor) {
		return null;
	}
	const activeBtn = `${
		isLightMode ? 'bg-[#D9D9D9]' : 'bg-[#323131]'
	} text-white p-[6px] rounded-lg`;

	return (
		<div
			className={` px-4 py-3  rounded-tl-md rounded-tr-md flex justify-between items-start
    gap-5 w-full flex-wrap border ${
		isLightMode ? 'border-[#1A1A1A]' : 'border-[#979797]'
	}`}
		>
			<div className='flex justify-start items-center gap-5 w-full  flex-wrap '>
				<button
					onClick={(e) => {
						e.preventDefault();
						editor.chain().focus().toggleBold().run();
					}}
					className={
						editor.isActive('bold') ? activeBtn : 'text-sky-400'
					}
				>
					{isLightMode ? (
						<Image
							src={'/editor/boldDark.svg'}
							alt={'bold'}
							width={15}
							height={15}
							className=' fill-white'
						/>
					) : (
						<Image
							src={'/editor/bold.svg'}
							alt={'bold'}
							width={15}
							height={15}
							className=' fill-white'
						/>
					)}
				</button>
				<button
					onClick={(e) => {
						e.preventDefault();
						editor.chain().focus().toggleItalic().run();
					}}
					className={
						editor.isActive('italic') ? activeBtn : 'text-sky-400'
					}
				>
					{isLightMode ? (
						<Image
							src={'/editor/italicDark.svg'}
							alt={'italic'}
							width={15}
							height={15}
							className=' fill-white'
						/>
					) : (
						<Image
							src={'/editor/italic.svg'}
							alt={'italic'}
							width={15}
							height={15}
							className=' fill-white'
						/>
					)}
				</button>
				<button
					onClick={(e) => {
						e.preventDefault();
						editor.chain().focus().toggleUnderline().run();
					}}
					className={
						editor.isActive('underline')
							? activeBtn
							: 'text-sky-400'
					}
				>
					{isLightMode ? (
						<Image
							src={'/editor/underlineDark.svg'}
							alt={'underline'}
							width={15}
							height={15}
							className=' fill-white'
						/>
					) : (
						<Image
							src={'/editor/underline.svg'}
							alt={'underline'}
							width={15}
							height={15}
						/>
					)}
				</button>
				<button
					onClick={(e) => {
						e.preventDefault();
						editor.chain().focus().toggleStrike().run();
					}}
					className={
						editor.isActive('strike') ? activeBtn : 'text-sky-400'
					}
				>
					{isLightMode ? (
						<Image
							src={'/editor/strikethroughDark.svg'}
							alt={'strikethrough'}
							width={15}
							height={15}
							className=' fill-white'
						/>
					) : (
						<Image
							src={'/editor/strikethrough.svg'}
							alt={'strikethrough'}
							width={15}
							height={15}
						/>
					)}
				</button>
				{isColor && (
					<input
						type='color'
						onInput={(event) =>
							editor
								.chain()
								.focus()
								.setColor(event?.currentTarget.value)
								.run()
						}
						className='bg-transparent border-none h-[25px] w-[25px]'
						value={editor.getAttributes('textStyle').color}
						data-testid='setColor'
					/>
				)}
				<button
					onClick={(e) => {
						e.preventDefault();
						editor.chain().focus().undo().run();
					}}
					className={
						editor.isActive('undo')
							? activeBtn
							: `text-sky-400 ${
									isLightMode
										? 'hover:bg-[#D9D9D9]'
										: 'hover:bg-[#323131]'
							  }  hover:text-white p-2 hover:rounded-lg`
					}
				>
					{isLightMode ? (
						<Image
							src={'/editor/undoDark.svg'}
							alt={'undo'}
							width={15}
							height={15}
							className=' fill-white'
						/>
					) : (
						<Image
							src={'/editor/undo.svg'}
							alt={'undo'}
							width={15}
							height={15}
						/>
					)}
				</button>
				<button
					onClick={(e) => {
						e.preventDefault();
						editor.chain().focus().redo().run();
					}}
					className={
						editor.isActive('redo')
							? activeBtn
							: `text-sky-400 ${
									isLightMode
										? 'hover:bg-[#D9D9D9]'
										: 'hover:bg-[#323131]'
							  }  hover:text-white -ml-3 p-2 hover:rounded-lg`
					}
				>
					{isLightMode ? (
						<Image
							src={'/editor/redoDark.svg'}
							alt={'redo'}
							width={15}
							height={15}
							className=' fill-white'
						/>
					) : (
						<Image
							src={'/editor/redo.svg'}
							alt={'redo'}
							width={15}
							height={15}
						/>
					)}
				</button>
			</div>
			{/* {content && (
				<button
					type='submit'
					className='px-4 bg-sky-700 text-white py-2 rounded-md'
				>
					Add
				</button>
			)} */}
		</div>
	);
};

export default Toolbar;
