export const S3Path = `https://${process.env.BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
export const Categories = new Map<string, string>([
	['project', 'Project'],
	['product', 'Product'],
]);
