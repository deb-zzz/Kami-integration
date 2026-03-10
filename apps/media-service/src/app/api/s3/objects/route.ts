import { S3 } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const s3 = new S3({
	region: process.env.AWS_REGION as string,

	credentials: {
		accessKeyId: process.env.ACCESS_KEY as string,
		secretAccessKey: process.env.SECRET_KEY as string,
	},
});

type ReturnedData = {
	Key: string;
	Url: string;
};

export async function GET(req: NextRequest) {
	// console.log('getS3ObjectS...');
	let list: any;
	let returnedData: ReturnedData[] = [];
	let folderParam = req.nextUrl.searchParams.get('folder');
	let folder;
	if (!Array.isArray(folderParam)) folder = folderParam;
	const bucket = process.env.BUCKET_NAME ?? '';
	if (folder) {
		if (folder.endsWith('/')) folder = folder.substring(0, folder.length - 1);
		if (folder.length === 0) list = await s3.listObjects({ Bucket: bucket });
		else list = await s3.listObjects({ Bucket: bucket, Prefix: `${folder}` });
	} else list = await s3.listObjects({ Bucket: bucket });
	if (list) {
		for (const content of list.Contents) {
			const filterStr = folder + '/';
			if (content.Key === filterStr) continue;
			let r: ReturnedData = { Key: '', Url: '' };
			r.Key = String(content.Key).substring(String(content.Key).lastIndexOf('/') + 1);
			r.Url = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${content.Key}`;
			returnedData.push(r);
		}
	}
	return NextResponse.json(returnedData);
}
