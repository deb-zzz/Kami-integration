import { NextRequest, NextResponse } from 'next/server';
// import { jwtVerify } from 'jose';
// import Redis from 'ioredis';
// import { cookies } from 'next/headers';

// // This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
	// 	const token = (await cookies()).get('token')?.value ?? request.headers.get('token') ?? undefined;
	// 	if (!token) return NextResponse.json({ message: 'A token is required for authentication' }, { status: 403 });

	// 	const isValid = await verifyToken(token);
	// 	if (!isValid) return NextResponse.json({ message: 'Invalid token' }, { status: 403 });
	return NextResponse.redirect(request.url);
	// }

	// /// Verify token, return true if valid, false if invalid
	// async function verifyToken(token: string) {
	// 	try {
	// 		const redis = new Redis();
	// 		const cachedSecret = await redis.get('jwt_secret');
	// 		if (!cachedSecret) return false;

	// 		const jwtConfig = JSON.parse(cachedSecret);
	// 		if (!jwtConfig) return false;

	// 		const secret = new TextEncoder().encode(jwtConfig.secret);
	// 		const { payload } = await jwtVerify(token, secret);
	// 		console.log(`Verified token for: ${payload}`);
	// 		return true;
	// 	} catch (err) {
	// 		console.error(`Error verifying token: ${(err as Error).message}`);
	// 		return false;
	// 	}
}

// Match all routes except /api/login
export const config = {
	matcher: '/((?!api/login).*)',
};
