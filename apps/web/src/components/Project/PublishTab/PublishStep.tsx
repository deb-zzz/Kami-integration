'use client';

import { getPlatformFeeForPublish } from '@/apihandler/Project';
import PlatformFeeCalculator from '@/components/PlatformFeeCalculator';
import { useGlobalState } from '@/lib/GlobalContext';
import useKamiWallet from '@/lib/KamiWalletHook';
import { useLazyNFT } from '@/lib/VoucherContext';
import { AllProjectType, CollaboratorType, PlatformFeeType } from '@/types';
import {
	Table,
	TableHeader,
	TableColumn,
	TableBody,
	TableRow,
	TableCell,
	getKeyValue,
} from '@nextui-org/react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

type RevenueType = {
	creator: string;
	role: string;
	share: number;
	status: string;
	walletAddress?: string;
};

export default function PublishStep({
	project,
	isActionDisabled,
}: {
	project: AllProjectType;
	isActionDisabled: boolean;
}) {
	const { register, handleSubmit } = useForm();

	const wallet = useKamiWallet();
	const [voucher] = useLazyNFT();

	const [revenue, setRevenue] = useState<RevenueType[]>([]);
	const [royalties, setRoyalties] = useState<RevenueType[]>([]);
	const [platformFees, setPlatformFees] = useState<PlatformFeeType[]>([]);
	const [sellingPrice, setSellingPrice] = useState<number>(
		voucher?.price ?? 0,
	);
	const [quantity, setQuantity] = useState<number>(voucher?.quantity ?? 0);

	useEffect(() => {
		if (project) {
		}
	}, [isActionDisabled, project, wallet?.walletAddress]);

	useEffect(() => {
		getPlatformFee();
	}, []);

	const getPlatformFee = async () => {
		const data = await getPlatformFeeForPublish();
		setPlatformFees(data);
	};

	// Calculate fees and earnings
	const calculateFees = () => {
		let totalFees = 0;
		const feeBreakdown = platformFees
			.filter((fee) => fee.fixedAmount > 0 || fee.percentage > 0)
			.map((fee) => {
				let feeAmount = 0;

				// Add fixed amount if it's greater than 0
				if (fee.fixedAmount > 0) {
					feeAmount += fee.fixedAmount;
				}

				// Add percentage amount if it's greater than 0
				if (fee.percentage > 0) {
					feeAmount += (sellingPrice * fee.percentage) / 100;
				}

				totalFees += feeAmount;
				return {
					...fee,
					calculatedAmount: feeAmount,
				};
			});

		const perUnitEarnings = sellingPrice - totalFees;
		const grandTotal = perUnitEarnings * quantity;

		return {
			feeBreakdown,
			totalFees,
			perUnitEarnings,
			grandTotal,
		};
	};

	const { feeBreakdown, totalFees, perUnitEarnings, grandTotal } =
		calculateFees();

	const columns = [
		{
			key: 'name',
			label: 'Creator',
		},
		{
			key: 'role',
			label: 'Role',
		},
		// { TO DO: unhide this when monetise is ready
		{
			key: 'status',
			label: 'Share %',
		},
		{
			key: 'status',
			label: 'Status',
		},
	];

	return (
		<div className='h-full w-full flex flex-col gap-10'>
			<div>
				<p className='text-[#1A1A1A] text-[20px] font-semibold'>
					Revenue Split
				</p>
				<div className='mt-3'>
					<Table
						aria-label='Revenue Split'
						removeWrapper
						classNames={{
							th: 'bg-transparent text-[#1A1A1A] font-semibold px-0',
							tr: 'border-b border-b-[#1A1A1A]',
							td: 'text-[#1A1A1A] tetx-[13px] font-semibold capitalize py-3 px-0',
						}}
					>
						<TableHeader>
							{columns.map((column, index) => (
								<TableColumn key={index}>
									{column.label}
								</TableColumn>
							))}
						</TableHeader>
						<TableBody>
							{project.collaborators
								?.filter(
									(collab) =>
										collab.status?.toLowerCase() ===
											'accepted' &&
										(!isActionDisabled ||
											collab.userWalletAddress ===
												wallet?.walletAddress),
								)
								.map((data, index) => (
									<TableRow key={index}>
										<TableCell>
											{data.userProfile?.userName}
										</TableCell>
										<TableCell>
											{data.role ?? '-'}
										</TableCell>
										<TableCell>
											{data.primaryShare}
										</TableCell>
										<TableCell>
											{data?.userWalletAddress ===
											project.walletAddress
												? '-'
												: data.primaryStatus?.toLowerCase() ===
													  'offered'
													? 'Pending'
													: data.primaryStatus}
										</TableCell>
									</TableRow>
								)) || []}
						</TableBody>
					</Table>
					{/* TO DO: unhide this when monetise is ready
				<div className='py-3 border-b border-b-[#1A1A1A] '>
					<p className='text-[#1A1A1A] text-[18px] font-semibold'>Affiliate bounty: 10%</p>
				</div> */}
				</div>
			</div>
			<div>
				<p className='text-[#1A1A1A] text-[20px] font-semibold'>
					Creator Royalties
				</p>
				{/* TO DO: unhide this when monetise is ready 
				<div className='py-3  border-y-[#1A1A1A] border-y mt-5'>
					<p className='text-[#1A1A1A] text-[18px] font-semibold'>Creator earnings: 5%</p>
				</div> */}
				<div className='mt-3'>
					<Table
						aria-label='Revenue Split'
						removeWrapper
						classNames={{
							th: 'bg-transparent text-[#1A1A1A] font-semibold px-0',
							tr: 'border-b border-b-[#1A1A1A]',
							td: 'text-[#1A1A1A] tetx-[13px] font-semibold capitalize py-3 px-0',
						}}
					>
						<TableHeader>
							{columns.map((column, index) => (
								<TableColumn key={index}>
									{column.label}
								</TableColumn>
							))}
						</TableHeader>
						<TableBody>
							{project.collaborators
								?.filter(
									(collab) =>
										collab.status?.toLowerCase() ===
											'accepted' &&
										(!isActionDisabled ||
											collab.userWalletAddress ===
												wallet?.walletAddress),
								)
								.map((data, index) => (
									<TableRow key={index}>
										<TableCell>
											{data.userProfile?.userName}
										</TableCell>
										<TableCell>
											{data.role ?? '-'}
										</TableCell>
										<TableCell>
											{data.secondaryShare}
										</TableCell>
										<TableCell>
											{data?.userWalletAddress ===
											project.walletAddress
												? '-'
												: data.secondaryStatus?.toLowerCase() ===
													  'offered'
													? 'Pending'
													: data.secondaryStatus}
										</TableCell>
									</TableRow>
								)) || []}
						</TableBody>
					</Table>
				</div>
			</div>
			<div>
				<p className='text-[#1A1A1A] text-[20px] font-semibold'>
					Sales Summary
				</p>
				<div className='mt-2'>
					<PlatformFeeCalculator
						mode='display'
						sellingPrice={sellingPrice}
						quantity={quantity}
						chainId={voucher?.chainId ?? ''}
					/>
				</div>
			</div>
		</div>
	);
}
