# Deployment Guide

This guide covers deploying the AI Code Review Tool to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [GitHub App Configuration](#github-app-configuration)
7. [Monitoring & Logging](#monitoring--logging)

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Domain name with SSL certificate
- GitHub App credentials
- OpenAI or Anthropic API key

## Environment Setup

### Backend Environment Variables

Create a `.env` file in `apps/backend`:

```bash
# Application
NODE_ENV=production
PORT=3001
API_PREFIX=api/v1

# Database
DATABASE_URL=postgresql://user:password@host:5432/ai_code_review

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d

# OpenAI (choose one)
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4-turbo-preview

# OR Anthropic
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# GitHub
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_WEBHOOK_SECRET=your-webhook-secret
GITHUB_APP_ID=your-app-id
GITHUB_PRIVATE_KEY_PATH=/app/config/github-private-key.pem

# Monitoring (Optional)
SENTRY_DSN=your-sentry-dsn
DATADOG_API_KEY=your-datadog-key
```

### Frontend Environment Variables

Create `.env.production` in `apps/frontend`:

```bash
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

## Database Setup

### 1. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE ai_code_review;

# Create user (optional)
CREATE USER ai_code_review_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE ai_code_review TO ai_code_review_user;
```

### 2. Run Migrations

```bash
cd apps/backend
npm run generate
npm run migrate
```

## Backend Deployment

### Option 1: Docker (Recommended)

1. **Build Docker Image**

```bash
docker build -t ai-code-review-backend -f apps/backend/Dockerfile .
```

2. **Run Container**

```bash
docker run -d \
  --name ai-code-review-backend \
  -p 3001:3001 \
  --env-file apps/backend/.env \
  ai-code-review-backend
```

### Option 2: PM2

1. **Install PM2**

```bash
npm install -g pm2
```

2. **Build Application**

```bash
cd apps/backend
npm run build
```

3. **Start with PM2**

```bash
pm2 start dist/main.js --name ai-code-review-backend
pm2 save
pm2 startup
```

### Option 3: AWS ECS/Fargate

See [AWS Deployment Guide](./AWS_DEPLOYMENT.md)

### Option 4: Kubernetes

See [Kubernetes Deployment Guide](./K8S_DEPLOYMENT.md)

## Frontend Deployment

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**

```bash
npm install -g vercel
```

2. **Deploy**

```bash
cd apps/frontend
vercel --prod
```

3. **Configure Environment Variables**

In Vercel dashboard, add:
- `NEXT_PUBLIC_API_URL=https://api.your-domain.com`

### Option 2: Docker

```bash
# Build
docker build -t ai-code-review-frontend -f apps/frontend/Dockerfile .

# Run
docker run -d \
  --name ai-code-review-frontend \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://api.your-domain.com \
  ai-code-review-frontend
```

### Option 3: Static Export

```bash
cd apps/frontend
npm run build
# Deploy 'out' directory to any static hosting
```

## GitHub App Configuration

### 1. Create GitHub App

1. Go to https://github.com/settings/apps/new
2. Fill in details:
   - **GitHub App name**: AI Code Review
   - **Homepage URL**: https://your-domain.com
   - **Webhook URL**: https://api.your-domain.com/api/v1/webhooks/github
   - **Webhook secret**: Generate and save

3. **Permissions**:
   - Pull requests: Read & Write
   - Contents: Read
   - Checks: Read & Write
   - Metadata: Read-only

4. **Subscribe to events**:
   - Pull request
   - Push

5. **Where can this GitHub App be installed?**:
   - Any account

### 2. Generate Private Key

1. In your GitHub App settings, generate a private key
2. Download the `.pem` file
3. Store securely on your server at the path specified in `GITHUB_PRIVATE_KEY_PATH`

### 3. Install App

1. Install the GitHub App on your repositories
2. Note the installation ID

## Reverse Proxy (Nginx)

### Backend Configuration

```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Frontend Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL Configuration

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d api.your-domain.com
```

## Monitoring & Logging

### Sentry (Error Tracking)

1. Create Sentry project
2. Add DSN to environment variables
3. Errors will be automatically reported

### Datadog (APM)

1. Install Datadog agent
2. Configure APM
3. Add API key to environment variables

### Log Management

```bash
# PM2 logs
pm2 logs ai-code-review-backend

# Docker logs
docker logs ai-code-review-backend

# System logs
journalctl -u ai-code-review
```

## Health Checks

### Backend Health Endpoint

```bash
curl https://api.your-domain.com/api/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## Scaling Considerations

### Horizontal Scaling

- Run multiple backend instances behind a load balancer
- Use Redis for session storage and caching
- Consider using AWS SQS or RabbitMQ for job queue

### Database Scaling

- Enable connection pooling
- Consider read replicas for analytics queries
- Regular backups and monitoring

### Caching Strategy

- Cache analysis results by code hash
- Use CDN for frontend assets
- Cache GitHub API responses

## Security Checklist

- [ ] SSL/TLS enabled
- [ ] Environment variables secured
- [ ] Database credentials rotated
- [ ] API rate limiting enabled
- [ ] CORS configured properly
- [ ] GitHub webhook signature verification
- [ ] Code never stored permanently
- [ ] Regular security audits

## Backup Strategy

### Database Backups

```bash
# Daily automated backups
0 2 * * * pg_dump -U postgres ai_code_review > /backups/db_$(date +\%Y\%m\%d).sql
```

### Configuration Backups

- Store environment variables in secure vault (e.g., AWS Secrets Manager)
- Version control all configuration files
- Document all manual configurations

## Troubleshooting

### Backend won't start

1. Check database connection
2. Verify Redis connection
3. Check environment variables
4. Review logs for errors

### GitHub webhook not working

1. Verify webhook URL is accessible
2. Check webhook secret matches
3. Verify GitHub App permissions
4. Check webhook delivery logs in GitHub

### High memory usage

1. Implement analysis result caching
2. Limit concurrent analyses
3. Optimize database queries
4. Consider horizontal scaling

## Support

For deployment issues:
- GitHub Issues: https://github.com/your-org/ai-code-review/issues
- Email: support@your-domain.com
- Documentation: https://docs.your-domain.com
