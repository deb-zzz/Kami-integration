// import S3 from 'aws-sdk/clients/s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, S3 } from '@aws-sdk/client-s3';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

const s3 = new S3({
	region: process.env.AWS_REGION,

	credentials: {
		accessKeyId: process.env.ACCESS_KEY as string,
		secretAccessKey: process.env.SECRET_KEY as string,
	},

	// The key signatureVersion is no longer supported in v3, and can be removed.
	// @deprecated SDK v3 only supports signature v4.
	// signatureVersion: 'v4',
});

export async function POST(req: NextRequest) {
	const S3Path = `https://${process.env.BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
	const Categories = new Map<string, string>([
		['project', 'Project'],
		['product', 'Product'],
		['profile', 'Profile'],
	]);
	try {
		const category = Categories.get((req.nextUrl.searchParams.get('c') ?? 'Project').toLowerCase()) ?? 'Project';
		const pId = req.nextUrl.searchParams.get('id') ?? undefined;
		if (!pId) throw new Error('id is missing from url parameters');

		let { name, type, folder }: { name: string; type: string; folder?: string } = await req.json();
		if (!name || !type) throw new Error('name and type must be specified in post data');

		let dir: string;
		if (folder) dir = path.join(category, pId, folder).trim().replace(/\\/g, '/');
		else dir = path.join(category, pId).trim().replace(/\\/g, '/');

		const fileParams = {
			Bucket: process.env.BUCKET_NAME as string,
			Key: `${dir}/${name}`,
			// Expires: 600,
			ContentType: type,
			// ACL: 'public-read',
		};

		const url = await getSignedUrl(s3, new PutObjectCommand(fileParams), {
			expiresIn: 600,
		});
		return NextResponse.json({ url, path: `${S3Path}${dir}/${name}` });
	} catch (err) {
		console.error(err);
		return NextResponse.json({ error: (err as Error).message });
	}
}
