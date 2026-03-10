'use client';

import {
	Modal,
	ModalContent,
	ModalBody,
	ModalHeader,
	ModalFooter,
	Button,
} from '@nextui-org/react';
import { type FC } from 'react';
import VideoEditor from '../MediaEditor/VideoEditor';

interface VideoEditorModalProps {
	isOpen: boolean;
	onClose: () => void;
	setIsOpen: (isOpen: boolean) => void;
	url: string;
	onTrimUpdate: (times: { startTime: number; endTime: number }) => void;
}

const VideoEditorModal: FC<VideoEditorModalProps> = ({
	isOpen,
	onClose,
	url,
	onTrimUpdate,
	setIsOpen,
}) => {
	return (
		<Modal
			isOpen={isOpen}
			onOpenChange={onClose}
			className='bg-[#D9D9D9] rounded-none p-5 m-0'
			backdrop='blur'
			classNames={{
				closeButton:
					'text-[#1A1A1A] text-[24px] font-bold top-5 right-3',
				body: 'p-6',
				base: 'bg-[#D9D9D9]',
				// backdrop: 'bg-[#D9D9D9]/40',
			}}
			size='4xl'
			scrollBehavior='normal'
		>
			<ModalContent>
				{(onClose) => (
					<>
						<ModalHeader className='text-[#1A1A1A] text-[24px] font-bold p-0 mb-4'>
							Select Preview Clip
						</ModalHeader>
						<ModalBody className='p-0 m-0'>
							<VideoEditor
								url={url}
								onTrimUpdate={onTrimUpdate}
								setIsOpen={setIsOpen}
							/>
						</ModalBody>
					</>
				)}
			</ModalContent>
		</Modal>
	);
};

export default VideoEditorModal;
