import { user } from '@prisma/client';

export interface AuthRequest {
	email?: string;
	phoneNumber?: string;
	walletAddress: string;
}

export interface AuthResponse {
	success: boolean;
	profile?: user;
	error?: string;
}
