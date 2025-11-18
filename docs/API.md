# API Documentation

Base URL: `http://localhost:3001/api/v1` (development)

## Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-token>
```

## Endpoints

### Analysis

#### Analyze Pull Request

```http
POST /analysis/pull-request
```

**Request Body:**

```json
{
  "repositoryId": "uuid",
  "prNumber": 123,
  "files": [
    {
      "filePath": "src/example.ts",
      "content": "const example = 'code';",
      "status": "modified",
      "additions": 10,
      "deletions": 5
    }
  ],
  "baseBranch": "main",
  "headBranch": "feature/new-feature"
}
```

**Response:**

```json
{
  "pullRequestId": "uuid",
  "issues": [
    {
      "filePath": "src/example.ts",
      "lineNumber": 10,
      "severity": "high",
      "category": "security",
      "message": "Potential security vulnerability",
      "fixSuggestion": "Use parameterized queries",
      "confidence": 0.85
    }
  ],
  "summary": {
    "totalIssues": 5,
    "criticalIssues": 1,
    "highIssues": 2,
    "mediumIssues": 1,
    "lowIssues": 1,
    "filesAnalyzed": 3,
    "linesAnalyzed": 150,
    "analysisTime": 2500
  }
}
```

#### Get Pull Request Issues

```http
GET /analysis/pull-request/:id/issues
```

**Response:**

```json
[
  {
    "filePath": "src/example.ts",
    "lineNumber": 10,
    "severity": "high",
    "category": "security",
    "message": "Potential security vulnerability",
    "fixSuggestion": "Use parameterized queries",
    "confidence": 0.85
  }
]
```

### Pull Requests

#### List Pull Requests

```http
GET /pull-requests?repositoryId=uuid
```

**Response:**

```json
[
  {
    "id": "uuid",
    "prNumber": 123,
    "title": "Add new feature",
    "status": "open",
    "issueCount": 5,
    "linesChanged": 150,
    "repository": {
      "id": "uuid",
      "name": "my-repo"
    }
  }
]
```

#### Get Pull Request Details

```http
GET /pull-requests/:id
```

**Response:**

```json
{
  "id": "uuid",
  "prNumber": 123,
  "title": "Add new feature",
  "status": "open",
  "sourceBranch": "feature/new",
  "targetBranch": "main",
  "issueCount": 5,
  "linesChanged": 150,
  "repository": {
    "id": "uuid",
    "name": "my-repo"
  },
  "issues": [...]
}
```

#### Get Analytics

```http
GET /pull-requests/analytics
```

**Response:**

```json
{
  "totalPRs": 50,
  "totalIssues": 250,
  "criticalIssues": 10,
  "averageIssuesPerPR": "5.00"
}
```

### Repositories

#### List Repositories

```http
GET /repositories
```

**Response:**

```json
[
  {
    "id": "uuid",
    "name": "my-repo",
    "fullName": "org/my-repo",
    "platform": "github",
    "enabled": true,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

#### Get Repository

```http
GET /repositories/:id
```

**Response:**

```json
{
  "id": "uuid",
  "name": "my-repo",
  "fullName": "org/my-repo",
  "platform": "github",
  "enabled": true,
  "pullRequests": [...]
}
```

#### Toggle Repository

```http
PATCH /repositories/:id/toggle
```

**Request Body:**

```json
{
  "enabled": true
}
```

### Custom Rules

#### List Rules

```http
GET /rules
```

**Response:**

```json
[
  {
    "id": "uuid",
    "name": "No console.log",
    "language": "javascript",
    "pattern": "console\\.log\\(",
    "severity": "high",
    "category": "best_practice",
    "enabled": true
  }
]
```

#### Create Rule

```http
POST /rules
```

**Request Body:**

```json
{
  "name": "No console.log in production",
  "description": "Prevents console.log statements",
  "language": "javascript",
  "pattern": "console\\.log\\(",
  "severity": "high",
  "category": "best_practice",
  "message": "Remove console.log statements",
  "fixTemplate": "Use proper logging library"
}
```

#### Update Rule

```http
PUT /rules/:id
```

#### Delete Rule

```http
DELETE /rules/:id
```

#### Toggle Rule

```http
PATCH /rules/:id/toggle
```

**Request Body:**

```json
{
  "enabled": false
}
```

### AI

#### Analyze Code with AI

```http
POST /ai/analyze
```

**Request Body:**

```json
{
  "code": "const example = 'code';",
  "language": "javascript",
  "filePath": "src/example.ts",
  "context": "Optional context"
}
```

**Response:**

```json
{
  "issues": [...],
  "suggestions": [
    "Consider using const instead of let",
    "Add error handling"
  ],
  "summary": "Code analysis complete"
}
```

#### Explain Code

```http
POST /ai/explain
```

**Request Body:**

```json
{
  "code": "const example = 'code';",
  "language": "javascript"
}
```

**Response:**

```json
{
  "explanation": "This code declares a constant variable named 'example' with the value 'code'."
}
```

### Webhooks

#### GitHub Webhook

```http
POST /webhooks/github
```

**Headers:**
- `x-hub-signature-256`: GitHub webhook signature
- `x-github-event`: Event type (e.g., "pull_request")

**Request Body:**

GitHub webhook payload (automatically sent by GitHub)

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "repositoryId",
      "message": "repositoryId must be a UUID"
    }
  ]
}
```

### 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 404 Not Found

```json
{
  "statusCode": 404,
  "message": "Resource not found"
}
```

### 500 Internal Server Error

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## Rate Limiting

API endpoints are rate limited:

- **Authenticated requests**: 1000 requests/hour
- **Webhook endpoints**: 10000 requests/hour

Rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Pagination

List endpoints support pagination:

```http
GET /pull-requests?page=1&limit=20
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## Swagger Documentation

Interactive API documentation is available at:

```
http://localhost:3001/api/docs
```

## SDKs

Official SDKs are available for:

- JavaScript/TypeScript: `@ai-code-review/sdk`
- Python: `ai-code-review-python`
- Go: `github.com/ai-code-review/go-sdk`

## Support

For API questions:
- GitHub Issues: https://github.com/your-org/ai-code-review/issues
- Documentation: https://docs.your-domain.com
- Email: api-support@your-domain.com
