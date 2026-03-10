import { getProfile } from '@/apihandler/Profile';
import { useGlobalState } from './GlobalContext';

export type KamiWallet = {
	walletAddress: string | undefined;
	email: string | undefined;
	getAccount: () => { address: string | undefined };
	logout: () => void;
};

type KamiWalletProps = {
	walletAddress?: string;
	email?: string;
};

/**
 * Custom hook for managing a user's wallet and email address.
 *
 * @param {KamiWalletProps} props - The properties for the KamiWallet.
 * @param {string} [props.walletAddress] - The wallet address of the user.
 * @param {string} [props.email] - The email address of the user.
 *
 * @returns {KamiWallet} The KamiWallet object.
 */
const useKamiWallet = (walletData?: KamiWalletProps): KamiWallet | undefined => {
	const [gs, setGs] = useGlobalState();

	const getAccount = (): { address: string | undefined } => {
		return { address: gs?.walletAddress ?? undefined };
	};

	const logout = () => {
		setGs({ ...gs, walletAddress: undefined, email: undefined });
	};

	const { walletAddress, email } = walletData ?? {};

	if (walletAddress) {
		setGs({ ...gs, walletAddress: walletAddress, email: email });
		getProfile(walletAddress).then((data) => {
			if (data.success && data.profile) {
				setGs({
					profile: data.profile,
				});
			}
		});
	}

	return {
		walletAddress: gs?.isLoggedIn ? gs?.walletAddress : undefined,
		email: gs?.isLoggedIn ? gs?.email : undefined,
		getAccount,
		logout,
	};
};

export default useKamiWallet;
