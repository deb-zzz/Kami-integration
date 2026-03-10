import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ErrorResponse } from '../types';

/**
 * Generic validation middleware for request body
 */
export const validateBody = (schema: ZodSchema) => {
	return (req: Request, res: Response, next: NextFunction) => {
		try {
			req.body = schema.parse(req.body);
			next();
		} catch (error) {
			if (error instanceof ZodError) {
				const errorResponse: ErrorResponse = {
					success: false,
					error: 'VALIDATION_ERROR',
					message: 'Request validation failed',
					details: error.issues.map((err) => ({
						field: err.path.join('.'),
						message: err.message,
					})),
				};
				return res.status(400).json(errorResponse);
			}
			next(error);
		}
	};
};

/**
 * Generic validation middleware for query parameters
 */
export const validateQuery = (schema: ZodSchema) => {
	return (req: Request, res: Response, next: NextFunction) => {
		try {
			const validatedQuery = schema.parse(req.query);
			req.query = validatedQuery as any;
			next();
		} catch (error) {
			if (error instanceof ZodError) {
				const errorResponse: ErrorResponse = {
					success: false,
					error: 'VALIDATION_ERROR',
					message: 'Query parameter validation failed',
					details: error.issues.map((err) => ({
						field: err.path.join('.'),
						message: err.message,
					})),
				};
				return res.status(400).json(errorResponse);
			}
			next(error);
		}
	};
};
