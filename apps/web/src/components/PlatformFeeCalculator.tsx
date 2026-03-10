'use client';

import {
	CurrencyResponse,
	getCurrency,
	getPlatformFeeForPublish,
} from '@/apihandler/Project';
import { Blockchain, BlockchainResponse, PlatformFeeType } from '@/types';
import { Checkbox, Input, Select, SelectItem } from '@nextui-org/react';
import { useEffect, useState } from 'react';
import { numberFormat } from '@/lib/Util';
import { getBlockchains } from '@/apihandler/Wallet';
import Image from 'next/image';

interface PlatformFeeCalculatorProps {
	mode: 'input' | 'display';
	sellingPrice?: number;
	quantity?: number | null;
	chainId?: string;
	onSellingPriceChange?: (price: number) => void;
	onQuantityChange?: (quantity: number | null) => void;
	onCurrencyChange?: (currency: string) => void;
	onChainIdChange?: (chainId: string) => void;
	className?: string;
	type?: 'ERC721C' | 'ERC721AC' | 'ERC1155C' | 'ERC20';
	darkMode?: boolean;
	published?: boolean;
}

interface FeeCalculation {
	feeBreakdown: Array<PlatformFeeType & { calculatedAmount: number }>;
	totalFees: number;
	perUnitEarnings: number;
	grandTotal: number;
}

export default function PlatformFeeCalculator({
	mode,
	sellingPrice: propSellingPrice = 0.1,
	quantity: propQuantity = 1,
	chainId,
	onSellingPriceChange,
	onQuantityChange,
	onCurrencyChange,
	onChainIdChange,
	className = '',
	type,
	darkMode = false,
	published = false,
}: PlatformFeeCalculatorProps) {
	const [sellingPrice, setSellingPrice] = useState<number>(
		Math.max(0.1, propSellingPrice),
	);
	const [sellingPriceInput, setSellingPriceInput] = useState<string>(
		Math.max(0.1, propSellingPrice).toString(),
	);
	// 0 = unlimited quantity
	const [quantity, setQuantity] = useState<number>(() => {
		const q = propQuantity ?? (type === 'ERC1155C' ? 0 : 1);
		return propQuantity === null ? 0 : q;
	});
	const [quantityInput, setQuantityInput] = useState<string>(() => {
		const q = propQuantity ?? (type === 'ERC1155C' ? 0 : 1);
		// 0 = unlimited: show 'Unlimited' when prop is null/0 or default q is 0 (ERC1155C)
		return propQuantity === null || propQuantity === 0 || q === 0
			? 'Unlimited'
			: String(q);
	});
	const [isQuantityDisabled, setIsQuantityDisabled] =
		useState<boolean>(false);

	const [platformFees, setPlatformFees] = useState<PlatformFeeType[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [currencies, setCurrencies] = useState<CurrencyResponse[]>([]);
	const [selectedCurrency, setSelectedCurrency] = useState<string>('');
	const [quantityError, setQuantityError] = useState<boolean>(false);
	const [priceError, setPriceError] = useState<boolean>(false);
	const [blockchains, setBlockchains] = useState<Blockchain[]>([]);
	const [selectedBlockchain, setSelectedBlockchain] = useState<Blockchain>();

	const enforceQuantityConstraints = (value: number): number => {
		if (type === 'ERC721AC') {
			return Math.max(2, value || 2);
		}

		if (!type) {
			return Math.max(0, value);
		}

		return 1;
	};

	// Fetch platform fees on component mount
	useEffect(() => {
		const getPlatformFee = async () => {
			try {
				setIsLoading(true);
				const data = await getPlatformFeeForPublish();
				setPlatformFees(data);
			} catch (error) {
				console.error('Error fetching platform fees:', error);
				setPlatformFees([]);
			} finally {
				setIsLoading(false);
			}
		};

		getPlatformFee();
	}, []);

	// Update local state when props change
	useEffect(() => {
		const enforcedPrice = Math.max(0.1, propSellingPrice);
		setSellingPrice(enforcedPrice);
		setSellingPriceInput(enforcedPrice.toString());
		setPriceError(false);
		onSellingPriceChange?.(enforcedPrice);
	}, [propSellingPrice]);

	// Sync local state from parent only; do not call onQuantityChange here
	// (parent already has this value; calling it would trigger duplicate updates)
	// 0 = unlimited
	useEffect(() => {
		if (propQuantity == null || propQuantity === 0) {
			setQuantity(0);
			setQuantityInput('Unlimited');
		} else {
			const enforcedQuantity = enforceQuantityConstraints(propQuantity);
			setQuantity(enforcedQuantity);
			setQuantityInput(enforcedQuantity.toString());
		}
	}, [propQuantity]);

	useEffect(() => {
		setQuantity((current) => {
			if (current === 0) return current; // keep unlimited
			const adjustedQuantity = enforceQuantityConstraints(current);
			setQuantityInput(adjustedQuantity.toString());
			if (adjustedQuantity !== current) {
				onQuantityChange?.(adjustedQuantity);
			}
			return adjustedQuantity;
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [type]);

	// Calculate fees and earnings
	const calculateFees = (): FeeCalculation => {
		let totalFees = 0;
		const feeBreakdown = platformFees.map((fee) => {
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

		const perUnitEarnings = Math.max(0, sellingPrice - totalFees);
		const effectiveQuantity = quantity === 0 ? 1 : quantity; // 0 = unlimited
		const grandTotal = Math.max(0, perUnitEarnings * effectiveQuantity);

		return {
			feeBreakdown,
			totalFees,
			perUnitEarnings,
			grandTotal,
		};
	};

	const { feeBreakdown, totalFees, perUnitEarnings, grandTotal } =
		calculateFees();

	const handleSellingPriceChange = (value: string) => {
		// Allow empty string for intermediate typing states
		if (value === '') {
			setSellingPriceInput('');
			setPriceError(false);
			return;
		}

		const parsedValue = parseFloat(value);

		// Update raw input value (don't enforce constraints while typing)
		setSellingPriceInput(value);

		// Check for error state (but don't enforce constraints yet)
		if (Number.isNaN(parsedValue) || parsedValue < 0.1) {
			setPriceError(true);
		} else {
			setPriceError(false);
		}

		// Don't update actual price or call callback while typing - wait for blur
	};

	const handleSellingPriceBlur = () => {
		// Enforce minimum price of 0.10 when user finishes typing
		const parsedValue = parseFloat(sellingPriceInput);
		if (Number.isNaN(parsedValue) || sellingPriceInput === '') {
			// If empty or invalid, use the current price or minimum
			const enforcedPrice = Math.max(0.1, sellingPrice);
			setSellingPriceInput(enforcedPrice.toString());
			setSellingPrice(enforcedPrice);
			setPriceError(false);
			onSellingPriceChange?.(enforcedPrice);
		} else {
			const adjustedValue = Math.max(0.1, parsedValue);
			setSellingPriceInput(adjustedValue.toString());
			setSellingPrice(adjustedValue);
			setPriceError(false); // Error cleared after enforcing minimum
			onSellingPriceChange?.(adjustedValue);
		}
	};

	const handleQuantityChange = (value: string) => {
		// Allow empty string for intermediate typing states
		if (value === '') {
			setQuantityInput('');
			setQuantityError(false);
			return;
		}

		const parsedValue = parseInt(value, 10);

		// Update raw input value (don't enforce constraints while typing)
		setQuantityInput(value);

		// Check for error state (but don't enforce constraints yet)
		if (type === 'ERC721AC') {
			if (Number.isNaN(parsedValue) || parsedValue < 2) {
				setQuantityError(true);
			} else {
				setQuantityError(false);
			}
		} else {
			setQuantityError(false);
		}

		// Update quantity for calculations, but use the parsed value (not enforced)
		// This allows intermediate values like "1" to exist while typing "10"
		if (!Number.isNaN(parsedValue)) {
			// Use parsed value directly for calculations, but don't enforce constraints yet
			// Only enforce minimum of 0 to prevent negative calculations
			const valueForCalc = Math.max(0, parsedValue);
			setQuantity(valueForCalc);
			// Don't call onQuantityChange while typing - wait for blur
		}
	};

	const handleQuantityBlur = () => {
		// Skip when unlimited (0 = unlimited)
		if (quantity === 0) return;
		// Enforce constraints when user finishes typing
		const parsedValue = parseInt(quantityInput, 10);
		if (Number.isNaN(parsedValue) || quantityInput === '') {
			// If empty or invalid, use the current quantity
			const enforcedQuantity = enforceQuantityConstraints(quantity);
			setQuantityInput(enforcedQuantity.toString());
			setQuantity(enforcedQuantity);
			setQuantityError(false);
			onQuantityChange?.(enforcedQuantity);
		} else {
			const adjustedValue = enforceQuantityConstraints(parsedValue);
			setQuantityInput(adjustedValue.toString());
			setQuantity(adjustedValue);
			setQuantityError(false);
			onQuantityChange?.(adjustedValue);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
			e.preventDefault();
		}
	};

	const isQuantityEditable =
		mode === 'input' &&
		(type === 'ERC1155C' || type === 'ERC721AC') &&
		quantity !== 0; // 0 = unlimited, show text instead of input

	const handleIntegerKeyDown = (e: React.KeyboardEvent) => {
		if (
			e.key === 'e' ||
			e.key === 'E' ||
			e.key === '+' ||
			e.key === '-' ||
			e.key === '.' ||
			e.key === ','
		) {
			e.preventDefault();
		}
	};

	const handleUnlimitedQuantityChange = (checked: boolean) => {
		if (checked) {
			setQuantity(0); // 0 = unlimited
			setQuantityInput('Unlimited');
			setIsQuantityDisabled(true);
			setQuantityError(false);
			onQuantityChange?.(0);
		} else {
			const defaultQuantity = type === 'ERC721AC' ? 2 : 1;
			setQuantity(defaultQuantity);
			setQuantityInput(String(defaultQuantity));
			setIsQuantityDisabled(false);
			onQuantityChange?.(defaultQuantity);
		}
	};

	useEffect(() => {
		const getCurrencyAPI = async () => {
			try {
				const data = await getCurrency();
				if (data.data) {
					setCurrencies(data.data);
					// Set the first active currency as default
					const firstActiveCurrency = data.data.find(
						(c: CurrencyResponse) => c.isActive,
					);
					if (firstActiveCurrency && !selectedCurrency) {
						setSelectedCurrency(firstActiveCurrency.symbol);
						onCurrencyChange?.(firstActiveCurrency.symbol);
					}
				}
			} catch (error) {
				console.error('Error fetching currencies:', error);
			} finally {
				setIsLoading(false);
			}
		};

		getCurrencyAPI();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		const getBlockchainsAPI = async () => {
			try {
				const data = await getBlockchains();
				if (data.success && data.data) {
					setBlockchains(data.data);
					if (data.data.length > 0) {
						if (chainId) {
							const blockchain = data.data.find(
								(b) => b.chainId === chainId,
							);
							if (blockchain) {
								setSelectedBlockchain(blockchain);
								onChainIdChange?.(blockchain.chainId);
							}
						} else {
							// Try to find blockchain with chainId 0x79a, otherwise use first
							const targetBlockchain =
								data.data.find((b) => b.chainId === '0x79a') ||
								data.data[0];
							setSelectedBlockchain(targetBlockchain);
							onChainIdChange?.(targetBlockchain.chainId);
						}
					}
				}
				// setBlockchains(data);
			} catch (error) {
				console.error('Error fetching blockchains:', error);
			}
		};
		getBlockchainsAPI();
	}, []);

	// Show loading state while fetching platform fees
	if (isLoading) {
		return (
			<div className={`my-5 ${className}`}>
				<div className='flex justify-center items-center py-8'>
					<p className='text-[#9E9E9D]'>Loading fee calculation...</p>
				</div>
			</div>
		);
	}
	return (
		<div className={` ${className}`}>
			{/* Select Blockchain */}
			<div className=' w-full flex flex-row justify-between items-center py-2 font-semibold text-[#1A1A1A] text-[16px]'>
				<p>
					{' '}
					{mode === 'input' ? 'Select Network' : 'Network'}{' '}
					{mode === 'input' && (
						<span className='text-[13px] font-normal text-[#9E9E9D]'>
							( Leave this as default if you are not sure )
						</span>
					)}
				</p>
				<div>
					{mode === 'input' ? (
						<Select
							selectedKeys={
								selectedBlockchain?.chainId
									? [selectedBlockchain.chainId]
									: []
							}
							onSelectionChange={(keys) => {
								const selectedChainId = Array.from(
									keys,
								)[0] as string;
								const blockchain = blockchains.find(
									(b) => b.chainId === selectedChainId,
								);
								if (blockchain) {
									setSelectedBlockchain(blockchain);
									onChainIdChange?.(blockchain.chainId);
								}
							}}
							isDisabled={published}
							selectionMode='single'
							disallowEmptySelection
							className='bg-[#F1F0EB] '
							classNames={{
								base: 'bg-white text-[#1a1a1a] ',
								value: 'placeholder:text-[#1a1a1a] rtl:text-right group-data-[has-value=true]:text-[#1a1a1a] text-[#1a1a1a] text-[16px] font-semibold italic',
								trigger:
									'w-[210px] rounded h-12 px-2 bg-white data-[hover=true]:bg-white border border-[#D9D9D9] data-[open=true]:border-[#D9D9D9] data-[focus=true]:border-[#D9D9D9]  data-[hover=true]:border-[#D9D9D9] group-data-[focus=true]:border-[#D9D9D9]',
								popoverContent:
									'bg-white border border-[#D9D9D9] rounded-none  ',
								selectorIcon:
									'text-[#1a1a1a] h-[20px] w-[20px]',
								listbox: 'text-[#1a1a1a]',
								listboxWrapper:
									'data-[selectable=true]:focus:bg-[#11FF49]',
							}}
							aria-label='Currency'
							renderValue={(value) => {
								return (
									selectedBlockchain && (
										<div className='flex items-center gap-2'>
											<Image
												src={selectedBlockchain.logoUrl}
												alt={selectedBlockchain.name}
												width={20}
												height={20}
												className='rounded-full'
											/>
											{selectedBlockchain.name}
										</div>
									)
								);
							}}
						>
							{blockchains.map((blockchain) => (
								<SelectItem
									key={blockchain.chainId}
									value={blockchain.chainId}
								>
									<div className='flex items-center gap-2'>
										{blockchain.logoUrl && (
											<Image
												src={blockchain.logoUrl}
												alt={blockchain.name}
												width={20}
												height={20}
												className='rounded-full'
											/>
										)}
										{blockchain.name}
									</div>
								</SelectItem>
							))}
						</Select>
					) : (
						selectedBlockchain && (
							<div className='flex items-center gap-2'>
								<Image
									src={selectedBlockchain.logoUrl}
									alt={selectedBlockchain.name}
									width={20}
									height={20}
									className='rounded-full'
								/>
								<p>{selectedBlockchain.name}</p>
							</div>
						)
					)}
				</div>
			</div>
			{/* Selling Price */}
			<div
				className={`flex justify-between items-center pb-2  font-semibold ${
					darkMode ? 'text-[#A79755]' : 'text-[#1A1A1A]'
				} text-[16px]`}
			>
				<p>
					Selling price per unit{' '}
					<span
						className={`text-[13px] font-normal ${
							priceError ? 'text-red-500' : 'text-[#F1F0EB]'
						}`}
					>
						{priceError && mode === 'input'
							? '(Minimum price is 0.10)'
							: ''}
					</span>
				</p>

				{mode === 'input' ? (
					<div className='flex flex-row gap-1 justify-end items-center w-[25%]'>
						<Input
							type='number'
							value={sellingPriceInput}
							onValueChange={handleSellingPriceChange}
							onBlur={handleSellingPriceBlur}
							onKeyDown={handleKeyDown}
							className={`flex-2 min-w-[100px] px-2 py-[3px] bg-white border rounded text-right focus:outline-none ${
								priceError
									? 'border-red-500 focus:border-red-500'
									: darkMode
										? 'border-[#323131] focus:border-[#F1F0EB] bg-[#323131] mr-1'
										: 'border-[#D9D9D9] focus:border-[#1A1A1A] '
							}`}
							min='0.1'
							step='0.01'
							pattern='[0-9]*\.?[0-9]*'
							classNames={{
								inputWrapper:
									'bg-transparent p-0 rounded-none shadow-none group-data-[focus=true]:bg-transparent group-data-[hover=true]:bg-transparent',
								input: darkMode
									? 'group-data-[has-value=true]:text-[#A79755]'
									: 'group-data-[has-value=true]:text-[#1A1A1A]',
							}}
						/>
						<Select
							selectedKeys={
								selectedCurrency ? [selectedCurrency] : []
							}
							onChange={(e) => {
								setSelectedCurrency(e.target.value);
								onCurrencyChange?.(e.target.value);
							}}
							selectionMode='single'
							disallowEmptySelection
							className='bg-transparent flex-1'
							classNames={{
								base: ` ${
									darkMode
										? 'bg-[#323131] text-[#A79755]'
										: 'bg-white text-[#1a1a1a] '
								}rounded-md`,
								value: `${
									darkMode
										? 'text-[#A79755] group-data-[has-value=true]:text-[#A79755]'
										: 'text-[#1a1a1a] group-data-[has-value=true]:text-[#1a1a1a]'
								} placeholder:text-[#1a1a1a] rtl:text-right   text-[16px] font-semibold italic`,
								trigger: `w-[100px]  border  rounded h-12 px-2 ${
									darkMode
										? 'bg-[#323131] group-data-[focus=true]:border-[#323131] data-[focus=true]:border-[#323131]  data-[hover=true]:border-[#323131] border-[#323131] data-[open=true]:border-[#323131] data-[hover=true]:bg-[#323131] data-[hover=true]:bg-[#323131]'
										: 'bg-white group-data-[focus=true]:border-[#D9D9D9] data-[focus=true]:border-[#D9D9D9]  data-[hover=true]:border-[#D9D9D9] border-[#D9D9D9] data-[open=true]:border-[#D9D9D9] data-[hover=true]:bg-white'
								}  `,
								popoverContent: `${
									darkMode
										? 'bg-[#323131]  border-[#323131]'
										: 'bg-white border-[#D9D9D9]'
								} border rounded-none`,
								selectorIcon: `${
									darkMode
										? 'text-[#A79755]'
										: 'text-[#1a1a1a]'
								} h-[20px] w-[20px]`,
								listbox: `${
									darkMode
										? 'text-[#A79755]'
										: 'text-[#1a1a1a]'
								}`,
								listboxWrapper: `${
									darkMode
										? 'data-[selectable=true]:focus:bg-[#A79755]'
										: 'data-[selectable=true]:focus:bg-[#11FF49]'
								}`,
							}}
							aria-label='Currency'
						>
							{currencies
								.filter((c) => c.isActive)
								.map((currency) => (
									<SelectItem
										key={currency.symbol}
										value={currency.symbol}
									>
										{currency.symbol}
									</SelectItem>
								))}
						</Select>
					</div>
				) : (
					<p>
						{numberFormat(sellingPrice, 2)} {selectedCurrency}
					</p>
				)}
			</div>

			{/* Fee Breakdown */}
			{feeBreakdown.map((fee: any, index) => (
				<div
					key={index}
					className={`flex justify-between items-center py-1 text-[11px] text-[#9E9E9D]`}
				>
					<p>
						<span className='italic mr-1'>less</span>
						{fee.fixedAmount > 0 && fee.percentage === 0
							? `${fee.fixedAmount} ${fee.currency}`
							: fee.fixedAmount === 0 && fee.percentage > 0
								? `${fee.percentage}%`
								: `0 ${fee.currency}`}{' '}
						{fee.chargeType.name}
					</p>
					<p>
						{numberFormat(fee.calculatedAmount, 2)}{' '}
						{selectedCurrency}
					</p>
				</div>
			))}

			{/* Per Unit Earnings */}
			<div
				className={`flex ${
					darkMode ? 'text-[#F1F0EB]' : 'text-[#1A1A1A]'
				} justify-between items-center py-2 border-t border-[#9E9E9D] font-semibold`}
			>
				<p>You will receive (per unit)</p>
				<p className='text-right w-24'>
					{numberFormat(perUnitEarnings, 2)} {selectedCurrency}
				</p>
			</div>

			{/* Quantity */}
			<div
				className={`flex justify-between items-center py-2 ${
					darkMode ? 'text-[#A79755]' : 'text-[#1A1A1A]'
				} font-semibold`}
			>
				<p>
					× Quantity{' '}
					<span
						className={`text-[13px] font-normal ${
							quantityError
								? 'text-red-500'
								: darkMode
									? 'text-[#F1F0EB]'
									: 'text-[#9E9E9D]'
						}`}
					>
						{type === 'ERC1155C'
							? '(Put 0 for unlimited supply)'
							: type === 'ERC721AC'
								? '(Quantity must be more than 1)'
								: ''}
					</span>
				</p>

				{isQuantityEditable ? (
					<Input
						type='number'
						isDisabled={isQuantityDisabled}
						value={quantityInput}
						onValueChange={handleQuantityChange}
						onBlur={handleQuantityBlur}
						onKeyDown={handleIntegerKeyDown}
						className='w-24 px-2 py-1 bg-white border border-[#D9D9D9] rounded text-right focus:outline-none focus:border-[#1A1A1A]'
						min={type === 'ERC1155C' ? '0' : '2'}
						step='1'
						pattern='[0-9]+'
						classNames={{
							inputWrapper:
								'bg-transparent rounded-none shadow-none group-data-[focus=true]:bg-transparent group-data-[hover=true]:bg-transparent',
						}}
					/>
				) : (
					<div className='w-24 px-2 py-1 bg-transparent rounded text-right'>
						<p>{quantity === 0 ? 'Unlimited' : quantity}</p>
					</div>
				)}
			</div>

			{mode === 'input' && type === 'ERC721AC' && (
				<div className='py-1'>
					<Checkbox
						isSelected={quantity === 0}
						onValueChange={handleUnlimitedQuantityChange}
						onChange={(e) =>
							handleUnlimitedQuantityChange(
								(e.target as HTMLInputElement).checked,
							)
						}
						color='success'
						classNames={{
							base: 'max-w-full',
							label: `text-[13px] font-semibold ${
								darkMode ? 'text-[#F1F0EB]' : 'text-[#1A1A1A]'
							}`,
						}}
					>
						Check this box for unlimited quantity
					</Checkbox>
				</div>
			)}

			{/* Grand Total */}
			<div
				className={`flex justify-between items-center  border-y border-[#9E9E9D] ${
					darkMode ? 'text-[#F1F0EB] py-5' : 'text-[#1A1A1A] py-2'
				} font-bold`}
			>
				<p>You will receive (grand total)</p>
				{quantity === 0 ? (
					<span
						className={`text-[13px] font-normal italic ${
							quantityError
								? 'text-red-500'
								: darkMode
									? 'text-[#F1F0EB]'
									: 'text-[#9E9E9D]'
						}`}
					>
						To infinity and beyond!
					</span>
				) : (
					<p>
						{numberFormat(grandTotal, 2)} {selectedCurrency}
					</p>
				)}
			</div>
		</div>
	);
}
