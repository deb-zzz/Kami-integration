'use client';

import { Profile } from '@/types';
import {
	createContext,
	ReactNode,
	SetStateAction,
	useContext,
	useState,
} from 'react';

export type GlobalState = {
	walletAddress?: string;
	chainId?: string;
	blockchains?: Array<{
		chainId: string;
		name: string;
		logoUrl: string;
		rpcUrl: string;
		createdAt: number;
		paymentTokens: Array<{
			id: number;
			chainId: string;
			contractAddress: string;
			name: string;
			symbol: string;
			decimals: number;
			logoUrl: string;
			createdAt: number;
		}>;
	}>;
	profileId?: number;
	userId?: string;
	bannerUrl?: string;
	avatarUrl?: string;
	isFeedMuted?: boolean;
	profile?: Profile;
	categories?: { id: number; name: string; description: string }[];
	isLoggedIn?: boolean;
	email?: string;
	chainIcons?: {
		[chainId: string]: string;
	};
};

type GlobalContext =
	| {
			getGlobals: GlobalState | undefined;
			setGlobals: React.Dispatch<SetStateAction<GlobalState | undefined>>;
	  }
	| undefined
	| null;

type GlobalContextProviderProps = {
	children: ReactNode;
};

const GlobalContext = createContext<GlobalContext>(null);

export default function GlobalStateContextProvider({
	children,
}: GlobalContextProviderProps) {
	const [getGlobals, setGlobals] = useState<GlobalState | undefined>(
		undefined
	);
	return (
		<GlobalContext.Provider value={{ getGlobals, setGlobals }}>
			{children}
		</GlobalContext.Provider>
	);
}

type GlobalStateArray = [GlobalState | undefined, (state: GlobalState) => void];

export function useGlobalState(): GlobalStateArray {
	const context = useContext(GlobalContext);
	if (!context || context === null)
		throw new Error(
			'useGlobalState must be used inside a GlobalStateContextProvider'
		);

	const setGlobals = (state: GlobalState) =>
		context.setGlobals((prev) => ({ ...prev, ...state }));
	return [context.getGlobals, setGlobals];
}
