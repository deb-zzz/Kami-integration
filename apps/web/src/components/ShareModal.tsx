import {
	Modal,
	ModalContent,
	ModalHeader,
	ModalBody,
	Tooltip,
} from '@nextui-org/react';
import { Dispatch, SetStateAction, useState } from 'react';
import {
	EmailIcon,
	EmailShareButton,
	FacebookIcon,
	FacebookMessengerIcon,
	FacebookMessengerShareButton,
	FacebookShareButton,
	LinkedinIcon,
	LinkedinShareButton,
	TelegramIcon,
	TelegramShareButton,
	TwitterShareButton,
	WhatsappIcon,
	WhatsappShareButton,
	XIcon,
} from 'react-share';
import Image from 'next/image';
import { trackPostShareApi } from '@/apihandler/Post';

const ShareModal = ({
	isOpenShare,
	setIsOpenShare,
	link,
	postId,
	walletAddress,
	onShareSuccess,
}: {
	isOpenShare: boolean;
	setIsOpenShare: Dispatch<SetStateAction<boolean>>;
	link: string;
	postId?: number;
	walletAddress?: string;
	onShareSuccess?: () => void;
}) => {
	const shareUrl = window.location.href; // Get the current URL to share
	const [isCopied, setIsCopied] = useState(false);

	const copyToClipboard = async () => {
		if (navigator.clipboard) {
			try {
				await navigator.clipboard.writeText(link);
				setIsCopied(true);
				setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
			} catch (err) {
				console.error('Failed to copy text: ', err);
			}
		}
	};

	const trackPostShare = async () => {
		try {
			if (walletAddress && postId) {
				const res = await trackPostShareApi(walletAddress, postId);
				if (res.success) {
					console.log('Share tracked successfully');
					onShareSuccess?.();
				} else {
					console.error('Failed to track share');
				}
			} else {
				onShareSuccess?.();
			}
		} catch (e) {
			console.error('Failed to track share: ', e);
			onShareSuccess?.();
		}
	};
	return (
		<Modal
			isOpen={isOpenShare}
			onOpenChange={() => {
				setIsOpenShare(!isOpenShare);
			}}
			className='bg-[#f1f0eb] rounded-none p-5 m-0 h-fit'
			backdrop='blur'
			classNames={{
				closeButton: 'text-[#1A1A1A]',
				// backdrop: 'bg-[#D9D9D9]/40',
				// base: 'overflow-y-visible bg-[#D9D9D9]',
			}}
			size='md'
		>
			{' '}
			<ModalContent>
				{(onClose) => (
					<>
						<ModalHeader className='text-[#1A1A1A] p-0'>
							Share
						</ModalHeader>
						<ModalBody className='p-0 m-0 h-fit gap-0 w-full'>
							<div className='flex flex-row justify-between items-center p-4 '>
								<FacebookShareButton
									url={link}
									onClick={trackPostShare}
								>
									<FacebookIcon size={32} round />
								</FacebookShareButton>
								<FacebookMessengerShareButton
									url={link}
									onClick={trackPostShare}
									appId='521270401588372'
								>
									<FacebookMessengerIcon size={32} round />
								</FacebookMessengerShareButton>
								<TwitterShareButton
									url={link}
									onClick={trackPostShare}
								>
									<XIcon size={32} round />
								</TwitterShareButton>
								<TelegramShareButton
									url={link}
									onClick={trackPostShare}
								>
									<TelegramIcon size={32} round />
								</TelegramShareButton>
								<WhatsappShareButton
									url={link}
									separator=':: '
									onClick={trackPostShare}
								>
									<WhatsappIcon size={32} round />
								</WhatsappShareButton>
								<LinkedinShareButton
									url={link}
									onClick={trackPostShare}
								>
									<LinkedinIcon size={32} round />
								</LinkedinShareButton>
								<EmailShareButton
									url={link}
									body='body'
									onClick={trackPostShare}
								>
									<EmailIcon size={32} round />
								</EmailShareButton>
								{/* <ViberShareButton url={link}>
									<ViberIcon size={32} round />
								</ViberShareButton> */}
								<Tooltip
									content='Copied'
									isOpen={isCopied}
									size='sm'
									className='bg-[#323131] text-[#F1F0EB] '
								>
									<div className='bg-[#000000c7] w-[32px] h-[32px] rounded-full cursor-pointer flex flex-row justify-center items-center'>
										<Image
											src={'/copy.svg'}
											alt={'cup'}
											width={15}
											height={15}
											onClick={copyToClipboard}
										/>
									</div>
								</Tooltip>
							</div>
						</ModalBody>
					</>
				)}
			</ModalContent>
		</Modal>
	);
};

export default ShareModal;
