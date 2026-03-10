'use client';

import { Modal, ModalContent, ModalBody, ModalHeader } from '@nextui-org/react';
import { type FC } from 'react';
import AudioEditor from '../MediaEditor/AudioEditor';

interface AudioEditorModalProps {
	isOpen: boolean;
	onClose: () => void;
	url: string;
	onTrimUpdate: (times: { startTime: number; endTime: number }) => void;
	setIsOpen: (isOpen: boolean) => void;
}

const AudioEditorModal: FC<AudioEditorModalProps> = ({
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
				closeButton: 'text-[#1A1A1A]',
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
							<AudioEditor
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

export default AudioEditorModal;
