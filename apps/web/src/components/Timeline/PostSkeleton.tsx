import { Skeleton } from '@nextui-org/react';

export default function PostSkeleton() {
	return (
		<div className='w-[90%] m-2 md:w-[70%] bg-black rounded-md'>
			{/* Header Section */}
			<div className='p-4 bg-black rounded-t-md'>
				<div className='flex items-center gap-3'>
					{/* Avatar Skeleton */}
					<Skeleton className='rounded-full w-8 h-8' />
					{/* Username Skeleton */}
					<Skeleton className='h-4 w-32 rounded-lg' />
				</div>
				{/* Caption Skeleton */}
				<div className='mt-3 space-y-2'>
					<Skeleton className='h-3 w-full rounded-lg' />
					<Skeleton className='h-3 w-3/4 rounded-lg' />
				</div>
			</div>

			{/* Media Section */}
			<Skeleton className='w-full h-[400px] rounded-none' />

			{/* Footer Section */}
			<div className='p-4 bg-black rounded-b-md'>
				<div className='flex justify-between items-center'>
					{/* Like Button Skeleton */}
					<Skeleton className='w-8 h-8 rounded-full' />
					{/* Action Buttons Skeleton */}
					<div className='flex gap-3'>
						<Skeleton className='w-6 h-6 rounded-lg' />
						<Skeleton className='w-6 h-6 rounded-lg' />
						<Skeleton className='w-6 h-6 rounded-lg' />
					</div>
				</div>
			</div>
		</div>
	);
}

export function PostSkeletonList({ count = 3 }: { count?: number }) {
	return (
		<div className='flex flex-col gap-8 items-center justify-center w-full'>
			{Array.from({ length: count }).map((_, index) => (
				<PostSkeleton key={index} />
			))}
		</div>
	);
}
