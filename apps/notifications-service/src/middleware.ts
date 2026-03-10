import { NextResponse } from 'next/server';

/**
 * Middleware function to handle CORS (Cross-Origin Resource Sharing) headers.
 *
 * This middleware is applied to all API routes as specified in the `config.matcher`.
 * It appends necessary CORS headers to the response to allow cross-origin requests.
 *
 * @returns {NextResponse} - The modified response object with CORS headers.
 */
export function middleware(): NextResponse {
	// retrieve the current response
	const res = NextResponse.next();

	// add the CORS headers to the response
	res.headers.append('Access-Control-Allow-Credentials', 'true');
	res.headers.append('Access-Control-Allow-Origin', '*'); // replace this with your actual origin
	res.headers.append('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT');
	res.headers.append(
		'Access-Control-Allow-Headers',
		'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
	);

	return res;
}

/**
 * Configuration object for the middleware.
 *
 * Specifies the path pattern to which the middleware should be applied.
 *
 * @property {string} matcher - A regex pattern that matches API routes.
 */
export const config = {
	matcher: '/api/:path*',
};
