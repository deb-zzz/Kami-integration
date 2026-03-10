import { NextRequest, NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import { AuthRequest, AuthResponse } from './lib/types';
import { config } from '@/app/config';
import { isWhitelisted } from './lib/whitelist';
import { JWTPayload, SignJWT } from 'jose';
import { prisma } from '@/lib/db';
import { isRegistered } from './lib/registered';

const PROFILE_SERVICE_URL = config.profileServiceUrl;

type Category = {
	id: number;
	name: string;
	description: string;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		// Parse the incoming request body
		const body: AuthRequest = await request.json();

		// Validate the request body
		// if (!body.walletAddress) {
		// 	console.log('Wallet address is required');
		// 	return NextResponse.json({ success: false, error: 'Wallet address is required' }, { status: 400 });
		// }
		if (!(body.email || body.phoneNumber)) {
			console.log('Either an email address or phone number is required');
			return NextResponse.json({ success: false, error: 'Either an email address or phone number is required' }, { status: 400 });
		}

		// Validate email format
		if (body.email) {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(body.email)) {
				console.log(`Invalid email format: ${body.email}`);
				return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 });
			}
		}
		// Validate phone number format
		if (body.phoneNumber) {
			const phoneNumberRegex = /^\+?\d{10,15}$/;
			if (!phoneNumberRegex.test(body.phoneNumber)) {
				console.log('Invalid phone number format');
				return NextResponse.json({ success: false, error: 'Invalid phone number format' }, { status: 400 });
			}
		}

		// Validate ethereum address format
		const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
		if (body.walletAddress && !ethAddressRegex.test(body.walletAddress)) {
			console.log('Invalid Ethereum wallet address');
			return NextResponse.json({ success: false, error: 'Invalid Ethereum wallet address' }, { status: 400 });
		}

		if (!(await isWhitelisted(body))) {
			console.log('User is not whitelisted');
			if (!(await isRegistered(body))) {
				console.log('User is not registered');
				return NextResponse.json({ success: false, error: 'User is not whitelisted or registered' }, { status: 403 });
			}
		}

		try {
			// Forward the request to the profile service
			const response = await axios.post<AuthResponse>(PROFILE_SERVICE_URL, body);
			const profile = response.data;

			// Check if the profile service returned a profile
			if (!profile.profile) {
				console.log('Profile not found');
				return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
			}

			// Get the categories
			const categories = await getCategories();

			// Create the JWT payload
			const jwtPayload = {
				sessionKey: crypto.randomUUID(),
				walletAddress: body.walletAddress,
				email: body.email,
				phoneNumber: body.phoneNumber,
				userName: profile.profile?.userName,
				categories: categories,
			};

			// Create JWT
			const jwt = await createJWT(jwtPayload);

			// Return the JWT in the response
			console.log(`Logged in user: ${profile.profile?.userName} with wallet address: ${body.walletAddress}`);
			return NextResponse.json({ success: true, token: jwt, profile: profile.profile }, { status: 200 });
		} catch (error) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 404) {
				return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
			}

			return NextResponse.json(
				{ success: false, error: 'Profile service communication error' },
				{ status: axiosError.response?.status || 500 },
			);
		}
	} catch (error) {
		console.error('Auth service error:', error);
		return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
}

async function createJWT(payload: JWTPayload): Promise<string> {
	const secret = process.env.JWT_SECRET ?? undefined;
	if (!secret) throw new Error('JWT_SECRET is not defined');
	const jwt = await new SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('2h')
		.sign(new TextEncoder().encode(secret));
	return jwt;
}

async function getCategories(): Promise<Category[]> {
	try {
		const categories = await prisma.categories.findMany();
		return categories.map((category) => ({ id: category.id, name: category.name, description: category.description ?? '' }));
	} catch (error) {
		console.error('Error fetching categories:', error);
		return [];
	}
}
