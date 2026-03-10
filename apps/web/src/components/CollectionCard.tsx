import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CollectionType } from '@/types';
import { useGlobalState } from '@/lib/GlobalContext';
import { likeCollection, unlikeCollection } from '@/apihandler/Collections';
const CollectionCard = ({
	data,
	index,
}: {
	data: CollectionType;
	index: number;
}) => {
	const isPrivate = false;
	const [isLiked, setIsLiked] = useState<boolean>(data.likedByMe);
	const router = useRouter();
	const [gs, setGs] = useGlobalState();
	const likedCollection = async () => {
		if (gs?.walletAddress && data?.collectionId) {
			const res = await likeCollection(
				gs?.walletAddress,
				data.collectionId,
			);
			if (res.success) {
				setIsLiked(true);
			}
		}
	};

	const unlikedCollection = async () => {
		if (gs?.walletAddress && data?.collectionId) {
			const res = await unlikeCollection(
				gs?.walletAddress,
				data.collectionId,
			);

			if (res.success) {
				setIsLiked(false);
			}
		}
	};
	return (
		<div
			onClick={() => {
				if (!gs?.walletAddress) return;
				router.push('/collection/' + data.collectionId);
			}}
			className={`max-w-[232px] min-w-[200px] h-full flex flex-col relative ${
				gs?.walletAddress ? 'cursor-pointer' : 'cursor-default'
			}  `}
		>
			{isPrivate && (
				<div className='absolute right-3 top-3 z-50 opacity-100 '>
					<p className='px-1 bg-[#11FF49] text-black text-[11px] font-bold rounded-sm'>
						PRIVATE
					</p>
				</div>
			)}

			<div
				className={` border-3 border-[#F1F0EB] shadow-inner  relative ${
					isPrivate && 'opacity-60'
				} flex-2  z-10 w-[232px] h-[232px]`}
			>
				{data?.avatarUrl ? (
					<Image
						src={data?.avatarUrl}
						alt={'card1'}
						width='232'
						height='232'
						// sizes="100vw"
						className='w-[232px] h-[232px] object-cover '
					/>
				) : (
					<div className='w-[100%] h-[232px]  bg-gradient-to-b from-[#C4C4C4] to-[#5E5E5E]' />
				)}

				<>
					<div className='h-[50%] rounded-r-md bg-[#F1F0EB] w-[5px] absolute left-0  top-0 bottom-0 m-auto shadow-lg'></div>
					<div className='h-[50%] rounded-l-md bg-[#F1F0EB] w-[5px] absolute right-0  top-0 bottom-0 m-auto shadow-lg'></div>
				</>
			</div>
			<div
				className={`flex-1  py-2 bg-[#F1F0EB] text-[#1A1A1A] ${
					isPrivate && 'opacity-60'
				}`}
			>
				<div className='px-4'>
					<p className='font-bold line-clamp-1'>{data.name} </p>
					<p className='font-medium line-clamp-1'>
						{data.description}
					</p>
				</div>
				{gs?.walletAddress && (
					<div className='flex flex-row justify-end  px-3'>
						<div
							className='cursor-pointer'
							onClick={(e) => {
								e.stopPropagation();
								setIsLiked(!isLiked);
							}}
						>
							{isLiked ? (
								<Image
									onClick={() => unlikedCollection()}
									src={'/profile/gallery/fistGreen.svg'}
									alt={'fist'}
									width={30}
									height={30}
								/>
							) : (
								<Image
									onClick={() => likedCollection()}
									src={'/profile/gallery/fistOutline.svg'}
									alt={'fist'}
									width={30}
									height={30}
								/>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default CollectionCard;
