import {
	Divider,
	Modal,
	ModalBody,
	ModalContent,
	Spinner,
} from '@nextui-org/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import BundleStep from './PublishTab/BundleStep';
import PublishStep from './PublishTab/PublishStep';
import SalesStep from './PublishTab/SalesStep';
import ProductStep from './PublishTab/ProductStep';
import { useLazyNFT } from '@/lib/VoucherContext';
import { useGlobalState } from '@/lib/GlobalContext';
import { publish, updateProject } from '@/apihandler/Project';
import { createCollection } from '@/apihandler/Collections';
import { AllProjectType, VoucherContextType } from '@/types';
import SuccessCard from './SuccessCard';
import { ToastMessage } from '../ToastMessage';
import PublishFeeModal from './PublishFeeModal';
import CreatePost from '../CreatePost';
import { IsImage } from '@/lib/Util';

type ProductType = 'Standard' | 'Claimable' | 'Series';

const Stepper = ({
	project,
	getData,
	isActionDisabled,
}: {
	project: AllProjectType;
	getData: () => void;
	isActionDisabled: boolean;
}) => {
	const [voucher, setVoucher] = useLazyNFT();
	const [isPublishing, setIsPublishing] = useState<boolean>(false);
	const [currentStep, setCurrentStep] = useState(0);
	const [isOpen, setIsOpen] = useState<boolean>(false);
	const [createIsOpen, setCreateIsOpen] = useState<boolean>(false);
	const [collectionId, setCollectionId] = useState<number | undefined>(
		undefined,
	);
	const [showUSDCModal, setShowUSDCModal] = useState<boolean>(false);
	const [verifiedStatus, setVerifiedStatus] = useState({
		0: false,
		1: false,
		2: false,
		3: false,
	});

	const [gs, setGs] = useGlobalState();
	const [content, setContent] = useState<{
		collectionId: number;
		productId: number;
		imageURl: string;
	}>({
		collectionId: 0,
		productId: 0,
		imageURl: '',
	});

	// Debounce ref for auto-save
	const debouncedSaveRef = useRef<NodeJS.Timeout>();

	useEffect(() => {
		if (isActionDisabled) {
			setVerifiedStatus({
				0: true,
				1: true,
				2: true,
				3: true,
			});
		}
	}, [isActionDisabled]);

	// Cleanup debounce timeout on unmount
	useEffect(() => {
		return () => {
			if (debouncedSaveRef.current) {
				clearTimeout(debouncedSaveRef.current);
			}
		};
	}, []);

	const update_project = useCallback(() => {
		// Clear any existing timeout
		if (debouncedSaveRef.current) {
			clearTimeout(debouncedSaveRef.current);
		}

		// Set new timeout to save after user stops typing
		debouncedSaveRef.current = setTimeout(async () => {
			try {
				// console.log('voucher', voucher);
				const prjt = {
					...project,
					draft: JSON.stringify({
						collection: {
							...voucher?.collection,
						},
						product: {
							name: voucher?.metadata?.name,
							description: voucher?.metadata?.description,
							attributes: voucher?.metadata?.attributes?.filter(
								(attr) =>
									attr.trait_type !== '' && attr.value !== '',
							),
							image: voucher?.metadata?.image,
							animation_url: voucher?.metadata?.animation_url,
							price: voucher?.price,
							quantity: voucher?.quantity,
							items: voucher?.metadata?.properties?.bundle,
							coverUrl: voucher?.coverUrl,
							mediaUrl: voucher?.mediaUrl,
							tags: voucher?.tags,
						},
					}),
				};

				// this memang commented, dont uncomment. if (prjt.status === 'Publish') return;

				const val = await updateProject(
					prjt?.walletAddress ?? '',
					prjt?.id ?? 0,
					{
						id: prjt?.id ?? 0,
						name: prjt?.name ?? '',
						description: prjt?.description ?? '',
						categoryId: prjt?.categoryId ?? undefined,
						collaborators: prjt?.collaborators ?? [],
						user: prjt?.user,
						draft: prjt?.draft,
					},
				);
			} catch (error) {
				console.error('Failed to auto-save project:', error);
			}
		}, 1500); // Save 1.5 seconds after user stops typing
	}, [project, voucher]);

	const steps = [
		{
			name: 'Product',
			child: (
				<ProductStep
					project={project}
					onVerify={(verified) => {
						setVerifiedStatus({ ...verifiedStatus, 0: verified });
						//update_project();
					}}
					isActionDisabled={isActionDisabled}
				/>
			),
		},
		{
			name: 'Sales',
			child: (
				<SalesStep
					onVerify={(verified) => {
						setVerifiedStatus({ ...verifiedStatus, 1: verified });
						// update_project();
					}}
					isActionDisabled={isActionDisabled}
					chainId={project.collection?.chainId ?? ''}
					published={project.isPublished!}
				/>
			), //onNext={}
		},
		{
			name: 'Bundle',
			child: (
				<BundleStep
					project={project}
					onVerify={(verified) => {
						// console.log(verified, 'strepper');
						setVerifiedStatus({ ...verifiedStatus, 2: verified });
						update_project();
					}}
					isActionDisabled={isActionDisabled}
				/>
			), //onNext={} />,
		},
		{
			name: 'Publish',
			child: (
				<PublishStep
					project={project}
					isActionDisabled={isActionDisabled}
				/>
			), // onNext={} />,
			//onVerify={(verified) => {
			// console.log(verified, 'strepper');
			//setVerifiedStatus({ ...verifiedStatus, 3: verified });
			//}} />,
		},
	];

	const nextStep = () => {
		// console.log('voucher', voucher);
		if (currentStep < steps.length - 1) {
			const fow = currentStep + 1;
			// console.log(currentStep, verifiedStatus[0]);
			if (isActionDisabled) {
				setCurrentStep(fow);
			} else {
				switch (currentStep) {
					case 0:
						if (verifiedStatus[0]) setCurrentStep(fow);
						break;
					case 1:
						if (verifiedStatus[1]) setCurrentStep(fow);
						break;
					case 2:
						if (verifiedStatus[2]) setCurrentStep(fow);
						break;
					case 3:
						if (verifiedStatus[3]) setCurrentStep(fow);
						break;
				}
			}
		}
	};

	const prevStep = () => {
		if (currentStep > 0) {
			setCurrentStep(currentStep - 1);
		}
	};
	const clickStep = (step: number) => {
		setCurrentStep(step);
	};

	const clearDraft = async () => {
		const val = await updateProject(
			project?.walletAddress ?? '',
			project?.id ?? 0,
			{
				...project,
				draft: '{}',
			},
		);
	};

	const onClickPublish = async () => {
		setShowUSDCModal(false);
		try {
			if (voucher && gs?.profile && gs.walletAddress) {
				setIsPublishing(true);

				const collection = project.collection?.collectionId;

				// if (collection === undefined) {
				// 	const { collectionId } = await createCollection(
				// 		gs.walletAddress,
				// 		{
				// 			name: voucher.collection?.name,
				// 			symbol: voucher.collection?.symbol,
				// 			description: voucher.collection?.description,
				// 			type: voucher.collection?.type!,
				// 			projectId: project.id,
				// 			chainId: voucher.chainId ?? '',
				// 		},
				// 	);
				// 	collection = collectionId;
				// }

				let mediaURL = voucher.mediaUrl;
				let coverURL = voucher.coverUrl;
				setCollectionId(collection);

				const dat = {
					...voucher,
					collectionId: collection ?? undefined,
					newCollection: collection
						? undefined
						: {
								name: voucher.collection?.name ?? '',
								symbol: voucher.collection?.symbol ?? '',
								description:
									voucher.collection?.description ?? '',
								type: voucher.collection?.type!,
								projectId: project.id,
								chainId: voucher.chainId!,
							},
					chainId: voucher.chainId!,
					projectId: project.id,
					mediaFile: undefined,
					coverFile: undefined,
					walletAddress: gs?.walletAddress,
					type: (voucher.collection?.type === 'ERC721AC'
						? 'Claimable'
						: voucher.collection?.type === 'ERC721C'
							? 'Standard'
							: voucher.type) as ProductType,
					metadata: {
						...voucher.metadata,
						attributes: voucher?.metadata?.attributes?.filter(
							(attr) =>
								attr.trait_type !== '' && attr.value !== '',
						),
						image: coverURL !== undefined ? coverURL : mediaURL,
						animation_url:
							mediaURL && !IsImage(mediaURL)
								? mediaURL
								: undefined,
						properties: {
							...voucher.metadata?.properties,
							bundle: voucher.metadata?.properties?.bundle?.map(
								(val) => {
									return {
										...val,
										owner_description: val.ownerDescription,
										cover_url: val.assetCover,
										type: val.type,
										uri: val.uri,
										uriFile: undefined,
										assetCoverFile: undefined,
									};
								},
							),
						},
					},
				};

				const rut = await publish(dat as VoucherContextType, [
					{
						name: gs.profile.userName ?? '',
						address: gs.walletAddress,
						share: 100,
					},
				]);
				setIsPublishing(false);
				if (rut && rut.success) {
					setContent({
						collectionId: rut.collectionId,
						productId: rut.productId,
						imageURl: rut.voucher.mediaUrl,
					});
					setCollectionId(rut?.collectionId);
					clearDraft();
					setIsOpen(true);
				}
			}
		} catch (e) {
			console.log('Error on publish', e);
			ToastMessage('error', 'Unable to publish. Please try again later.');
			setIsPublishing(false);
		}
	};
	return (
		<div className='h-full  flex flex-col justify-between gap-10'>
			<div className='w-full flex flex-row gap-5 mb-4'>
				{steps.map((step, index) => (
					<div
						key={index}
						className='flex w-auto flex-row gap-2 items-center'
					>
						<div>
							<div
								// onClick={() => clickStep(index)}
								className={`w-9 h-9 rounded-full cursor-pointer flex items-center justify-center ${
									index <= currentStep
										? 'bg-[#11FF49] text-black text-[16px]'
										: 'bg-[#9E9E9D] text-[#F1F0EB]'
								}`}
							>
								0{index + 1}
							</div>
						</div>

						<p className='text-[20px] text-[#1A1A1A]'>
							{step.name}
						</p>

						<Divider
							className={`h-[0.5px] max-w-[45px]  mr-10 ml-2 ${
								index <= currentStep - 1
									? 'bg-[#1A1A1A]'
									: 'bg-[#9E9E9D]'
							}  ${
								steps.length - 1 === index ? 'hidden' : 'block'
							}`}
						/>
					</div>
				))}
			</div>
			{/* <div className='text-center mb-4'>{steps[currentStep]}</div> */}
			<div>{steps[currentStep].child}</div>
			<div className='flex justify-end gap-5'>
				{currentStep !== 0 && (
					<button
						className='w-[150px] py-2 bg-[#D9D9D9] text-[16px] font-semibold text-black rounded-lg disabled:opacity-50'
						onClick={prevStep}
					>
						Previous
					</button>
				)}

				{currentStep !== steps.length - 1 && (
					<button
						onClick={nextStep}
						disabled={
							isActionDisabled
								? false
								: verifiedStatus[
											currentStep as keyof typeof verifiedStatus
									  ]
									? false
									: true
						}
						className='w-[150px] py-2 bg-[#11FF49] text-[16px] font-semibold  text-black rounded-lg disabled:text-[#9E9E9D] disabled:opacity-50 disabled:bg-[#D9D9D9]'
					>
						Next
					</button>
				)}
				{currentStep === steps.length - 1 && !isActionDisabled && (
					<button
						onClick={async () => {
							// Open USDC fee modal();

							setShowUSDCModal(true);
						}}
						className='w-[150px] py-2 bg-[#D9D9D9] text-[16px] font-semibold text-black rounded-lg disabled:opacity-50'
					>
						Publish
					</button>
				)}
			</div>
			<Modal isOpen={isPublishing}>
				<ModalContent className='bg-[#6c6c6b] text-black text-center p-4 '>
					<ModalBody>
						<p className='text-white'>{'Uploading...'}</p>
						<Spinner size='lg' color='default' />
					</ModalBody>
				</ModalContent>
			</Modal>
			<SuccessCard
				collectionId={collectionId!}
				projectId={project.id}
				isOpen={isOpen}
				setIsOpen={setIsOpen}
				reset={() => {
					setIsOpen(false);
					setCurrentStep(0);
					getData();
				}}
				setCreateIsOpen={setCreateIsOpen}
			/>

			{/* USDC Fee Modal */}
			<PublishFeeModal
				showUSDCModal={showUSDCModal}
				setShowUSDCModal={setShowUSDCModal}
				walletAddress={gs?.walletAddress ?? ''}
				onClickPublish={() => onClickPublish()}
			/>

			<CreatePost
				isOpen={createIsOpen}
				setIsOpen={setCreateIsOpen}
				isRepost={false}
				content={[content]}
				walletAddress={gs?.walletAddress}
				isPublish={true}
			/>
		</div>
	);
};

export default Stepper;
