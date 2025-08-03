# Symentic Profiles API Documentation

## Overview
This API provides comprehensive access to Symentic Engram Profiles stored in DynamoDB. It supports full CRUD operations, advanced querying, enrichments, and interaction tracking.

## Data Structure

### Profile Schema
```typescript
interface Profile {
  // Core identifiers
  businessId: string;
  userId: string;
  id?: string; // Generated: profile_{businessId}_{userId}
  
  // Basic profile information
  name?: string;
  email?: string;
  role?: string;
  description?: string;
  userType?: 'internal' | 'external';
  source?: string; // e.g., 'slack'
  
  // Arrays
  tags?: string[];
  expertise?: string[];
  enrichments?: Enrichment[];
  
  // Complex objects
  consent?: Consent;
  slackProfile?: SlackProfile;
  
  // Metrics and timestamps
  interactionCount?: number;
  firstSeen?: string;
  lastUpdated?: string;
  lastInteraction?: string;
}
```

## Base URL
```
http://localhost:3001/api
```

## Endpoints

### 1. Query Profiles by Name and/or Tags
**GET** `/profiles/query`

Query profiles using name and/or tags with pagination support.

#### Query Parameters:
- `name` (string, optional): Search for profiles by name, email, or role
- `tags` (array/string, optional): Filter profiles by tags
- `businessId` (string, optional): Filter by business ID
- `userType` (string, optional): Filter by user type (internal/external)
- `limit` (number, optional): Number of results per page (default: 100)
- `lastKey` (string, optional): Pagination token for next page

#### Example Requests:
```bash
# Query by name
GET /api/profiles/query?name=john

# Query by tags
GET /api/profiles/query?tags=developer&tags=frontend

# Query by name and tags
GET /api/profiles/query?name=john&tags=developer

# With pagination
GET /api/profiles/query?name=john&limit=20&lastKey=eyJQSyI6InN5bWVudGljX3QwOTZsNiIsIlNLIjoiVVNFUiNVMTIzNDU2In0=
```

#### Response:
```json
{
  "profiles": [
    {
      "PK": "symentic_t096l6",
      "SK": "USER#U123456",
      "businessId": "T096L62N0MB",
      "userId": "U123456",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "tags": ["developer", "frontend"],
      "expertise": ["React", "TypeScript"],
      "userType": "internal"
    }
  ],
  "count": 1,
  "nextKey": "eyJQSyI6InN5bWVudGljX3QwOTZsNiIsIlNLIjoiVVNFUiNVMTIzNDU2In0="
}
```

### 2. List All Profiles
**GET** `/profiles`

List all profiles with optional filtering.

#### Query Parameters:
- `businessId` (string, optional): Filter by business ID
- `name` (string, optional): Filter by name
- `tags` (array/string, optional): Filter by tags
- `userType` (string, optional): Filter by user type

#### Example:
```bash
GET /api/profiles?businessId=T096L62N0MB&userType=internal
```

### 3. Search Profiles
**GET** `/profiles/search`

Full-text search across all profile fields.

#### Query Parameters:
- `q` (string, required): Search query
- `businessId` (string, optional): Limit search to specific business

#### Example:
```bash
GET /api/profiles/search?q=react&businessId=T096L62N0MB
```

### 4. Get Single Profile
**GET** `/profiles/:businessId/:userId`

Get a specific profile by business ID and user ID.

#### Example:
```bash
GET /api/profiles/T096L62N0MB/U123456
```

### 5. Create Profile
**POST** `/profiles`

Create a new profile.

#### Request Body:
```json
{
  "businessId": "T096L62N0MB",
  "userId": "U123456",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "description": "Senior Developer",
  "role": "Engineering",
  "userType": "internal",
  "tags": ["developer", "frontend"],
  "expertise": ["React", "TypeScript"]
}
```

### 6. Update Profile
**PUT** `/profiles/:businessId/:userId`

Update an existing profile.

#### Request Body:
```json
{
  "tags": ["developer", "frontend", "architect"],
  "expertise": ["React", "TypeScript", "Node.js"],
  "description": "Senior Software Architect"
}
```

### 7. Delete Profile
**DELETE** `/profiles/:businessId/:userId`

Delete a profile.

#### Example:
```bash
DELETE /api/profiles/T096L62N0MB/U123456
```

### 8. Health Check
**GET** `/health`

Check API server status.

#### Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-31T12:00:00.000Z"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Query parameter 'q' is required"
}
```

### 404 Not Found
```json
{
  "error": "Profile not found"
}
```

### 409 Conflict
```json
{
  "error": "Profile already exists for this user"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to fetch profiles"
}
```

## Running the API Server

1. Install dependencies:
```bash
cd src/api
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. The API will be available at `http://localhost:3001`

## Environment Variables

- `PORT`: Server port (default: 3001)
- AWS credentials are automatically handled through Amplify authentication