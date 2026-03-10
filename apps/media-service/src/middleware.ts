import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
	// retrieve the request headers
	const requestHeaders = new Headers(request.headers);
	const origin = requestHeaders.get('origin');
	const res = NextResponse.next();

	// add the CORS headers to the response
	res.headers.append('Access-Control-Allow-Credentials', 'true');
	if (origin) {
		if (
			origin.toLowerCase().includes('localhost:300') ||
			origin.toLowerCase().includes('ocu-napse.com') ||
			origin.toLowerCase().includes('app.kamiunlimited.com')
		) {
			res.headers.append('Access-Control-Allow-Origin', origin);
		}
	} else {
		res.headers.append('Access-Control-Allow-Origin', '*');
	}

	res.headers.append('Access-Control-Allow-Headers', 'Content-Type, Authorization, Signature');
	res.headers.append('Access-Control-Allow-Methods', 'GET,DELETE,POST,PUT,OPTIONS');

	console.log('CORS headers added to response');
	return res;
}

// specify the path regex to apply the middleware to
export const config = {
	matcher: '/api/:s3*',
};
