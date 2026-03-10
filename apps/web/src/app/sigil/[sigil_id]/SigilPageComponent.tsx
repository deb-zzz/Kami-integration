'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Accordion, AccordionItem, Divider } from '@nextui-org/react';
import ShareModal from '@/components/ShareModal';
import { getSigilById } from '@/apihandler/Profile';
import { convertIPFSUrl } from '@/lib/Util';
import BackButton from '@/components/BackButton';

export default function SigilPageComponent({ sigilId }: { sigilId: string }) {
	// Get the dynamic route param from the URL: /sigil/[sigil_id]
	const [isOpenShare, setIsOpenShare] = useState(false);
	const [sigilData, setSigilData] = useState<any>(null);
	const [isCopied, setIsCopied] = useState(false);
	const AccordionStyle = {
		title: 'text-[#F1F0EB] text-[20px] font-semibold ',
		// base: 'm-0 p-0',
		titleWrapper: 'pt-5',
		heading: 'border-b-[0.5px] border-b-[#6E6E6E] w-full ',
		content: 'py-5 sigil-description',
	};

	useEffect(() => {
		getSigilData();
		console.log(sigilId);
	}, [sigilId]);

	const getSigilData = async () => {
		const res = await getSigilById(sigilId);
		if (res.success) {
			const response = await fetch(convertIPFSUrl(res.data.uri)!);
			let data = await response.json();
			console.log(data);
			data.image = convertIPFSUrl(data.image);
			setSigilData(data);
		}
	};

	const copyContractAddress = async () => {
		if (navigator.clipboard && sigilData?.contractAddress) {
			try {
				await navigator.clipboard.writeText(sigilData.contractAddress);
				setIsCopied(true);
				setTimeout(() => setIsCopied(false), 2000);
			} catch (err) {
				console.error('Failed to copy contract address: ', err);
			}
		}
	};

	return (
		<>
			<main className='min-h-screen w-full px-10 pb-10  text-[#F1F0EB] flex flex-col gap-5 justify-center '>
				<BackButton />
				<div className='w-full  '>
					{/* Top image */}
					<div className='relative bg-black flex items-center justify-center'>
						<div className='relative w-full max-w-3xl aspect-square'>
							{sigilData?.image && (
								<Image
									src={sigilData.image}
									alt={sigilData.name}
									fill
									className='object-contain'
								/>
							)}
						</div>
					</div>

					{/* Content */}
					<div className='py-14'>
						{/* Title + icons row */}
						<div className='flex flex-row items-center gap-4'>
							<div>
								<p className='text-xl md:text-3xl font-semibold'>
									Genesis KAMI Sigil: {sigilData?.name}
								</p>
								{/* <p className='text-sm text-[#C0C0C0] mt-1'>
									created by {gs?.profile?.userName}
								</p> */}
							</div>

							<div className='flex items-center gap-4 text-sm text-[#C0C0C0]'>
								{/* Placeholder action icons – replace with real icons if you have them */}
								<Image
									className='cursor-pointer '
									alt='Share'
									draggable='false'
									width={25}
									height={25}
									src={'/post/send.svg'}
									onClick={(e) => {
										e.stopPropagation();
										setIsOpenShare(true);
									}}
								/>
							</div>
						</div>

						<Divider className='bg-[#3A3A3A] my-6' />

						<div className='flex flex-col gap-8 w-1/2'>
							<Accordion
								defaultExpandedKeys={['1']}
								selectionMode='multiple'
							>
								<AccordionItem
									key='1'
									aria-label='Description'
									title='Description'
									classNames={AccordionStyle}
								>
									<p
										className='text-[13px] text-[#f1f0eb] mt-1'
										dangerouslySetInnerHTML={{
											__html: sigilData?.htmlDescription,
										}}
									/>
								</AccordionItem>
								<AccordionItem
									key='2'
									aria-label='Details'
									title='Details'
									classNames={AccordionStyle}
								>
									{sigilData?.attributes.map(
										(attribute: any, index: number) => (
											<div
												className='grid grid-cols-2 mb-3 font-light '
												key={index}
											>
												<p>{attribute.trait_type}</p>
												<p>{attribute.value}</p>
											</div>
										)
									)}
									<div className='grid grid-cols-2 mb-3 font-light '>
										<p>Contract Address</p>
										<div className='flex items-center gap-2'>
											<p>
												{sigilData?.contractAddress
													? `${sigilData.contractAddress.slice(
															0,
															4
													  )}......${sigilData.contractAddress.slice(
															-4
													  )}`
													: ''}
											</p>
											{sigilData?.contractAddress && (
												<>
													<Image
														className='cursor-pointer'
														alt='Copy'
														draggable='false'
														width={16}
														height={16}
														src={'/copy.svg'}
														onClick={
															copyContractAddress
														}
													/>
													{isCopied && (
														<p className='text-[#f1f0eb] '>
															Copied!
														</p>
													)}
												</>
											)}
										</div>
									</div>
									<div className='grid grid-cols-2 mb-3 font-light '>
										<p>Token ID</p>
										<p>{sigilData?.tokenId}</p>
									</div>
									<div className='grid grid-cols-2 mb-3 font-light '>
										<p>Token Standard</p>
										<p>{sigilData?.tokenStandard}</p>
									</div>
								</AccordionItem>
							</Accordion>
						</div>
					</div>
				</div>
			</main>
			<ShareModal
				isOpenShare={isOpenShare}
				setIsOpenShare={setIsOpenShare}
				// link={`https://platform.kami.ocu-napse.com/sigil/` + sigilId}
				link={`https://app.kamiunlimited.com/sigil/` + sigilId}
			/>
		</>
	);
}
