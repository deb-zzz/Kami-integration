export interface DeployRequest {
  initialUri: string;
}

export interface SetTokenURIRequest {
  tokenId: number;
  newUri: string;
}

export interface MintRequest {
  tokenId: number;
  amount: number;
  recipient: string;
}

export interface TransferOwnershipRequest {
  newOwner: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

