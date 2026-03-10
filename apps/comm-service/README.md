# KAMI Platform Comm Service

A TypeScript Node.js API service for managing all communication of the system including App & BackOffice Portal.

## Features

- RESTful API endpoints
- TypeScript support
- Communication services

### Email Notifications
- **OTP** - Using auth sender
- **Bug Report** - Using notify sender
- **Content Report** - Using notify sender
- **NFT Flagging** - Using notify sender
- **Admin Wallet Balance Alert** - Using notify sender

## Prerequisites

- Node.js (v18 or higher)
- pnpm package manager

## Installation

1. Install dependencies:

```bash
pnpm install
```

2. Create environment file:

```bash
cp env.example .env
```

3. Configure your `.env` file:

```env
PORT=3000
NODE_ENV=development
```

## Usage

### Development

```bash
pnpm run dev
```

### Production

```bash
pnpm run build
pnpm start
```

### Watch Mode

```bash
pnpm run dev:watch
```

## Error Handling

All endpoints return consistent error responses:

```json
{
    "error": "Human readable error message"
}
```

## Security Notes

- Never commit private keys to version control
- Use environment variables for sensitive configuration
- Consider implementing proper authentication for production use
- Validate all input parameters
- Use HTTPS in production

## License

MIT