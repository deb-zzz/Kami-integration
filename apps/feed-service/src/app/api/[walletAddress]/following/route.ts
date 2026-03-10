import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

type Success = {
	success: true;
	following: any[];
};

type Fail = {
	success: false;
	error?: string;
};

type Props = { params: { walletAddress: string } };

export async function GET(_: NextRequest, { params }: Props): Promise<NextResponse<Success | Fail>> {
	headers();
	try {
		const response = await fetch(`${process.env.FOLLOWING_URL as string}/${params.walletAddress}/profile/following`);
		
		// Check if the response is successful
		if (!response.ok) {
			return NextResponse.json({ success: false, error: `Failed to fetch following: ${response.statusText}` }, { status: response.status });
		}

		// Check if response has content
		const text = await response.text();
		if (!text || text.trim().length === 0) {
			return NextResponse.json({ success: false, error: 'Empty response from following service' }, { status: 500 });
		}

		// Parse JSON with error handling
		let data;
		try {
			data = JSON.parse(text);
		} catch (parseError) {
			console.error('Failed to parse JSON response:', parseError);
			return NextResponse.json({ success: false, error: 'Invalid JSON response from following service' }, { status: 500 });
		}

		const { following } = data;
		return NextResponse.json({ success: true, following });
	} catch (error) {
		console.error('Error fetching following:', error);
		return NextResponse.json({ success: false, error: 'Failed to fetch following' });
	}
}
