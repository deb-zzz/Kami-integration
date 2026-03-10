'use client';

import { VoucherContextType } from '@/types';
import {
	createContext,
	ReactNode,
	SetStateAction,
	useContext,
	useState,
} from 'react';

type VoucherContext =
	| {
			getVoucher: VoucherContextType | undefined;
			setVoucher: React.Dispatch<
				SetStateAction<VoucherContextType | undefined>
			>;
	  }
	| undefined
	| null;

type VoucherContextProviderProps = {
	children: ReactNode;
};

const VoucherContext = createContext<VoucherContext>(null);

export default function VoucherStateContextProvider({
	children,
}: VoucherContextProviderProps) {
	const [getVoucher, setVoucher] = useState<VoucherContextType | undefined>(
		undefined
	);
	return (
		<VoucherContext.Provider value={{ getVoucher, setVoucher }}>
			{children}
		</VoucherContext.Provider>
	);
}

type LazyNFTArray = [
	VoucherContextType | undefined,
	(state: VoucherContextType) => void,
	() => void
];

export function useLazyNFT(): LazyNFTArray {
	const context = useContext(VoucherContext);
	if (!context || context === null)
		throw new Error(
			'useLazyNFT must be used inside a LazyNFTContextProvider'
		);

	const setVoucher = (state: VoucherContextType) =>
		context.setVoucher((prev) => ({ ...prev, ...state }));
	const newItemVoucher = () =>
		context.setVoucher((prev) => ({
			...prev,
			animationUrl: undefined,
			coverUrl: undefined,
			metadata: {},
			mediaFile: undefined,
			coverFile: undefined,
			name: undefined,
			description: undefined,
			externalUrl: undefined,
			attributes: undefined,
			price: undefined,
			quantity: undefined,
			tokenId: undefined,
			tags: undefined,
			mediaUrl: undefined,
		}));
	return [context.getVoucher, setVoucher, newItemVoucher];
}
