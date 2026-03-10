import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sigilsRoutes from './routes/sigils';
import referralsRoutes from './routes/referrals';
import { ApiResponse } from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
	res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Contract routes
app.use('/api/sigils', sigilsRoutes);
app.use('/api/referrals', referralsRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response<ApiResponse>, next: NextFunction) => {
	console.error('Error:', err);
	res.status(500).json({
		success: false,
		error: err.message || 'Internal server error',
	});
});

// 404 handler
app.use((req: Request, res: Response<ApiResponse>) => {
	res.status(404).json({
		success: false,
		error: 'Route not found',
	});
});

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
	console.log(`Health check: http://localhost:${PORT}/health`);
	console.log(`Sigils API: http://localhost:${PORT}/api/sigils`);
	console.log(`Referrals API: http://localhost:${PORT}/api/referrals`);
});
