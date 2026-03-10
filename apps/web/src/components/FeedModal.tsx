import {
	Modal,
	ModalContent,
	ModalBody,
	useDisclosure,
} from '@nextui-org/react';
import Post from './Timeline/PostComponent';
import { Dispatch, SetStateAction } from 'react';
import { CommentSection } from '@/app/home/Comments';
import PostComponent from './Timeline/PostComponent';
import PostPageComponent from '@/app/(creator)/post/[id]/PostPageComponent';

const FeedModal = ({
	isOpen,
	setIsOpen,
	postId,
}: {
	isOpen: boolean;
	setIsOpen: Dispatch<SetStateAction<boolean>>;
	postId: string;
}) => {
	const { onOpen, onOpenChange } = useDisclosure();
	return (
		<Modal
			isOpen={isOpen}
			onOpenChange={() => setIsOpen(!isOpen)}
			className='bg-transparent rounded-none p-0 m-0 min-h-[500px] '
			classNames={{
				closeButton:
					' border-white border-2 text-white bg-black hover:bg-black absolute -right-12 top-0 ',
				body: '',
				backdrop: '',
				base: ' overflow-y-visible',
			}}
			size='4xl'
		>
			<ModalContent>
				{(onClose) => (
					<ModalBody className='p-0 m-0 h-fit flex-row gap-0'>
						{/* <PostComponent
							clickFunction={() => onOpen()}
							key={0}
							index={1}
						/> */}
						{/* <CommentSection data={undefined} /> // TODO */}
						<PostPageComponent postId={postId} isModal={true} />
					</ModalBody>
				)}
			</ModalContent>
		</Modal>
	);
};

export default FeedModal;
