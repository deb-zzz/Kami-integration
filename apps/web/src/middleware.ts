import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
	// maintenance mode
	//-----------------------------------------
	// const { pathname } = request.nextUrl;
	// console.log('pathname', pathname);
	// if (pathname === '/maintenance') {
	// 	return NextResponse.next();
	// }
	// return NextResponse.redirect(new URL('/maintenance', request.url));
	//-----------------------------------------

	const { pathname } = request.nextUrl;
	console.log('pathname', pathname);
	if (pathname === '/profile') {
		return NextResponse.redirect(
			new URL(
				'/profile/0x6D16F7930888Ec42f5dc3841564139C13423Ce63',
				request.url
			)
		);
	} else {
		return NextResponse.next();
	}

	//normal mode
	//return NextResponse.next();
}

// maintenance mode
//-----------------------------------------
// export const config = {
// 	matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public|maintenance/*|images/*).*)'],
// };
//-----------------------------------------
