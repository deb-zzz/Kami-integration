import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { OtpService } from '../services/otp.service';
import { logger } from '../utils/logger';
import { AccountController } from '../controllers/AccountController';

const router = Router();
const otpService = new OtpService();

// Generate OTP
router.post('/generate', [body('email').isEmail().withMessage('Invalid email address')], async (req: Request, res: Response) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				errors: errors.array(),
			});
		}

		const { email } = req.body;
		const isWhitelisted = await otpService.isEmailWhitelisted(email);
		if (!isWhitelisted) {
			return res.status(428).json({
				success: false,
				error: 'Email is not whitelisted',
			});
		}
		await otpService.generateOtp(email);

		res.status(200).json({
			success: true,
			message: 'OTP sent successfully',
		});
	} catch (error) {
		logger.error('Error in generate OTP route:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to generate OTP',
		});
	}
});

// Validate OTP
router.post(
	'/validate',
	[
		body('email').isEmail().withMessage('Invalid email address'),
		body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
	],
	async (req: Request, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					errors: errors.array(),
				});
			}

			const { email, otp } = req.body;
			const isValid = await otpService.validateOtp(email, otp);

			if (isValid) {
				const accountController = new AccountController();
				const account = await accountController.generateAccount(email);

				res.status(200).json({
					success: true,
					message: 'OTP validated successfully',
					walletAddress: account.address,
				});
			} else {
				res.status(400).json({
					success: false,
					error: 'Invalid or expired OTP',
				});
			}
		} catch (error) {
			logger.error('Error in validate OTP route:', {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				email: req.body?.email,
			});
			res.status(500).json({
				success: false,
				error: 'Failed to validate OTP',
			});
		}
	}
);

export const otpRoutes = router;
