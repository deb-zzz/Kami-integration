# Currency API Documentation

## Overview
Complete CRUD operations for managing currencies in the KAMI platform, based on the charge-types template with enhanced administrator authentication and validation.

## Files Structure
```
src/app/api/currency/
├── route.ts              # Main CRUD endpoints (GET, POST, PUT)
├── [symbol]/
│   └── route.ts         # Individual currency operations (GET by symbol, DELETE)
├── validation.ts        # Validation schemas and administrator checks
└── README.md           # This file
```

## Authentication & Authorization

### Administrator Validation (CUD Operations)
All **Create**, **Update**, and **Delete** operations require administrator authentication:

1. **JWT Token Extraction**: Admin email is extracted from the `Authorization: Bearer <token>` header
2. **Administrator Validation**: The system validates that:
   - Administrator email exists in the database
   - Administrator account status is "active"
   - Administrator account has not been deleted (deletedAt = null)
3. **Audit Trail**: The administrator's email is stored in the `updatedBy` field for audit purposes

### Error Responses
- **401 Unauthorized**: Invalid or missing JWT token, or administrator validation failed
- **400 Bad Request**: Validation errors (duplicate symbol, invalid data, etc.)
- **404 Not Found**: Currency not found
- **500 Internal Server Error**: Database or server errors

## API Endpoints

### 1. GET /api/currency
Retrieves all currencies with pagination, filtering, and sorting.

**Authentication**: Not required

**Query Parameters**:
- `page` (default: 1) - Page number
- `perPage` (default: 10) - Items per page
- `sort` (default: "createdAt,desc") - Format: "field,order"
- `symbol` - Filter by symbol (partial match)
- `name` - Filter by name (partial match)
- `type` - Filter by type ("Fiat" or "Crypto")
- `isActive` - Filter by active status (true/false)
- `createdAtFrom` - Filter by creation date (ISO format)
- `createdAtTo` - Filter by creation date (ISO format)
- `updatedAtFrom` - Filter by update date (ISO format)
- `updatedAtTo` - Filter by update date (ISO format)
- `includeDeleted` - Include soft-deleted records (default: false)

**Response**:
```json
{
  "data": [
    {
      "symbol": "USD",
      "name": "US Dollar",
      "type": "Fiat",
      "isActive": true,
      "createdAt": 1703123456,
      "updatedAt": 1703123456,
      "updatedBy": "admin@example.com",
      "deletedAt": null,
      "updatedBy": {
        "email": "admin@example.com",
        "name": "Admin User"
      }
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "perPage": 10,
      "total": 25,
      "totalPages": 3
    },
    "filters": { ... },
    "sort": {
      "by": "createdAt",
      "order": "desc"
    }
  }
}
```

### 2. POST /api/currency
Creates a new currency.

**Authentication**: Required (JWT Bearer token)

**Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "symbol": "USD",
  "name": "US Dollar",
  "type": "Fiat",
  "isActive": true
}
```

**Validation Rules**:
- `symbol`: Required, automatically converted to uppercase, must be unique
- `name`: Required
- `type`: Required, must be "Fiat" or "Crypto"
- `isActive`: Optional, defaults to true
- Administrator must be authenticated and active

**Response** (201 Created):
```json
{
  "symbol": "USD",
  "name": "US Dollar",
  "type": "Fiat",
  "isActive": true,
  "createdAt": 1703123456,
  "updatedAt": 1703123456,
  "updatedBy": null,
  "deletedAt": null
}
```

### 3. PUT /api/currency
Updates an existing currency.

**Authentication**: Required (JWT Bearer token)

**Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "symbol": "USD",
  "name": "United States Dollar",
  "type": "Fiat",
  "isActive": false
}
```

**Validation Rules**:
- `symbol`: Required (identifies the currency to update)
- `name`: Optional
- `type`: Optional
- `isActive`: Optional
- Administrator must be authenticated and active

**Response** (200 OK):
```json
{
  "symbol": "USD",
  "name": "United States Dollar",
  "type": "Fiat",
  "isActive": false,
  "createdAt": 1703123456,
  "updatedAt": 1703125678,
  "updatedBy": "admin@example.com",
  "deletedAt": null
}
```

### 4. GET /api/currency/[symbol]
Retrieves a specific currency by its symbol.

**Authentication**: Not required

**URL Parameters**:
- `symbol` - Currency symbol (e.g., USD, ETH)

**Response** (200 OK):
```json
{
  "symbol": "USD",
  "name": "US Dollar",
  "type": "Fiat",
  "isActive": true,
  "createdAt": 1703123456,
  "updatedAt": 1703123456,
  "updatedBy": "admin@example.com",
  "deletedAt": null,
  "updatedBy": {
    "email": "admin@example.com",
    "name": "Admin User"
  }
}
```

### 5. DELETE /api/currency/[symbol]
Deletes a currency (soft delete by default, hard delete with force parameter).

**Authentication**: Required (JWT Bearer token)

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**URL Parameters**:
- `symbol` - Currency symbol to delete

**Query Parameters**:
- `force` (optional) - Set to "true" for permanent deletion

**Soft Delete Response** (200 OK):
```json
{
  "message": "Currency deleted successfully."
}
```

**Hard Delete Response** (200 OK):
```json
{
  "message": "Currency permanently deleted."
}
```

## Validation Details

### Administrator Validation
The `validateAdministrator()` function checks:
1. Administrator email is provided (from JWT)
2. Administrator exists in database
3. Administrator status is "active"
4. Administrator has not been deleted

### Currency Validation
- **Create**: Checks for duplicate symbols (case-insensitive)
- **Update**: Verifies currency exists before updating
- **Symbol Format**: Automatically converted to uppercase

## Database Schema Reference

```prisma
model currency {
  symbol       String          @id
  name         String
  type         CurrencyType
  isActive     Boolean         @default(true)
  createdAt    Int
  updatedAt    Int?
  updatedBy  String?
  deletedAt    Int?
  
  @@map("currencies")
}

enum CurrencyType {
  Fiat
  Crypto
}
```

## Testing

Use the provided `tests/currency.http` file for testing all endpoints. Remember to:
1. First login via `/api/login` to get a JWT token
2. Replace `YOUR_JWT_TOKEN_HERE` with the actual token
3. Test in order: Create → Read → Update → Delete

## Error Handling

### Common Error Responses

**Administrator Validation Failed (401)**:
```json
{
  "error": "Administrator validation failed",
  "details": "Administrator email is required."
}
```

**Validation Failed (400)**:
```json
{
  "error": "Validation failed",
  "fieldErrors": {
    "symbol": "Already exists.",
    "administrator": "Administrator account is not active."
  }
}
```

**Currency Not Found (404)**:
```json
{
  "error": "Currency not found."
}
```

## Best Practices

1. **Always include Authorization header** for CUD operations
2. **Use uppercase symbols** (automatic conversion, but consistent input is better)
3. **Prefer soft delete** over hard delete for data integrity
4. **Check administrator status** before performing operations
5. **Use pagination** for large datasets in GET requests
6. **Filter by isActive** to get only active currencies in production

## Audit Trail

The system maintains a complete audit trail:
- `createdAt`: Unix timestamp of creation
- `updatedAt`: Unix timestamp of last update
- `updatedBy`: Email of administrator who last modified the record
- `deletedAt`: Unix timestamp of soft deletion (null if active)
- `updatedBy`: Full administrator object with email and name
