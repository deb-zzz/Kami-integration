import nodemailer from "nodemailer";
import { logger } from "@/utils/logger";
import { format } from "date-fns/format";
import { ProhibitReason } from "@prisma/client";
import { EmailMessage } from "@/types/email";

interface EmailConfig {
	host: string;
	port: number;
	user: string;
	pass: string;
}

export class EmailService {
	private transporter: nodemailer.Transporter;
	private config: EmailConfig;

	constructor(config: EmailConfig) {
		this.config = config;
		this.transporter = nodemailer.createTransport({
			host: config.host,
			port: config.port,
			secure: config.port === 465,
			auth: {
				user: config.user,
				pass: config.pass,
			},
		});
	}

	async sendOtpEmail(
		email: string,
		otp: string,
		otpExpiryMinutes: number
	): Promise<void> {
		const mailOptions = {
			from: `${process.env.SMTP_USER_AUTH}`,
			to: email,
			subject: "Your KAMI Platform OTP",
			html: this.generateOtpEmailTemplate(otp, otpExpiryMinutes),
		};

		try {
			await this.transporter.sendMail(mailOptions);
		} catch (error) {
			logger.error("Failed to send OTP email:", error);
			throw new Error("Failed to send OTP email");
		}
	}

	private generateOtpEmailTemplate(
		otp: string,
		otpExpiryMinutes: number
	): string {
		return `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<h2 style="color: #333;">Your KAMI Platform OTP</h2>
				<p>Your One-Time Password (OTP) is:</p>
				<div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
					<strong>${otp}</strong>
				</div>
				<p>This OTP will expire in ${otpExpiryMinutes || 10} minutes.</p>
				<p>If you didn't request this OTP, please ignore this email.</p>
				<hr style="border: 1px solid #eee; margin: 20px 0;">
				<p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
			</div>
		`;
	}

	async sendReportBugEmail(
		username: string,
		email: string,
		issueTypes: string[],
		description: string
	): Promise<void> {
		const mailOptions = {
			from: `"${email} via KAMI" <${process.env.SMTP_USER_NOTIFY}>`,
			to: "support@kamiunlimited.com",
			replyTo: email,
			subject: `Bug Report - ${issueTypes.join(", ").toUpperCase()}`,
			html: `
				<!DOCTYPE html>
				<html>
				<head>
					<style>
						body {
							font-family: Arial, sans-serif;
							line-height: 1.6;
							color: #333;
							max-width: 600px;
							margin: 0 auto;
							padding: 20px;
						}
						.header {
							background-color: #11FF49;
							color: #1A1A1A;
							padding: 20px;
							border-radius: 8px;
							margin-bottom: 20px;
						}
						.header h1 {
							margin: 0;
							font-size: 24px;
						}
						.content {
							background-color: #f5f5f5;
							padding: 20px;
							border-radius: 8px;
							margin-bottom: 20px;
						}
						.field {
							margin-bottom: 15px;
						}
						.field-label {
							font-weight: bold;
							color: #1A1A1A;
							margin-bottom: 5px;
						}
						.field-value {
							color: #333;
						}
						.issue-types {
							display: flex;
							flex-wrap: wrap;
							gap: 8px;
						}
						.issue-tag {
							background-color: #11FF49;
							color: #1A1A1A;
							padding: 4px 12px;
							border-radius: 4px;
							font-size: 12px;
							font-weight: bold;
                            text-transform: capitalize;
						}
						.description-box {
							background-color: white;
							padding: 15px;
							border-radius: 4px;
							border-left: 4px solid #11FF49;
							white-space: pre-wrap;
						}
						.note {
							background-color: #fff3cd;
							color: #856404;
							padding: 12px;
							border-radius: 4px;
							border-left: 4px solid #ffc107;
							margin-top: 20px;
						}
						.footer {
							color: #666;
							font-size: 12px;
							margin-top: 20px;
							padding-top: 20px;
							border-top: 1px solid #ddd;
						}
					</style>
				</head>
				<body>
					<div class="header">
						<h1>🐛 Bug Report Submission</h1>
					</div>
					
					<div class="content">
						${
				username
					? `<div class="field">
							<div class="field-label">Username:</div>
							<div class="field-value">${username}</div>
						</div>`
					: ""
			}
						
						<div class="field">
							<div class="field-label">User Email:</div>
							<div class="field-value">${email}</div>
						</div>
						
						<div class="field">
							<div class="field-label">Issue Types:</div>
							<div class="issue-types">
								${issueTypes
				.map((type: string) => `<span class="issue-tag">${type}</span>`)
				.join("")}
							</div>
						</div>
						
						<div class="field">
							<div class="field-label">Description:</div>
							<div class="description-box">${description}</div>
						</div>
						
					</div>
					
					<div class="footer">
						<p>Submitted on: ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
						<p>You can reply directly to this email to contact the user at ${email}</p>
					</div>
				</body>
				</html>
			`,
			text: `
Bug Report Submission
${username ? `\nUsername: ${username}` : ""}

User Email: ${email}

Issue Types: ${issueTypes.join(", ")}

Description:
${description}

Submitted on: ${new Date().toLocaleString()}
			`,
		};

		try {
			await this.transporter.sendMail(mailOptions);
		} catch (error) {
			logger.error("Failed to send Bug Report email:", error);
			throw new Error("Failed to send Bug Report email");
		}
	}

	async sendReportPostEmail(
		username: string,
		email: string,
		issueTypes: string,
		postId: number,
		description: string,
		remarks: string,
	): Promise<void> {
		const mailOptions = {
			from: `"${email} via KAMI" <${process.env.SMTP_USER_NOTIFY}>`,
			to: "support@kamiunlimited.com",
			replyTo: email,
			subject: `Post/Content Report - ${issueTypes}`,
			html: `
				<!DOCTYPE html>
				<html>
				<head>
					<style>
						body {
							font-family: Arial, sans-serif;
							line-height: 1.6;
							color: #333;
							max-width: 600px;
							margin: 0 auto;
							padding: 20px;
						}
						.header {
							background-color: #11FF49;
							color: #1A1A1A;
							padding: 20px;
							border-radius: 8px;
							margin-bottom: 20px;
						}
						.header h1 {
							margin: 0;
							font-size: 24px;
						}
						.content {
							background-color: #f5f5f5;
							padding: 20px;
							border-radius: 8px;
							margin-bottom: 20px;
						}
						.field {
							margin-bottom: 15px;
						}
						.field-label {
							font-weight: bold;
							color: #1A1A1A;
							margin-bottom: 5px;
						}
						.field-value {
							color: #333;
						}
						.issue-types {
							display: flex;
							flex-wrap: wrap;
							gap: 8px;
						}
						.issue-tag {
							background-color: #11FF49;
							color: #1A1A1A;
							padding: 4px 12px;
							border-radius: 4px;
							font-size: 12px;
							font-weight: bold;
                            text-transform: capitalize;
						}
						.description-box {
							background-color: white;
							padding: 15px;
							border-radius: 4px;
							border-left: 4px solid #11FF49;
							white-space: pre-wrap;
						}
						.note {
							background-color: #fff3cd;
							color: #856404;
							padding: 12px;
							border-radius: 4px;
							border-left: 4px solid #ffc107;
						}
						.footer {
							color: #666;
							font-size: 12px;
							margin-top: 20px;
							padding-top: 20px;
							border-top: 1px solid #ddd;
						}
					</style>
				</head>
				<body>
					<div class="header">
						<h1>🚩 Post/Content Report Submission</h1>
					</div>
					
					<div class="content">
						${username ? 
							`<div class="field">
								<div class="field-label">Username:</div>
								<div class="field-value">${username}</div>
							</div>`
						: "" }
						
						<div class="field">
							<div class="field-label">User Email:</div>
							<div class="field-value">${email}</div>
						</div>

						<div class="field">
							<div class="field-label">Post ID:</div>
							<div class="field-value">${postId}</div>
						</div>
						
						<div class="field">
							<div class="field-label">Issue Type:</div>
							<div class="issue-type">
								<span class="issue-tag">${issueTypes}</span>
							</div>
						</div>
						
						<div class="field">
							<div class="field-label">Issue Description:</div>
							<div class="description-box">${description}</div>
						</div>
						
						${remarks ? 
							`<div class="field">
								<div class="field-label">Reporter Remarks:</div>
								<div class="note">${remarks}</div>
							</div>`: ""}
					
					</div>

					<div class="footer">
						<p>Submitted on: ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
						<p>You can reply directly to this email to contact the user at ${email}</p>
					</div>
				</body>
				</html>
			`,
			text: `
Post Report Submission
${username ? `\nUsername: ${username}` : ""}

User Email: ${email}

Post ID: ${postId}

Issue Type: ${issueTypes}

Description:
${description}

Reporter Remarks:
${remarks}

Submitted on: ${new Date().toLocaleString()}
			`,
		};

		try {
			await this.transporter.sendMail(mailOptions);
		} catch (error) {
			logger.error("Failed to send Post Report email:", error);
			throw new Error("Failed to send Post Report email");
		}
	}

	async sendNftFlagWarningEmail(
		product: { name: string; type: string; id: string },
		reason: ProhibitReason,
		recipient: { userName: string; email: string; walletAddress: string }
	): Promise<void> {
		const subject = this.getEmailSubject(reason);
		const msg = this.getEmailMessage(reason);

		const mailOptions = {
			from: `"KAMI Team" <${process.env.SMTP_USER_NOTIFY}>`,
			to: recipient.email,
			subject: subject,
			html: `
<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Warning Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; font-size: 14px; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; padding: 30px; border-radius: 6px; border: 2px solid #ddd;">

                <!-- Header -->
                <div style="background-color: #dc2626; color: #fff; text-align: center; padding: 20px; border-radius: 4px;">
                    <h1 style="margin: 0; font-size: 20px;">${msg.title}</h1>
                </div>

                <!-- Greeting -->
                <p>Hello <strong>${recipient.userName}</strong>,</p>

                <!-- Warning -->
                <p style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 10px; border-radius: 4px;">
                    Your NFT has been flagged and is now hidden from the marketplace.
                </p>

                <!-- NFT Details -->
                <p><strong>NFT Details:</strong></p>
                <ul style="padding-left: 20px;">
                    <li><strong>Name:</strong> ${product.name}</li>
                    <li><strong>Type:</strong> ${product.type}</li>
                    <li><strong>ID:</strong> ${product.id}</li>
                </ul>

                <!-- Reason -->
                <p><strong>Reason:</strong> ${msg.description}</p>

                <!-- Action Required -->
                <p style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 10px; border-radius: 4px;">
                    <strong>Action Required:</strong> ${msg.action}
                </p>

                <!-- Support -->
                <p><strong>Please contact support with the following information:</strong></p>
                <ul style="padding-left: 20px;">
                    <li>Your wallet address: <code>${recipient.walletAddress}</code></li>
                    <li>NFT ID: <code>${product.id}</code></li>
                    <li>Explanation or proof of compliance</li>
                </ul>

                <!-- Footer -->
                <p style="margin-top: 20px; font-size: 12px; color: #666; text-align: center;">
                    This is an automated message from the KAMI Admin Team.<br>
                    For support, contact <a href="mailto:support@kamiunlimited.com" style="color: #3b82f6;">support@kamiunlimited.com</a>.<br>
                    &copy; ${new Date().getFullYear()} KAMI. All rights reserved.
                </p>
            </div>
        </body>
        </html>
    `,
		};

		try {
			await this.transporter.sendMail(mailOptions);
		} catch (error) {
			logger.error("Failed to send NFT warning email:", error);
			throw new Error("Failed to send NFT warning email");
		}
	}

	private getEmailMessage(reason: ProhibitReason): EmailMessage {
		const messages: Record<string, EmailMessage> = {
			[ProhibitReason.NSFW]: {
				title: "NSFW Content Detected",
				description:
					"Your NFT contains content that is Not Safe For Work (NSFW) and violates our community guidelines.",
				action: "Please update or remove the content to comply with our policies.",
			},
			[ProhibitReason.INFRINGEMENT]: {
				title: "Copyright Infringement",
				description: "Your NFT appears to infringe on copyrighted material.",
				action:
					"Please remove the infringing content or provide proof of ownership/license.",
			},
		};

		return (
			messages[reason] || {
				title: "Content Violation",
				description: "Your NFT has been flagged for violating our policies.",
				action: "Please review our community guidelines.",
			}
		);
	}

	private getEmailSubject(reason: ProhibitReason): string {
		const subjects: Record<ProhibitReason, string> = {
			[ProhibitReason.NSFW]: "Warning: Your NFT Contains NSFW Content",
			[ProhibitReason.INFRINGEMENT]: "Warning: Copyright Infringement Detected",
		};
		return subjects[reason] || "Warning: Your NFT Has Been Flagged";
	}

	async sendPlatformBalanceEmail(
		recipients: string[],
		report: {
			chainId: string;
			chainName: string;
			wallets: {
				label: string;
				address: string;
				ethBalance: string;
				usdcBalance: string;
				ethBalanceFormatted: string;
				usdcBalanceFormatted: string;
				isLow?: boolean;
			}[];
		}
	): Promise<void> {
		const mailOptions = {
			from: `"KAMI Team" <${process.env.SMTP_USER_NOTIFY}>`,
			to: recipients,
			subject: 'KAMI Wallet Balance Alert',
			html: this.generatePlatformBalanceEmailTemplate(report),
		};
		await this.transporter.sendMail(mailOptions);
	}

	private generatePlatformBalanceEmailTemplate(
		report: {
			chainId: string;
			chainName: string;
			wallets: {
				label: string;
				address: string;
				ethBalance: string;
				usdcBalance: string;
				ethBalanceFormatted: string;
				usdcBalanceFormatted: string;
				isLow?: boolean;
			}[];
		}
	): string {
		let rows = "";
		const lowWallets = report.wallets.filter(w => w.isLow);

		for (const w of report.wallets) {
			const color = w.isLow? "color:#d9534f;" : "";
			rows += `
                <tr style="${color}">
                    <td style="padding:8px;border-bottom:1px solid #eee;font-size: 14px;">${w.label}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;font-size: 14px;">${w.address}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;text-align:right;font-size: 14px;">${Number(w.ethBalanceFormatted).toFixed(5)}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;text-align:right;font-size: 14px;">${Number(w.usdcBalanceFormatted).toFixed(2)}</td>
                </tr>
            `;
		}

		return `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<h2 style="color: #333;">Blockchain: ${report.chainName ?? report.chainId}</h2>
				<p style="font-size: 14px; color: #333; margin-bottom: 15px;">
				    Attention: ${lowWallets.length} wallet(s) have a low balance. Please review them below.
                </p>
				
				<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                    <thead>
                    <tr style="background:#f5f5f5;">
                        <th style="padding:8px;text-align:left;font-size: 14px;">Label</th>
                        <th style="padding:8px;text-align:left;font-size: 14px;">Address</th>
                        <th style="padding:8px;text-align:right;font-size: 14px;">ETH</th>
                        <th style="padding:8px;text-align:right;font-size: 14px;">USDC</th>
                    </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
				
				<hr style="border: 1px solid #eee; margin: 20px 0;">
				<p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
			</div>
		`;
	}
}
