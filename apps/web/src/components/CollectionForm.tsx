import Image from 'next/image';
import {
	avatar,
	Input,
	Modal,
	ModalBody,
	ModalContent,
	ModalHeader,
	Textarea,
} from '@nextui-org/react';
import {
	Dispatch,
	SetStateAction,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useForm, useFieldArray, FieldError, set } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const schema = yup
	.object({
		name: yup.string().trim().min(2, 'Should be more than 2 characters').max(100, 'Must not exceed 100 characters').required(),
		type: yup.string().required('Type is required'),
		symbol: yup
			.string()
			.min(2, 'Should be more than 2 characters')
			.matches(/^\S*$/, 'Spaces are not allowed')
			.matches(
				/^[^\d\W][a-zA-Z0-9]*$/,
				'First character cannot be a number or symbol, and following can be alphanumeric'
			)
			.max(7, 'Recommended to keep the symbol less than 7 character')
			.required(),
		description: yup
			.string()
			.required('Collection description is required'),
		bannerUrl: yup.string(),
		avatarUrl: yup.string(),
	})

	.required();

const productType: {
	type: 'Standard' | 'Claimable' | 'Series';
	name: string;
	description: string;
	contractType: 'ERC721AC' | 'ERC721C' | 'ERC1155C' | 'ERC20';
}[] = [
	{
		type: 'Standard',
		contractType: 'ERC721C',
		name: 'One product with unique identity number',
		description: 'Eg: 1/1 Art, Generative Art',
	},
	{
		type: 'Claimable',
		contractType: 'ERC721AC',
		name: 'Multiple copies of one product each with unique identity number',
		description: 'Eg: Membership cards, Event tickets',
	},
	{
		type: 'Series',
		contractType: 'ERC1155C',
		name: 'Multiple copies of one product all with same identity number',
		description: 'Eg: Music, Comics, Movie, Podcast, Game Assets',
	},
] as const;

const CollectionForm = ({
	isOpenCollection,
	setIsOpenCollection,
}: {
	isOpenCollection: boolean;
	setIsOpenCollection: Dispatch<SetStateAction<boolean>>;
}) => {
	const {
		register,
		handleSubmit,
		control,
		trigger,
		getValues,
		formState: { errors },
		setValue,
	} = useForm({
		defaultValues: {
			name: '',
			type: '',
			symbol: '',
			description: '',
			bannerUrl: '',
			avatarUrl: '',
		},
		resolver: yupResolver(schema),
	});

	const [choosen, setChoosen] = useState<
		'ERC721AC' | 'ERC721C' | 'ERC1155C' | 'ERC20' | ''
	>('');
	const onSubmit = (data: {
		name: string;
		description: string;
		type: string;
		symbol: string;
		avatarUrl?: string;
		bannerUrl?: string;
	}) => {
		console.log('Form Submitted:');
	};
	const [avatarImage, setAvatarImage] = useState<
		{ file: any; uploadLink?: string; destination?: string } | undefined
	>(undefined);
	const [bannerImage, setBannerImage] = useState<
		{ file: any; uploadLink?: string; destination?: string } | undefined
	>(undefined);
	const avHiddenFileInput = useRef<HTMLInputElement>(null);
	const bnHiddenFileInput = useRef<HTMLInputElement>(null);
	const handleImageUpload = async (
		e: React.ChangeEvent<HTMLInputElement>,
		type: 'AV' | 'BN'
	) => {
		const img = e.target.files;
		if (!img) return;
		const file = img[0];
		if (file) {
			if (type === 'AV') {
				setAvatarImage({ file });

				setValue('avatarUrl', file.name);
			}
			if (type === 'BN') {
				setBannerImage({ file });
				setValue('bannerUrl', file.name);
			}
		}
	};
	const handleImageClick = (
		e: React.MouseEvent<HTMLDivElement>,
		type: 'AV' | 'BN'
	) => {
		// e.preventDefault();
		if (type === 'BN') {
			if (!bnHiddenFileInput || !bnHiddenFileInput.current) return;
			if (bnHiddenFileInput.current) {
				bnHiddenFileInput.current.value = '';
				bnHiddenFileInput.current.click();
			}
		}
		if (type === 'AV') {
			if (!avHiddenFileInput || !avHiddenFileInput.current) return;
			if (avHiddenFileInput.current) {
				avHiddenFileInput.current.value = '';
				avHiddenFileInput.current.click();
			}
		}
	};
	return (
		<Modal
			isOpen={isOpenCollection}
			onOpenChange={() => {
				setIsOpenCollection(!isOpenCollection);
			}}
			className='bg-[#f1f0eb] rounded-none p-5 m-0 h-fit'
			backdrop='blur'
			classNames={{
				closeButton: 'text-[#1A1A1A]',
				// backdrop: 'bg-[#D9D9D9]/40',
				// base: 'overflow-y-visible bg-[#D9D9D9]',
			}}
			size='4xl'
		>
			{' '}
			<ModalContent>
				{(onClose) => (
					<>
						<ModalHeader className='text-[#1A1A1A] p-0'>
							Create New Collection
						</ModalHeader>
						<ModalBody className='p-0 m-0 h-fit gap-0 w-full'>
							<form onSubmit={handleSubmit(onSubmit)}>
								<div>
									<p className='text-black font-semibold text-[16px]'>
										Type
										<span className='text-2xl text-red-600'>
											*
										</span>
									</p>
									<div className='flex flex-row gap-5 mt-3'>
										{productType.map((val, index) => (
											<div
												key={val.type}
												onClick={() => {
													setChoosen(
														val.contractType
													);
													setValue(
														'type',
														val.contractType
													);
												}}
												className={`flex-1 opacity-100 cursor-pointer flex flex-col gap-10 justify-between border border-[#1A1A1A] p-5 rounded-lg  ${
													choosen === val.contractType
														? 'bg-[#11FF49]'
														: 'bg-transparent'
												}`}
											>
												<p
													className={`text-[16px] font-semibold text-[#1A1A1A] `}
												>
													{val.name}
												</p>
												<p
													className={`text-[13px] text-[#6E6E6E] font-medium`}
												>
													{val.description}
												</p>
											</div>
										))}
									</div>
									<p className='text-red-500 capitalize text-[11px] mt-1 ml-1'>
										{(errors.type as FieldError)?.message ??
											''}
									</p>
								</div>
								<div className='w-full flex flex-row gap-5 mt-4'>
									<div className='w-full'>
										<p className='text-black font-semibold text-[16px]'>
											Collection Name
										</p>

										<p className='font-light text-[12px] text-[#6E6E6E]  w-[90%] xl:w-[80%]'>
											What your Collection will be called
											in the marketplace. Collection names
											cannot be changed after it has been
											published.
										</p>

										<Input
											size='md'
											variant='bordered'
											className='mt-4'
											placeholder='eg: Lucha Loco'
											classNames={{
												base: 'bg-transparent',
												input: 'group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold',
												inputWrapper: `border border-[#1A1A1A] group-data-[hover=true]:border-[#1A1A1A] group-data-[focus=true]:border-[#0D6EFD]  rounded-lg bg-transparent`,
											}}
											{...register('name')}
										/>
										<p className='text-red-500 capitalize text-[11px] mt-1 ml-1'>
											{errors.name?.message ?? ''}
										</p>
									</div>
									<div className='w-full'>
										<p className='text-black font-semibold text-[16px]'>
											Collection Identifier
										</p>

										<p className='font-light text-[12px] text-[#6E6E6E] w-[90%] xl:w-[80%]'>
											The shorthand identifier used to
											identify your Collection. Collection
											identifier cannot be changed after
											your Collection has been published.
										</p>

										<Input
											size='md'
											variant='bordered'
											className=' mt-4'
											style={{
												textTransform: 'uppercase',
											}}
											placeholder='eg: LOCO'
											{...register('symbol')}
											classNames={{
												base: 'bg-transparent',
												input: 'group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[#9E9E9D] placeholder:italic text-[16px] font-semibold',
												inputWrapper: `border border-[#1A1A1A] group-data-[hover=true]:border-[#1A1A1A] group-data-[focus=true]:border-[#0D6EFD] rounded-lg bg-transparent`,
											}}
										/>
										<p className='text-red-500 capitalize text-[11px] mt-1 ml-1'>
											{errors.symbol?.message ?? ''}
										</p>
									</div>
								</div>
								<div className='w-full flex flex-row gap-5 mt-4'>
									<div className='w-full'>
										<p className='text-black font-semibold text-[16px]'>
											Collection Description
										</p>
										<Textarea
											size='md'
											maxRows={20}
											variant='bordered'
											className='mt-3'
											{...register('description')}
											placeholder='Tell the story behind your Collection idea.'
											classNames={{
												base: 'bg-transparent',
												input: 'group-data-[has-value=true]:text-[#1A1A1A] placeholder:text-[13px] placeholder:text-[#9E9E9D] placeholder:font-light placeholder:italic text-[16px] font-semibold',
												inputWrapper: `border border-[#1A1A1A] group-data-[hover=true]:border-[#1A1A1A] group-data-[focus=true]:border-[#0D6EFD]  rounded-lg`,
											}}
										/>
										<p className='text-red-500 capitalize text-[11px] mt-1 ml-1'>
											{errors.description?.message ?? ''}
										</p>
									</div>
								</div>
								<div className='mt-4'>
									<p className='text-black font-semibold text-[16px]'>
										Collection Avatar
									</p>
									<div className='flex flex-row gap-5  items-center'>
										<div className='flex flex-row justify-between gap-3 mt-2 border border-[#1A1A1A] p-2 rounded-lg w-full'>
											<div className=' flex-1 wordWrap'>
												<p
													className={`text-[16px] ml-2 italic font-medium text-left  text-[#9e9e9d]`}
												>
													{avatarImage
														? avatarImage.file.name
														: 'Choose your file'}
												</p>
											</div>
											{avatarImage && (
												<Image
													className='cursor-pointer '
													src={
														'/creator/trashGrey.svg'
													}
													alt={'add'}
													width={23}
													height={23}
													onClick={async (e) => {
														setValue(
															'avatarUrl',
															''
														);
														setAvatarImage(
															undefined
														);
													}}
												/>
											)}
										</div>
										<div
											onClick={(e) =>
												handleImageClick(e, 'AV')
											}
											className='w-[40px] h-[40px] mt-2 cursor-pointer bg-[#D9D9D9] rounded-lg flex justify-center items-center'
										>
											<Image
												src={'/uploadIcon.svg'}
												alt={'add'}
												width={18}
												height={18}
											/>
											<input
												ref={avHiddenFileInput}
												className=''
												hidden
												type='file'
												accept='image/*'
												onChange={(e) =>
													handleImageUpload(e, 'AV')
												}
											/>
										</div>
									</div>
									<p className='text-red-500   text-[11px] mt-1 ml-1'>
										{errors.avatarUrl?.message ?? ''}
									</p>
								</div>
								<div className='mt-4'>
									<p className='text-black font-semibold text-[16px]'>
										Collection Banner
									</p>
									<div className='flex flex-row gap-5  items-center'>
										<div className='flex flex-row justify-between gap-3 mt-2 border border-[#1A1A1A] p-2 rounded-lg w-full'>
											<div className=' flex-1 wordWrap'>
												<p
													className={`text-[16px] ml-2 italic font-medium text-left  text-[#9e9e9d]`}
												>
													{bannerImage
														? bannerImage.file.name
														: 'Choose your file'}
												</p>
											</div>
											{bannerImage && (
												<Image
													className='cursor-pointer '
													src={
														'/creator/trashGrey.svg'
													}
													alt={'add'}
													width={23}
													height={23}
													onClick={async (e) => {
														setValue(
															'bannerUrl',
															''
														);
														setBannerImage(
															undefined
														);
													}}
												/>
											)}
										</div>
										<div
											onClick={(e) =>
												handleImageClick(e, 'BN')
											}
											className='w-[40px] h-[40px] mt-2 cursor-pointer bg-[#D9D9D9] rounded-lg flex justify-center items-center'
										>
											<Image
												src={'/uploadIcon.svg'}
												alt={'add'}
												width={18}
												height={18}
											/>
											<input
												ref={bnHiddenFileInput}
												className=''
												hidden
												type='file'
												accept='image/*'
												onChange={(e) =>
													handleImageUpload(e, 'BN')
												}
											/>
										</div>
									</div>
									<p className='text-red-500   text-[11px] mt-1 ml-1'>
										{errors.bannerUrl?.message ?? ''}
									</p>
								</div>

								<div className='w-full flex flex-row justify-end'>
									<button
										type='submit'
										className='w-[150px] py-2 mt-5 bg-[#D9D9D9] text-[16px] font-semibold text-black rounded-lg disabled:opacity-50'
									>
										Publish
									</button>
								</div>
							</form>
						</ModalBody>
					</>
				)}
			</ModalContent>
		</Modal>
	);
};

export default CollectionForm;
