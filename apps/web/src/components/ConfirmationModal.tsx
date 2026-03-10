'use client';
import {
	Modal,
	ModalContent,
	ModalHeader,
	ModalBody,
	ModalFooter,
	Button,
} from '@nextui-org/react';
import { Dispatch, SetStateAction } from 'react';

interface ConfirmationModalProps {
	isOpen: boolean;
	setIsOpen: Dispatch<SetStateAction<boolean>>;
	title?: string;
	message?: string;
	confirmText?: string;
	cancelText?: string;
	onResult: (confirmed: boolean) => void;
}

const ConfirmationModal = ({
	isOpen,
	setIsOpen,
	title = 'Confirm Action',
	message = 'Are you sure you want to proceed?',
	confirmText = 'Confirm',
	cancelText = 'Cancel',
	onResult,
}: ConfirmationModalProps) => {
	const handleConfirm = () => {
		onResult(true);
		setIsOpen(false);
	};

	const handleCancel = () => {
		onResult(false);
		setIsOpen(false);
	};

	return (
		<Modal
			isOpen={isOpen}
			onOpenChange={() => setIsOpen(!isOpen)}
			className='bg-[#f1f0eb] rounded-none p-5 m-0 h-fit'
			backdrop='blur'
			classNames={{
				closeButton: 'text-[#1A1A1A]',
			}}
			size='md'
		>
			<ModalContent>
				{(onClose) => (
					<>
						<ModalHeader className='text-[#1A1A1A] p-0'>
							{title}
						</ModalHeader>
						<ModalBody className='p-0 m-0 h-fit gap-0 w-full pt-4'>
							<p className='text-[#1A1A1A]'>{message}</p>
						</ModalBody>
						<ModalFooter className='p-0 pt-4 items-center'>
							<Button
								variant='light'
								size='sm'
								onPress={handleCancel}
								className='text-[#1A1A1A] text-[13px]'
							>
								{cancelText}
							</Button>
							<Button
								variant='solid'
								onPress={handleConfirm}
								size='sm'
								className='bg-[#11FF49] text-[13px] font-bold text-[#1a1a1a]  rounded-md'
							>
								{confirmText}
							</Button>
						</ModalFooter>
					</>
				)}
			</ModalContent>
		</Modal>
	);
};

export default ConfirmationModal;
