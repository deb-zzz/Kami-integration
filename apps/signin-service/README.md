# KAMI Platform Sign-in Service

A secure and efficient sign-in service for the KAMI Platform, providing OTP-based email verification and account generation.

## Features

-   Email-based OTP (One-Time Password) generation and validation
-   Automatic account generation upon successful OTP validation
-   Redis-based OTP storage for scalable multi-container deployment
-   Atomic OTP operations preventing race conditions
-   Configurable OTP expiry time
-   Customizable email templates
-   Comprehensive test suite
-   TypeScript-based implementation

## Prerequisites

-   Node.js (v18.16.0 or higher)
-   pnpm (v7.33.6)
-   Redis (for OTP storage)
-   PostgreSQL (for account data via Prisma)

## Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/KAMI-Github/kami-platform-signin-service.git
    cd kami-platform-signin-service
    ```

2. Install dependencies:

    ```bash
    pnpm install
    ```

3. Create a `.env` file in the root directory with the following configuration:

    ```env
    # Server Configuration
    PORT=3100
    NODE_ENV=development

    # Database Configuration
    DB_PATH=./data/kami.db

    # SMTP Configuration
    SMTP_HOST=mail.kamiunlimited.com
    SMTP_PORT=465
    SMTP_USER=your-email@kamiunlimited.com
    SMTP_PASS=your-password
    SMTP_FROM=your-email@kamiunlimited.com

    # OTP Configuration
    OTP_EXPIRY_MINUTES=10
    ```

## Development

Start the development server:

```bash
pnpm dev
```

The server will start on port 3100 by default.

## Testing

Run the test suite:

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm test:watch
```

## API Endpoints

### Generate OTP

```http
POST /api/otp/generate
Content-Type: application/json

{
  "email": "user@example.com"
}
```

Response (success):

```json
{
	"success": true,
	"message": "OTP sent successfully"
}
```

Response (validation error):

```json
{
	"success": false,
	"errors": [
		{
			"msg": "Invalid email address",
			"param": "email",
			"location": "body"
		}
	]
}
```

Response (server error):

```json
{
	"success": false,
	"error": "Failed to generate OTP"
}
```

### Validate OTP

```http
POST /api/otp/validate
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}
```

Response (success):

```json
{
	"success": true,
	"message": "OTP validated successfully",
	"walletAddress": "0x123..."
}
```

Response (validation error):

```json
{
	"success": false,
	"errors": [
		{
			"msg": "OTP must be 6 digits",
			"param": "otp",
			"location": "body"
		}
	]
}
```

Response (invalid OTP):

```json
{
	"success": false,
	"error": "Invalid or expired OTP"
}
```

Response (server error):

```json
{
	"success": false,
	"error": "Failed to validate OTP"
}
```

## Project Structure

```
src/
├── config/         # Configuration files
├── routes/         # API route handlers
├── services/       # Business logic
├── tests/          # Test files
└── utils/          # Utility functions
```

## Error Handling

The service includes comprehensive error handling for:

-   Invalid email formats
-   Invalid OTP formats
-   Expired OTPs
-   SMTP connection issues
-   Database errors
-   Account generation failures

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

## Support

For support, please contact the KAMI Platform team.
