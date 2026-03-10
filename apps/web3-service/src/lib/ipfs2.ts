// app/actions/upload.ts
"use server";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Validate required environment variables
const accessKeyId = process.env.FILEBASE_ACCESS_KEY;
const secretAccessKey = process.env.FILEBASE_SECRET_KEY;
const bucketName = process.env.FILEBASE_BUCKET;

if (!accessKeyId || !secretAccessKey || !bucketName) {
  console.error("Missing required Filebase environment variables:");
  if (!accessKeyId) console.error("  - FILEBASE_ACCESS_KEY");
  if (!secretAccessKey) console.error("  - FILEBASE_SECRET_KEY");
  if (!bucketName) console.error("  - FILEBASE_BUCKET");
}

const s3Client = new S3Client({
  endpoint: "https://s3.filebase.com",
  region: "us-east-1",
  credentials: {
    accessKeyId: accessKeyId || "",
    secretAccessKey: secretAccessKey || "",
  },
});

export async function uploadToIPFS(fileUrlOrFile: string | File) {
  if (!fileUrlOrFile) throw new Error("No file URL or file provided");

  // Validate environment variables
  if (!process.env.FILEBASE_ACCESS_KEY) {
    throw new Error("FILEBASE_ACCESS_KEY environment variable is not set");
  }
  if (!process.env.FILEBASE_SECRET_KEY) {
    throw new Error("FILEBASE_SECRET_KEY environment variable is not set");
  }
  if (!process.env.FILEBASE_BUCKET) {
    throw new Error("FILEBASE_BUCKET environment variable is not set");
  }

  const bucketName = process.env.FILEBASE_BUCKET;

  let buffer: Buffer;
  let filename: string;
  let contentType: string;

  // Handle File object
  if (fileUrlOrFile instanceof File) {
    const file = fileUrlOrFile;
    // Get the file buffer
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    
    // Extract filename from File.name
    filename = file.name || "file";
    
    // Get content type from File.type or infer from filename
    contentType = file.type || "application/octet-stream";
    if (contentType === "application/octet-stream" || contentType === "") {
      // Try to infer from file extension
      const ext = filename.split(".").pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        svg: "image/svg+xml",
        json: "application/json",
        pdf: "application/pdf",
      };
      if (ext && mimeTypes[ext]) {
        contentType = mimeTypes[ext];
      }
    }
  } else {
    // Handle URL string (existing behavior)
    const fileUrl = fileUrlOrFile;
    
    // Fetch the file from the URL
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
    }

    // Get the file buffer
    const arrayBuffer = await response.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);

    // Extract filename from URL or use a default
    filename = "file";
    try {
      const urlObj = new URL(fileUrl);
      const pathname = urlObj.pathname;
      filename = pathname.split("/").pop() || "file";
      // Remove query parameters if any
      filename = filename.split("?")[0];
    } catch (error) {
      console.warn("Could not parse URL for filename, using default:", error);
    }

    // Get content type from response headers or infer from filename
    contentType = response.headers.get("content-type") || "application/octet-stream";
    if (contentType === "application/octet-stream") {
      // Try to infer from file extension
      const ext = filename.split(".").pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        svg: "image/svg+xml",
        json: "application/json",
        pdf: "application/pdf",
      };
      if (ext && mimeTypes[ext]) {
        contentType = mimeTypes[ext];
      }
    }
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: filename,
    Body: buffer,
    ContentType: contentType,
  } );
    
 // THIS IS THE SECRET SAUCE:
let extractedCid: string | undefined;
command.middlewareStack.add(
  (next) => async (args) => {
    const response = await next(args);
    // Filebase returns the CID in this specific header
    if (response && typeof response === 'object' && 'response' in response) {
      const responseObj = response as { response?: { headers?: Record<string, string> } };
      const httpResponse = responseObj.response;
      if (httpResponse?.headers) {
        const cid = httpResponse.headers[ "x-amz-meta-cid" ];
        if (cid) {
          extractedCid = cid;
          console.log("Found CID in headers:", cid);
        }
      }
    }
    return response;
  },
  { step: "build", name: "getCidFromHeader" }
);   

  try {
    const response = await s3Client.send(command);
    console.log('response', JSON.stringify(response, null, 2));
    // Filebase returns the CID in the metadata headers or from middleware
    const cid = extractedCid || response.$metadata?.["cfId"];
    if (!cid) {
      throw new Error("CID not found in response headers or metadata");
    }
      // const ipfsUrl = `https://ipfs.filebase.io/ipfs/${cid}`;
      const ipfsUrl = `ipfs://${cid}`;

    return { success: true, cid, url: ipfsUrl };
  } catch (error) {
    console.error("Upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}