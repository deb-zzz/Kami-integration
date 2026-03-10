import { NextResponse } from "next/server";
import { EmailService } from "@/services/email.service";

const authEmailService = new EmailService({
	host: process.env.SMTP_HOST || "mail.kamiunlimited.com",
	port: parseInt(process.env.SMTP_PORT || "465", 10),
	user: process.env.SMTP_USER_AUTH || "auth@kamiunlimited.com",
	pass: process.env.SMTP_PASS_AUTH || "",
});

const notifyEmailService = new EmailService({
	host: process.env.SMTP_HOST || "mail.kamiunlimited.com",
	port: parseInt(process.env.SMTP_PORT || "465", 10),
	user: process.env.SMTP_USER_NOTIFY || "notify@kamiunlimited.com",
	pass: process.env.SMTP_PASS_NOTIFY || "",
});

export async function POST(
	req: Request,
	{ params }: { params: Promise<{ path: string }> }
) {
	try {
		const path = (await params).path;
		const body = await req.json();

		switch (path.toLowerCase()) {
			case "otp": {
				const { email, otp, otpExpiryMinutes } = body;

				if (!email || !otp) {
					return NextResponse.json(
						{ error: "Email and OTP are required" },
						{ status: 400 }
					);
				}

				await authEmailService.sendOtpEmail(email, otp, otpExpiryMinutes);

				return NextResponse.json({ success: true });
			}
			case "report-bug": {
				const { username, email, issueTypes, description } = body;

				if (!email || !issueTypes || !description) {
					return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
				}

				await notifyEmailService.sendReportBugEmail(
					username,
					email,
					issueTypes,
					description
				);

				return NextResponse.json(
					{ success: true, message: "Bug report sent successfully" },
					{ status: 200 }
				);
			}
			case "report-post": {
				const { username, email, issueTypes, postId, description, remarks } = body;

				if (!email || !issueTypes || !postId) {
					return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
				}

				await notifyEmailService.sendReportPostEmail(
					username,
					email,
					issueTypes,
					postId,
					description,
					remarks
				);

				return NextResponse.json(
					{ success: true, message: "Post report sent successfully" },
					{ status: 200 }
				);
			}
			case "nft-flagging-warning": {
				const { product, reason, recipient } = body;

				await notifyEmailService.sendNftFlagWarningEmail(product, reason, recipient);

				return NextResponse.json(
					{ success: true, message: "NFT warning email sent" },
					{ status: 200 }
				);
			}
			case "platform-balance-alert": {
				const { recipient, report } = body;

				await notifyEmailService.sendPlatformBalanceEmail(recipient, report);

				return NextResponse.json(
					{ success: true, message: "Platform balance email sent" },
					{ status: 200 }
				);
			}
			default:
				return NextResponse.json({ error: "Unknown email route" }, { status: 400 });
		}
	} catch (error) {
		console.error(error);
		return NextResponse.json(
			{
				error: "Failed to send email",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
