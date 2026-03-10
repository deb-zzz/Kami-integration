import { NextRequest, NextResponse } from 'next/server';

// Middleware function template
export async function middleware(req: NextRequest) {
	console.log(`Request Method: ${req.method}, Request URL: ${req.url}`);

	// Only parse JSON for methods that typically have request bodies
	const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE'];
	if (methodsWithBody.includes(req.method)) {
		try {
			const data = await req.json();
			console.log(JSON.stringify(data, null, 2));
		} catch (error) {
			// Silently handle JSON parse errors (empty body, invalid JSON, etc.)
			console.log('No body or invalid JSON in request');
		}
	}

	// Return the response to continue the request
	return NextResponse.next();
}

// Specify the paths where this middleware should run
export const config = {
	matcher: '/api/:path*', // Adjust the path as needed
};
