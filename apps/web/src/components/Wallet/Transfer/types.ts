import { Blockchain, Wallet as WalletType } from "@/types";

export type WalletView = "dashboard" | "transfer" | "history" | "settings";
export type TransferStep = "amount" | "recipient" | "review";

export interface Recipient {
  userName: string;
  walletAddress: string;
  avatarUrl: string | null;
}

export type TransferStatus = "idle" | "processing" | "success" | "failed";

export interface TransferState {
  selectedChainId: string;
  selectedToken: WalletType | null;
  amount: string;
  isValid: boolean;
  transferStep: TransferStep;
  recipientAddress: string;
  isAddressValid: boolean;
  isValidatingAddress: boolean;
  addressValidationError: string | null;
  showOffPlatformWarning: boolean;
  offPlatformConfirmed: boolean;
  showCancelDialog: boolean;
  transferStatus: TransferStatus;
  transferError: string | null;
  transactionHash: string | null;
  skipRecipientsFetch?: boolean;
  cachedRecentRecipients?: Recipient[];
}

export interface TransferProps {
  setActiveView: (view: WalletView) => void;
  blockchains: Blockchain[];
  chainId: string;
  wallets: WalletType[];
  onChainChange: (chainId: string) => void;
  loading: boolean;
  onBack?: () => void;
  refetchWalletData?: () => Promise<void>;
}

export interface TransferStepProps {
  state: TransferState;
  setState: React.Dispatch<React.SetStateAction<TransferState>>;
  setActiveView: (view: WalletView) => void;
  blockchains: Blockchain[];
  onChainChange: (chainId: string) => void;
  wallets: WalletType[];
  loading: boolean;
  showZeroBalance: boolean;
  setShowZeroBalance: (value: boolean) => void;
  refetchWalletData?: () => Promise<void>;
}
