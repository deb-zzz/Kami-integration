import { uploadToIPFS } from '@/lib/ipfs2';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const fileUrl = body.url;
		
		if (!fileUrl || typeof fileUrl !== 'string') {
			return NextResponse.json(
				{ success: false, error: 'URL is required in request body' },
				{ status: 400 }
			);
		}
		
		const result = await uploadToIPFS(fileUrl);
		
		if (!result.success) {
			return NextResponse.json(result, { status: 500 });
		}
		
		return NextResponse.json(result);
	} catch (error) {
		console.error('IPFS upload error:', error);
		return NextResponse.json(
			{ 
				success: false, 
				error: error instanceof Error ? error.message : 'Upload failed' 
			},
			{ status: 500 }
		);
	}
}
