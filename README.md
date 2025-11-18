# Multi-Language AI Code Review Tool

A comprehensive, AI-powered code review platform that analyzes code for bugs, security vulnerabilities, performance issues, and style violations across 10+ programming languages.

## Features

- **Multi-Language Support**: JavaScript/TypeScript, Python, Java, Go, Ruby, PHP, C#, Rust, Swift, Kotlin
- **AI-Powered Analysis**: Uses GPT-4 and Claude for intelligent code review
- **Security Scanning**: OWASP Top 10 vulnerability detection
- **Performance Optimization**: Algorithm complexity and N+1 query detection
- **Git Integration**: Seamless GitHub, GitLab, and Bitbucket integration
- **Custom Rules Engine**: Create organization-specific coding standards
- **Analytics Dashboard**: Track code quality metrics and trends
- **Automated Fixes**: AI-generated fix suggestions with one-click application

## Architecture

### Monorepo Structure

```
.
├── apps/
│   ├── frontend/          # Next.js 14 + TypeScript
│   └── backend/           # NestJS + TypeScript
├── packages/              # Shared packages
├── docs/                  # Documentation
└── turbo.json            # Turbo monorepo configuration
```

### Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- TypeScript 5.0+
- Tailwind CSS 3.4+
- Shadcn/ui components
- Monaco Editor for code display
- Zustand for state management

**Backend:**
- NestJS 10+
- TypeScript 5.0+
- PostgreSQL 15+ with Prisma ORM
- Redis for caching
- BullMQ for job queuing
- Tree-sitter for code parsing

**AI/ML:**
- OpenAI GPT-4 Turbo
- Anthropic Claude 3.5 Sonnet
- Tree-sitter for AST parsing
- Custom static analyzers

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- npm or yarn

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/your-org/ai-code-review.git
cd ai-code-review
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
# Backend
cp apps/backend/.env.example apps/backend/.env

# Edit .env with your configuration:
# - Database connection
# - Redis connection
# - OpenAI/Anthropic API keys
# - GitHub credentials
```

4. **Initialize the database**

```bash
cd apps/backend
npm run generate
npm run migrate
```

5. **Start development servers**

```bash
# From root directory
npm run dev
```

This starts:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Swagger docs: http://localhost:3001/api/docs

## Configuration

### Database Setup

```bash
# Create PostgreSQL database
createdb ai_code_review

# Run migrations
cd apps/backend
npm run migrate

# (Optional) Seed data
npm run db:seed
```

### GitHub Integration

1. Create a GitHub App at https://github.com/settings/apps/new

2. Set the following permissions:
   - Pull requests: Read & Write
   - Contents: Read
   - Checks: Read & Write

3. Add webhook URL: `https://your-domain.com/api/v1/webhooks/github`

4. Subscribe to events:
   - Pull request
   - Push

5. Generate and download private key

6. Update environment variables:
   ```
   GITHUB_APP_ID=your_app_id
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   GITHUB_WEBHOOK_SECRET=your_webhook_secret
   GITHUB_PRIVATE_KEY_PATH=./private-key.pem
   ```

### AI Provider Setup

**OpenAI:**
```bash
OPENAI_API_KEY=sk-your-api-key
OPENAI_MODEL=gpt-4-turbo-preview
```

**Anthropic Claude:**
```bash
ANTHROPIC_API_KEY=sk-ant-your-api-key
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

## Usage

### Analyzing a Pull Request

The system automatically analyzes pull requests when:
- A new PR is opened
- Commits are pushed to an existing PR
- A PR is reopened

### Manual Analysis via API

```bash
curl -X POST http://localhost:3001/api/v1/analysis/pull-request \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryId": "repo-uuid",
    "prNumber": 123,
    "files": [
      {
        "filePath": "src/example.ts",
        "content": "...",
        "status": "modified",
        "additions": 10,
        "deletions": 5
      }
    ],
    "baseBranch": "main",
    "headBranch": "feature/new-feature"
  }'
```

### Custom Rules

Create custom rules via the dashboard or API:

```typescript
{
  "name": "No console.log in production",
  "language": "javascript",
  "pattern": "console\\.log\\(",
  "severity": "high",
  "category": "best_practice",
  "message": "Remove console.log statements",
  "fixSuggestion": "Use proper logging library"
}
```

## API Documentation

Full API documentation is available at:
- Swagger UI: http://localhost:3001/api/docs
- OpenAPI spec: http://localhost:3001/api/docs-json

## Development

### Project Structure

```
apps/backend/src/
├── analysis/          # Code analysis engine
│   ├── parsers/       # Tree-sitter parsers
│   ├── analyzers/     # Language-specific analyzers
│   └── types/         # Type definitions
├── ai/                # AI service integration
├── github/            # GitHub integration
├── repositories/      # Repository management
├── pull-requests/     # PR management
├── rules/             # Custom rules engine
├── cache/             # Redis caching
├── queue/             # Job queue
├── auth/              # Authentication
└── prisma/            # Database schema
```

### Running Tests

```bash
# Backend tests
cd apps/backend
npm test

# Frontend tests
cd apps/frontend
npm test
```

### Building for Production

```bash
# Build all packages
npm run build

# Build specific app
npm run build --workspace=apps/backend
npm run build --workspace=apps/frontend
```

## Deployment

### Docker

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d
```

### Environment Variables

Required environment variables for production:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_HOST=...
OPENAI_API_KEY=...
GITHUB_APP_ID=...
```

## Supported Languages

| Language | Static Analysis | AI Analysis | Security Scan |
|----------|----------------|-------------|---------------|
| JavaScript | ✅ | ✅ | ✅ |
| TypeScript | ✅ | ✅ | ✅ |
| Python | ✅ | ✅ | ✅ |
| Java | ⚠️ | ✅ | ✅ |
| Go | ⚠️ | ✅ | ✅ |
| Ruby | ⚠️ | ✅ | ✅ |
| PHP | 🔄 | ✅ | ✅ |
| C# | 🔄 | ✅ | ✅ |
| Rust | 🔄 | ✅ | ✅ |
| Swift | 🔄 | ✅ | ✅ |
| Kotlin | 🔄 | ✅ | ✅ |

✅ Fully implemented | ⚠️ Partial support | 🔄 In development

## Performance

- **Small PR (<100 lines)**: <30 seconds
- **Medium PR (100-500 lines)**: <2 minutes
- **Large PR (500+ lines)**: <5 minutes

## Security

- Code is analyzed in memory only
- No permanent storage of source code
- Ephemeral processing
- No AI training on customer code
- SOC 2 Type II compliant architecture

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- Documentation: https://docs.your-domain.com
- Issues: https://github.com/your-org/ai-code-review/issues
- Email: support@your-domain.com

## Roadmap

### Q1 2025
- ✅ MVP Launch
- ✅ GitHub integration
- ✅ 10+ language support

### Q2 2025
- [ ] IDE extensions (VS Code, JetBrains)
- [ ] GitLab integration
- [ ] Test generation

### Q3 2025
- [ ] CI/CD integrations
- [ ] Documentation generation
- [ ] Advanced team features

### Q4 2025
- [ ] Self-hosted option
- [ ] Enterprise features
- [ ] API marketplace

---

**Built with ❤️ by the AI Code Review Team**
