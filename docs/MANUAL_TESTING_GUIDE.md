# Manual Testing Guide - Multi-Language AI Code Review Tool

**Version**: 1.0.0
**Last Updated**: November 2025
**Testing Time Estimate**: 4-6 hours for complete testing

---

## Table of Contents

1. [Prerequisites & Setup](#prerequisites--setup)
2. [Feature Overview](#feature-overview)
3. [Quick Start Guide](#quick-start-guide)
4. [Test Scenarios by Feature](#test-scenarios-by-feature)
5. [Use Case Scenarios](#use-case-scenarios)
6. [Integration Testing](#integration-testing)
7. [Performance Testing](#performance-testing)
8. [Security Testing](#security-testing)
9. [Edge Cases & Error Handling](#edge-cases--error-handling)
10. [Test Checklist](#master-test-checklist)

---

## Prerequisites & Setup

### Environment Requirements

**Before Testing:**
- [ ] Node.js 20+ installed
- [ ] PostgreSQL 15+ running
- [ ] Redis 7+ running
- [ ] Git installed
- [ ] GitHub/GitLab account with repository access
- [ ] OpenAI API key OR Anthropic API key

### Setup Steps

#### 1. Environment Configuration

```bash
# Navigate to backend
cd apps/backend

# Create .env file with the following variables:
DATABASE_URL="postgresql://user:password@localhost:5432/code_review_db"
REDIS_HOST="localhost"
REDIS_PORT=6379
JWT_SECRET="your-super-secret-jwt-key-change-this"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-this"

# AI Provider (at least one required)
OPENAI_API_KEY="sk-..."
# OR
ANTHROPIC_API_KEY="sk-ant-..."

# GitHub Integration (optional for full testing)
GITHUB_TOKEN="ghp_..."
GITHUB_WEBHOOK_SECRET="your-webhook-secret"

# GitLab Integration (optional)
GITLAB_TOKEN="glpat-..."
GITLAB_WEBHOOK_SECRET="your-webhook-secret"
```

#### 2. Database Setup

```bash
# From apps/backend directory
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed    # Optional: seed with test data
```

#### 3. Start Services

```bash
# Terminal 1 - Backend
cd apps/backend
npm run dev

# Terminal 2 - Frontend
cd apps/frontend
npm run dev

# Terminal 3 - Redis (if not running as service)
redis-server

# Terminal 4 - PostgreSQL (if not running as service)
# Start according to your system
```

#### 4. Verify Services Running

- [ ] Backend API: http://localhost:3000
- [ ] Frontend: http://localhost:3001
- [ ] PostgreSQL: localhost:5432
- [ ] Redis: localhost:6379

---

## Feature Overview

### 1. Multi-Language Code Analysis
**What it does**: Analyzes code in 11+ programming languages for bugs, style issues, and best practices.

**Supported Languages**: JavaScript, TypeScript, Python, Java, Go, Ruby, PHP, C#, Rust, Swift, Kotlin

**How it works**: Uses Tree-sitter for AST parsing (6 languages) and pattern-based regex analysis (5 languages).

---

### 2. AI-Powered Bug Detection
**What it does**: Uses GPT-4 or Claude AI to detect logic errors, null pointers, race conditions, and memory leaks.

**How it works**: Sends code snippets to AI with context-aware prompts, receives structured analysis with severity and confidence scores.

---

### 3. Security Vulnerability Scanning
**What it does**: Detects OWASP Top 10 vulnerabilities including SQL injection, XSS, CSRF, and hardcoded secrets.

**Coverage**: 14 security patterns across all languages.

---

### 4. Performance Optimization
**What it does**: Identifies performance bottlenecks like nested loops (O(n³)), N+1 queries, memory leaks, and inefficient algorithms.

**Metrics**: Cyclomatic complexity, algorithm complexity analysis.

---

### 5. GitHub/GitLab Integration
**What it does**: Automatically analyzes pull requests and posts review comments inline.

**Features**: Webhook handling, status checks, inline PR comments.

---

### 6. Custom Rules Engine
**What it does**: Allows organizations to create custom coding standards with regex patterns.

**Management**: Full CRUD operations via API and UI.

---

### 7. Analytics Dashboard
**What it does**: Displays code quality metrics, trends, and statistics.

**Metrics**: Total PRs, issues found, critical issues, average issues per PR.

---

### 8. Authentication System
**What it does**: Secures the application with JWT authentication and GitHub OAuth.

**Features**: Registration, login, token refresh, protected routes.

---

## Quick Start Guide

### Getting Started in 5 Minutes

#### Step 1: Register a User Account

1. Open browser to http://localhost:3001
2. Click "Sign Up" or navigate to `/auth/register`
3. Fill in registration form:
   - Email: test@example.com
   - Password: SecurePass123!
   - Name: Test User
4. Click "Register"
5. **Expected**: Receive JWT tokens and redirect to dashboard

**API Test Alternative:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "name": "Test User"
  }'
```

---

#### Step 2: Create an Organization

```bash
curl -X POST http://localhost:3000/organizations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Test Organization",
    "planType": "pro"
  }'
```

**Expected Response:**
```json
{
  "id": "uuid-here",
  "name": "Test Organization",
  "planType": "pro"
}
```

---

#### Step 3: Add a Repository

```bash
curl -X POST http://localhost:3000/repositories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "test-repo",
    "fullName": "user/test-repo",
    "platform": "github",
    "platformRepoId": 123456,
    "organizationId": "YOUR_ORG_ID"
  }'
```

---

#### Step 4: Analyze Your First PR

```bash
curl -X POST http://localhost:3000/analysis/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "repositoryId": "YOUR_REPO_ID",
    "prNumber": 1,
    "baseBranch": "main",
    "headBranch": "feature/test",
    "files": [
      {
        "filePath": "src/index.js",
        "status": "modified",
        "additions": 10,
        "deletions": 2,
        "content": "const user = null;\nuser.name = \"test\";\nconsole.log(\"Debug info\");"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "pullRequestId": "uuid",
  "issues": [
    {
      "filePath": "src/index.js",
      "lineNumber": 2,
      "severity": "critical",
      "category": "bug",
      "message": "Potential null pointer error",
      "fixSuggestion": "Add null check before accessing properties"
    },
    {
      "filePath": "src/index.js",
      "lineNumber": 3,
      "severity": "low",
      "category": "style",
      "message": "Remove console.log in production code"
    }
  ],
  "summary": {
    "totalIssues": 2,
    "critical": 1,
    "high": 0,
    "medium": 0,
    "low": 1
  }
}
```

---

## Test Scenarios by Feature

### 🧪 TEST 1: Multi-Language Code Analysis

#### Test Case 1.1: JavaScript/TypeScript Analysis

**Objective**: Verify JavaScript analyzer detects common issues

**Test Files to Create:**

**test-js.js:**
```javascript
// Null pointer error
const user = null;
user.name = 'test';

// Unhandled promise
fetch('/api/data');

// Console statement
console.log('debug');

// var usage
var oldStyle = 'bad';

// Empty catch
try {
  riskyOperation();
} catch (e) {
  // empty
}

// Deep nesting
for (let i = 0; i < 10; i++) {
  for (let j = 0; j < 10; j++) {
    for (let k = 0; k < 10; k++) {
      for (let l = 0; l < 10; l++) {
        console.log('deeply nested');
      }
    }
  }
}

// Magic number
const price = amount * 1.15;
```

**Steps:**
1. Create test repository with above file
2. Submit analysis request via API (see Step 4 in Quick Start)
3. Review results

**Expected Results:**
- [ ] Detects null pointer error (line 2-3)
- [ ] Detects unhandled promise (line 6)
- [ ] Detects console.log statements
- [ ] Detects var usage instead of let/const
- [ ] Detects empty catch block
- [ ] Detects deep nesting (4 levels)
- [ ] Detects magic number (1.15)
- [ ] All issues have severity (critical/high/medium/low)
- [ ] All issues have category (bug/style/performance)
- [ ] Fix suggestions provided

---

#### Test Case 1.2: Python Analysis

**test-python.py:**
```python
import pickle

# Bare except
try:
    risky_operation()
except:
    pass

# Mutable default
def add_item(item, items=[]):
    items.append(item)
    return items

# Global variable
global_state = {}

# SQL injection
query = "SELECT * FROM users WHERE id = " + user_input

# Hardcoded secret
API_KEY = "sk-1234567890abcdef"

# Unsafe pickle
data = pickle.loads(user_data)
```

**Expected Results:**
- [ ] Detects bare except clause
- [ ] Detects mutable default argument
- [ ] Detects global variable usage
- [ ] Detects SQL injection vulnerability (CRITICAL)
- [ ] Detects hardcoded secret (CRITICAL)
- [ ] Detects unsafe pickle usage (HIGH)

---

#### Test Case 1.3: Java Analysis

**Test.java:**
```java
public class Test {
    public void processData(String data) {
        // Null pointer potential
        String value = getValue();
        int length = value.length();

        // Resource leak
        FileInputStream fis = new FileInputStream("file.txt");
        fis.read();

        // Empty catch
        try {
            riskyOp();
        } catch (Exception e) {
        }

        // String comparison with ==
        String s1 = "test";
        if (s1 == "test") {
            System.out.println("equal");
        }
    }
}
```

**Expected Results:**
- [ ] Detects potential NPE
- [ ] Detects resource leak (no try-with-resources)
- [ ] Detects empty catch block
- [ ] Detects string comparison with ==

---

#### Test Case 1.4: Go Analysis

**test.go:**
```go
package main

func processData() {
    // Unchecked error
    data, err := fetchData()
    process(data)

    // Goroutine leak
    go func() {
        for {
            work()
        }
    }()

    // Defer in loop
    for i := 0; i < 10; i++ {
        file, _ := os.Open("file.txt")
        defer file.Close()
    }
}
```

**Expected Results:**
- [ ] Detects unchecked error
- [ ] Detects potential goroutine leak
- [ ] Detects defer in loop

---

#### Test Case 1.5: Ruby Analysis

**test.rb:**
```ruby
class UserController
  def create
    # Mass assignment vulnerability
    User.create(params[:user])

    # SQL injection
    User.where("name = '#{params[:name]}'")

    # Command injection
    system("ls #{user_input}")

    # Bare rescue
    begin
      risky_operation
    rescue
    end
  end
end
```

**Expected Results:**
- [ ] Detects mass assignment (CRITICAL)
- [ ] Detects SQL injection (CRITICAL)
- [ ] Detects command injection (CRITICAL)
- [ ] Detects bare rescue

---

#### Test Case 1.6: Multi-Language (PHP, C#, Rust, Swift, Kotlin)

**test.php:**
```php
<?php
// SQL injection
$query = "SELECT * FROM users WHERE id = " . $_GET['id'];
mysql_query($query);

// eval usage
eval($_POST['code']);

// Weak comparison
if ($_GET['id'] == $admin_id) {
    grant_access();
}
?>
```

**Expected Results:**
- [ ] Detects SQL injection
- [ ] Detects eval() usage
- [ ] Detects weak comparison (== vs ===)

---

### 🧪 TEST 2: AI-Powered Analysis

#### Test Case 2.1: GPT-4 Integration

**Objective**: Verify GPT-4 AI analysis works correctly

**Prerequisites:**
- OPENAI_API_KEY set in .env
- OpenAI account with credits

**Test Code (complex-logic.js):**
```javascript
function calculateDiscount(user, items) {
  let total = 0;
  for (let item of items) {
    total += item.price;
  }

  // Logic error: discount never applied
  let discount = 0;
  if (user.isPremium) {
    discount = 0.1;
  } else if (user.isVIP) {
    discount = 0.2;
  }

  return total; // BUG: Should return total * (1 - discount)
}
```

**Steps:**
1. Submit file with >50 lines OR with critical issues (triggers AI)
2. Wait for AI analysis (may take 10-30 seconds)
3. Review AI-generated issues

**Expected Results:**
- [ ] AI detects logic error (discount calculated but not applied)
- [ ] Issue has confidence score (0.0-1.0)
- [ ] Fix suggestion explains the bug
- [ ] Response time < 30 seconds
- [ ] Cost logged (check console for API call)

**Verification:**
```bash
# Check backend logs for:
# "AI analysis triggered for file: complex-logic.js"
# "OpenAI analysis completed in XXXms"
```

---

#### Test Case 2.2: Claude Fallback

**Objective**: Verify Claude works when OpenAI is unavailable

**Steps:**
1. Remove OPENAI_API_KEY from .env
2. Set ANTHROPIC_API_KEY
3. Restart backend
4. Submit same test file
5. Verify Claude is used

**Expected Results:**
- [ ] Backend uses Claude (check logs: "Using Anthropic for AI analysis")
- [ ] Same quality of analysis
- [ ] Similar response time

---

#### Test Case 2.3: AI Analysis Optimization

**Objective**: Verify AI is NOT called for small files (cost optimization)

**Test:**
1. Submit file with <50 lines and NO critical issues
2. Check backend logs

**Expected Results:**
- [ ] AI analysis NOT triggered (cost saving)
- [ ] Only static analyzers run
- [ ] Response time < 5 seconds

---

### 🧪 TEST 3: Security Vulnerability Scanning

#### Test Case 3.1: OWASP Top 10 Detection

**Create security-test.js:**
```javascript
// A03: Injection - SQL Injection
const query = "SELECT * FROM users WHERE id = " + userId;
db.execute(query);

// A03: Injection - XSS
document.getElementById('output').innerHTML = userInput;
element.dangerouslySetInnerHTML = { __html: userContent };

// A03: Injection - Command Injection
exec("ls " + userInput);
eval(untrustedCode);

// A02: Cryptographic Failures
const hash = crypto.createHash('md5').update(password);
const hash2 = crypto.createHash('sha1').update(data);

// A07: Auth Failures - Hardcoded Secrets
const API_KEY = "sk-1234567890abcdef";
const password = "admin123";
const token = "ghp_xxxxxxxxxxxx";

// A08: Data Integrity - Unsafe Deserialization
const obj = JSON.parse(untrustedInput);
const data = pickle.loads(userData);

// Path Traversal
const filePath = "/var/data/" + userInput;
fs.readFile(filePath);

// CSRF
app.post('/transfer', (req, res) => {
  // No CSRF token check
  transferMoney(req.body.amount);
});

// Insecure Random
Math.random(); // For crypto purposes

// SSRF
fetch(userProvidedURL);

// Open Redirect
res.redirect(req.query.url);

// ReDoS
const regex = new RegExp('(a+)+b');
regex.test(userInput);
```

**Expected Results:**
- [ ] SQL injection detected (CRITICAL)
- [ ] XSS vulnerabilities detected (HIGH) - 2 instances
- [ ] Command injection detected (CRITICAL) - 2 instances
- [ ] Weak crypto detected (MEDIUM) - 2 instances
- [ ] Hardcoded secrets detected (CRITICAL) - 3 instances
- [ ] Path traversal detected (HIGH)
- [ ] CSRF vulnerability detected (HIGH)
- [ ] Insecure random detected (MEDIUM)
- [ ] SSRF detected (HIGH)
- [ ] Open redirect detected (MEDIUM)
- [ ] ReDoS detected (MEDIUM)
- [ ] All security issues flagged with category: "security"

---

### 🧪 TEST 4: Performance Analysis

#### Test Case 4.1: Nested Loops Detection

**performance-test.js:**
```javascript
// O(n^4) - Should be flagged
function badAlgorithm(data) {
  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data.length; j++) {
      for (let k = 0; k < data.length; k++) {
        for (let l = 0; l < data.length; l++) {
          process(data[i], data[j], data[k], data[l]);
        }
      }
      }
    }
  }
}

// N+1 Query Problem
async function getUsers() {
  const users = await db.query('SELECT * FROM users');
  for (let user of users) {
    // N+1 query issue
    user.posts = await db.query('SELECT * FROM posts WHERE user_id = ?', user.id);
  }
  return users;
}

// Memory Leak
class EventManager {
  constructor() {
    window.addEventListener('resize', this.handler);
    // Missing cleanup - memory leak
  }
}

// Synchronous File Read
const data = fs.readFileSync('large-file.txt'); // Blocks event loop

// Large Array Creation
const hugeArray = new Array(1000000).fill(0);
```

**Expected Results:**
- [ ] Nested loops detected (depth 4, O(n^4))
- [ ] Severity: HIGH
- [ ] Suggestion: "Use hash maps or optimize algorithm"
- [ ] N+1 query detected
- [ ] Memory leak detected (event listener without cleanup)
- [ ] Synchronous operation detected
- [ ] Large data structure flagged

---

#### Test Case 4.2: Cyclomatic Complexity

**complex-function.js:**
```javascript
function complexFunction(a, b, c, d, e) {
  if (a > 0) {
    if (b > 0) {
      if (c > 0) {
        if (d > 0) {
          if (e > 0) {
            return a + b + c + d + e;
          }
        }
      }
    }
  }

  switch (a) {
    case 1: return b;
    case 2: return c;
    case 3: return d;
    case 4: return e;
    default: return 0;
  }
}
```

**Expected Results:**
- [ ] High cyclomatic complexity detected
- [ ] Metrics returned with complexity score
- [ ] Suggestion to refactor provided

---

### 🧪 TEST 5: GitHub Integration

#### Test Case 5.1: GitHub Webhook Processing

**Prerequisites:**
- GitHub repository with admin access
- GitHub App or Personal Access Token configured
- Webhook secret configured

**Setup GitHub Webhook:**
1. Go to Repository → Settings → Webhooks
2. Add webhook: `http://YOUR_SERVER/github/webhook`
3. Content type: `application/json`
4. Secret: Your GITHUB_WEBHOOK_SECRET
5. Events: "Pull requests", "Pull request reviews"

**Test Steps:**
1. Create a new branch in your GitHub repo
2. Add test file with intentional bugs:

**buggy-code.js:**
```javascript
const user = null;
user.name = 'test';
console.log('debug');
eval(userInput);
```

3. Create Pull Request from branch to main
4. Monitor backend logs

**Expected Results:**
- [ ] Webhook received and logged
- [ ] PR analyzed automatically
- [ ] Comments posted on PR with issues found
- [ ] Status check updated (pending → success/failure)
- [ ] Issues visible in GitHub PR interface
- [ ] Each issue has:
  - File path
  - Line number
  - Severity badge
  - Description
  - Fix suggestion

**Verification:**
```bash
# Check backend logs:
# "Received GitHub webhook: pull_request.opened"
# "Processing PR #X for repo owner/repo"
# "Found X issues in PR"
# "Posted X comments to GitHub"
```

---

#### Test Case 5.2: GitHub Status Checks

**Expected Results:**
- [ ] Status check appears on PR
- [ ] Status: "Code Review - Analyzing..." (pending)
- [ ] Status: "Code Review - Found X issues" (completed)
- [ ] Click on status → Links to details
- [ ] Critical issues = failed check
- [ ] No critical issues = passed check

---

### 🧪 TEST 6: GitLab Integration

#### Test Case 6.1: GitLab Merge Request Analysis

**Prerequisites:**
- GitLab repository
- GITLAB_TOKEN configured
- Webhook configured

**Setup:**
1. GitLab → Settings → Webhooks
2. URL: `http://YOUR_SERVER/gitlab/webhook`
3. Secret token: GITLAB_WEBHOOK_SECRET
4. Trigger: "Merge request events"

**Test:**
1. Create MR in GitLab with buggy code
2. Monitor backend

**Expected Results:**
- [ ] Webhook received
- [ ] MR analyzed
- [ ] Discussion threads created on MR
- [ ] Issues posted as MR notes

---

### 🧪 TEST 7: Custom Rules Engine

#### Test Case 7.1: Create Custom Rule via API

**Test:**
```bash
curl -X POST http://localhost:3000/rules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "organizationId": "YOUR_ORG_ID",
    "name": "No TODO Comments",
    "description": "Disallow TODO comments in production code",
    "language": "javascript",
    "pattern": "//\\s*TODO",
    "severity": "medium",
    "category": "style",
    "message": "TODO comments should be converted to tickets",
    "fixTemplate": "Create a ticket and remove this TODO",
    "enabled": true
  }'
```

**Expected Results:**
- [ ] Rule created successfully
- [ ] Returns rule ID
- [ ] Rule stored in database

---

#### Test Case 7.2: Custom Rule Detection

**Test File (with-todo.js):**
```javascript
function processData() {
  // TODO: Fix this later
  const result = compute();
  return result;
}
```

**Steps:**
1. Ensure custom rule is enabled
2. Analyze file with TODO comment
3. Verify custom rule triggered

**Expected Results:**
- [ ] Custom rule detects TODO comment
- [ ] Issue created with custom rule's severity
- [ ] Custom message displayed
- [ ] ruleId field matches custom rule ID

---

#### Test Case 7.3: Custom Rules UI

**Frontend Test:**
1. Navigate to http://localhost:3001/rules
2. View custom rules list

**Expected:**
- [ ] All rules displayed in table
- [ ] Shows: Name, Language, Severity, Status (enabled/disabled)
- [ ] Severity color-coded (critical=red, high=orange, medium=yellow, low=gray)

**Test Enable/Disable:**
1. Click toggle switch on a rule
2. Verify API call made
3. Rule status updated in UI
4. Analyze code → Rule should/shouldn't trigger

**Test Create Rule:**
1. Click "Create Rule" button
2. Fill form and submit
3. New rule appears in list

---

### 🧪 TEST 8: Analytics Dashboard

#### Test Case 8.1: Dashboard Metrics

**Setup:**
1. Analyze multiple PRs (at least 5)
2. Generate various issues (critical, high, medium, low)

**Test:**
1. Navigate to http://localhost:3001/dashboard
2. View metrics cards

**Expected Results:**
- [ ] **Total PRs** card shows correct count
- [ ] **Total Issues** card shows sum of all issues
- [ ] **Critical Issues** card shows count of critical severity
- [ ] **Average Issues/PR** calculated correctly
- [ ] All metrics update in real-time

**Test Recent PRs List:**
- [ ] Shows last 10 PRs analyzed
- [ ] Each PR shows:
  - PR number
  - Title
  - Issue count
  - Severity breakdown
  - Timestamp
- [ ] Sorted by most recent first

---

#### Test Case 8.2: Analytics API

**Test:**
```bash
curl http://localhost:3000/pull-requests/analytics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "totalPRs": 15,
  "totalIssues": 87,
  "criticalIssues": 12,
  "averageIssuesPerPR": "5.8"
}
```

---

### 🧪 TEST 9: Authentication & Authorization

#### Test Case 9.1: User Registration

**Test:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@test.com",
    "password": "SecurePass123!",
    "name": "New User"
  }'
```

**Expected Results:**
- [ ] Status: 201 Created
- [ ] Returns: accessToken, refreshToken, user object
- [ ] User created in database
- [ ] Password hashed (not stored in plain text)
- [ ] JWT tokens valid

**Negative Tests:**
- [ ] Duplicate email → 409 Conflict
- [ ] Weak password → 400 Bad Request
- [ ] Missing fields → 400 Bad Request
- [ ] Invalid email format → 400 Bad Request

---

#### Test Case 9.2: User Login

**Test:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@test.com",
    "password": "SecurePass123!"
  }'
```

**Expected Results:**
- [ ] Status: 200 OK
- [ ] Returns valid JWT tokens
- [ ] Tokens include user info

**Negative Tests:**
- [ ] Wrong password → 401 Unauthorized
- [ ] Non-existent email → 401 Unauthorized
- [ ] Missing credentials → 400 Bad Request

---

#### Test Case 9.3: Protected Routes

**Test:**
```bash
# Without token
curl http://localhost:3000/analysis/analyze

# Expected: 401 Unauthorized

# With valid token
curl http://localhost:3000/analysis/analyze \
  -H "Authorization: Bearer VALID_TOKEN"

# Expected: 200 OK or 400 (if missing body)

# With expired token
curl http://localhost:3000/analysis/analyze \
  -H "Authorization: Bearer EXPIRED_TOKEN"

# Expected: 401 Unauthorized
```

---

#### Test Case 9.4: Token Refresh

**Test:**
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

**Expected Results:**
- [ ] Returns new accessToken
- [ ] Returns new refreshToken
- [ ] Old tokens invalidated (optional, depending on implementation)

---

#### Test Case 9.5: GitHub OAuth (If Implemented)

**Test:**
1. Click "Login with GitHub" button
2. Redirect to GitHub OAuth
3. Authorize application
4. Redirect back to app

**Expected:**
- [ ] User created/logged in
- [ ] GitHub ID stored
- [ ] Avatar URL fetched
- [ ] JWT tokens issued

---

### 🧪 TEST 10: Caching & Performance

#### Test Case 10.1: Result Caching

**Test:**
1. Analyze file for first time
2. Note response time
3. Analyze SAME file again (exact same content)
4. Compare response times

**Expected Results:**
- [ ] First analysis: 5-30 seconds (includes AI)
- [ ] Second analysis: <1 second (cached)
- [ ] Both return identical results
- [ ] Backend logs: "Cache hit for file"

**Verify Cache:**
```bash
# Connect to Redis
redis-cli

# Check cache keys
KEYS analysis:*

# Get cached result
GET analysis:javascript:SOME_HASH
```

---

#### Test Case 10.2: Cache Invalidation

**Test:**
1. Analyze file (result cached)
2. Modify file content (even 1 character)
3. Analyze again

**Expected:**
- [ ] Cache miss (different MD5 hash)
- [ ] Full analysis runs
- [ ] New result cached with new key

---

#### Test Case 10.3: Batch Processing

**Test:**
1. Create PR with 50 files
2. Submit for analysis
3. Monitor processing

**Expected:**
- [ ] Files processed in batches of 10
- [ ] Parallel processing (check logs for concurrent analysis)
- [ ] Total time < (50 files × single file time)
- [ ] All files analyzed successfully

---

## Use Case Scenarios

### Use Case 1: Solo Developer Reviews Own Code

**Persona**: Michael (Solo Founder)
**Goal**: Get code review feedback without a team

**Scenario:**
1. Michael creates feature branch
2. Writes new authentication module (300 lines)
3. Opens PR to merge into main
4. System automatically analyzes
5. Receives detailed feedback within 2 minutes

**Test Steps:**
1. Create branch: `feature/auth-module`
2. Add authentication code with intentional security issues:

```javascript
// auth.js
const jwt = require('jsonwebtoken');

const SECRET_KEY = "hardcoded-secret-123"; // Security issue

function login(username, password) {
  // SQL injection vulnerability
  const query = `SELECT * FROM users WHERE username='${username}'
                 AND password='${password}'`;
  const user = db.query(query);

  if (user) {
    // Weak crypto
    const token = jwt.sign({ user }, SECRET_KEY, { expiresIn: '30d' });
    return token;
  }

  return null;
}

// Missing rate limiting - brute force vulnerability
app.post('/login', (req, res) => {
  const token = login(req.body.username, req.body.password);
  res.json({ token });
});
```

3. Create PR
4. Review analysis results

**Expected Feedback:**
- [ ] Hardcoded secret detected (CRITICAL)
- [ ] SQL injection detected (CRITICAL)
- [ ] Missing rate limiting noted
- [ ] Password stored in plain text (implied from query)
- [ ] Fix suggestions provided for each issue
- [ ] AI explains security implications

**Success Criteria:**
- Michael understands all issues
- Fixes applied successfully
- Learns security best practices

---

### Use Case 2: Team Lead Reviews Junior Developer's PR

**Persona**: Sarah (Engineering Manager)
**Goal**: Ensure code quality standards before merge

**Scenario:**
1. Junior developer submits PR with 15 files
2. System analyzes and finds 23 issues
3. Sarah reviews dashboard to prioritize
4. Identifies 5 critical issues to address first

**Test:**
1. Create PR with mix of code quality issues
2. Navigate to dashboard
3. View issue breakdown by severity
4. Filter for critical issues

**Expected:**
- [ ] Dashboard shows severity distribution pie chart
- [ ] Can filter issues by severity
- [ ] Critical issues highlighted in red
- [ ] Can export report for team discussion
- [ ] Trend shows improvement over time

---

### Use Case 3: Open Source Maintainer Reviews Contribution

**Persona**: David (OSS Maintainer)
**Goal**: Quickly review external contributor PRs

**Scenario:**
1. External contributor submits PR
2. Automated analysis runs via GitHub Action
3. Maintainer sees results in PR comments
4. Makes informed decision to merge or request changes

**Test:**
1. Set up GitHub Action integration
2. External user forks repo and submits PR
3. Monitor webhook trigger
4. Review inline comments

**Expected:**
- [ ] Analysis runs automatically on PR open
- [ ] Comments appear within 2 minutes
- [ ] Each comment on correct line of code
- [ ] Severity badges visible
- [ ] Status check shows pass/fail
- [ ] Maintainer can merge with confidence

---

### Use Case 4: Enterprise Team Enforces Custom Standards

**Persona**: Fortune 500 Engineering Team
**Goal**: Enforce company-specific coding standards

**Scenario:**
1. Team creates custom rules for proprietary framework
2. Rules detect company-specific anti-patterns
3. All PRs automatically checked against custom rules
4. Compliance ensured before production

**Test:**
1. Create custom rule: "No synchronous database calls in API routes"

```bash
curl -X POST http://localhost:3000/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "No Sync DB Calls in Routes",
    "language": "javascript",
    "pattern": "app\\.(get|post|put|delete).*db\\.querySync",
    "severity": "critical",
    "message": "Use async database calls in API routes"
  }'
```

2. Submit code that violates rule:

```javascript
app.get('/users', (req, res) => {
  const users = db.querySync('SELECT * FROM users'); // Violation
  res.json(users);
});
```

3. Verify detection

**Expected:**
- [ ] Custom rule triggers
- [ ] Marked as CRITICAL
- [ ] PR blocked until fixed
- [ ] Team compliance metrics tracked

---

### Use Case 5: Security Audit Before Production

**Persona**: Security Team
**Goal**: Scan codebase for vulnerabilities before release

**Scenario:**
1. Security team runs analysis on release branch
2. System generates comprehensive security report
3. All OWASP Top 10 issues flagged
4. Report shared with dev team for remediation

**Test:**
1. Create release branch with known vulnerabilities
2. Run batch analysis on entire codebase
3. Generate security report
4. Filter by security category

**Expected:**
- [ ] All SQL injection instances found
- [ ] All XSS vulnerabilities found
- [ ] Hardcoded secrets detected
- [ ] Weak cryptography flagged
- [ ] Report exportable as PDF/CSV
- [ ] Issue tracking integration ready

---

## Integration Testing

### Integration Test 1: End-to-End PR Flow

**Objective**: Test complete workflow from PR creation to issue resolution

**Steps:**
1. Create GitHub repository
2. Configure webhook
3. Create feature branch
4. Add buggy code
5. Open PR
6. Wait for analysis
7. Review comments
8. Fix issues
9. Push fixes
10. Verify re-analysis

**Expected:**
- [ ] Each step completes successfully
- [ ] No manual intervention needed
- [ ] All components communicate correctly
- [ ] Final PR status: Passed

---

### Integration Test 2: Multi-Service Health Check

**Test:**
```bash
curl http://localhost:3000/health/detailed
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-19T10:30:00Z",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 5
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2
    },
    "ai": {
      "status": "healthy",
      "provider": "openai"
    }
  },
  "memory": {
    "used": 150,
    "total": 8192,
    "percentage": 1.8
  }
}
```

---

## Performance Testing

### Performance Test 1: Response Time Requirements

**PRD Requirements:**
- Small PR (<100 lines): <30 seconds
- Medium PR (100-500 lines): <2 minutes
- Large PR (500+ lines): <5 minutes

**Test Small PR (50 lines, 1 file):**
1. Start timer
2. Submit analysis
3. Wait for completion
4. Record time

**Expected:**
- [ ] Total time < 30 seconds
- [ ] Average: 10-15 seconds

**Test Medium PR (300 lines, 5 files):**
- [ ] Total time < 2 minutes
- [ ] Average: 45-90 seconds

**Test Large PR (800 lines, 20 files):**
- [ ] Total time < 5 minutes
- [ ] Batch processing visible in logs

---

### Performance Test 2: Concurrent PR Analysis

**Test:**
1. Submit 5 PRs simultaneously
2. Monitor system resources
3. Verify all complete successfully

**Expected:**
- [ ] All 5 complete within acceptable time
- [ ] No timeout errors
- [ ] Memory usage stable
- [ ] CPU usage <80%
- [ ] Database connections managed properly

---

### Performance Test 3: Cache Hit Rate

**Test:**
1. Analyze 100 files
2. Re-analyze same 100 files
3. Calculate cache hit rate

**Expected:**
- [ ] Cache hit rate: >95%
- [ ] Second analysis 50x faster
- [ ] Cost savings: ~70% (AI API calls)

---

## Security Testing

### Security Test 1: Authentication Bypass Attempts

**Tests:**
1. Access protected route without token
2. Use malformed token
3. Use expired token
4. Use token with modified payload
5. SQL injection in login

**Expected:**
- [ ] All unauthorized access blocked
- [ ] 401 Unauthorized returned
- [ ] No sensitive data leaked in errors

---

### Security Test 2: Input Validation

**Test:**
```bash
# XSS attempt
curl -X POST http://localhost:3000/analysis/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "files": [{
      "filePath": "<script>alert(\"XSS\")</script>",
      "content": "test"
    }]
  }'

# SQL injection attempt
curl -X POST http://localhost:3000/auth/login \
  -d '{"email": "admin@test.com\" OR 1=1--", "password": "anything"}'
```

**Expected:**
- [ ] Inputs sanitized
- [ ] XSS prevented
- [ ] SQL injection prevented
- [ ] No code execution

---

### Security Test 3: Rate Limiting

**Test:**
```bash
# Attempt 100 requests in 10 seconds
for i in {1..100}; do
  curl http://localhost:3000/auth/login \
    -d '{"email":"test@test.com","password":"wrong"}' &
done
```

**Expected:**
- [ ] Rate limiting triggered after X requests
- [ ] 429 Too Many Requests returned
- [ ] Temporary ban implemented
- [ ] Prevents brute force attacks

---

## Edge Cases & Error Handling

### Edge Case 1: Empty File

**Test:**
Submit completely empty file for analysis

**Expected:**
- [ ] No crash
- [ ] Returns empty issues array
- [ ] Graceful handling

---

### Edge Case 2: Extremely Large File

**Test:**
Submit file with 10,000+ lines

**Expected:**
- [ ] Analysis completes (may take longer)
- [ ] OR returns warning about file size
- [ ] No timeout
- [ ] Memory usage acceptable

---

### Edge Case 3: Binary File

**Test:**
Submit .jpg or .png file

**Expected:**
- [ ] Detected as non-code file
- [ ] Skipped gracefully
- [ ] No analysis attempted

---

### Edge Case 4: Unsupported Language

**Test:**
Submit .asm (Assembly) file

**Expected:**
- [ ] Language not recognized
- [ ] Skipped or basic analysis only
- [ ] No crash

---

### Edge Case 5: Network Failures

**Test AI Provider Timeout:**
1. Disconnect internet
2. Submit file requiring AI analysis
3. Restore connection

**Expected:**
- [ ] Timeout handled gracefully
- [ ] Error logged
- [ ] Fallback to static analysis only
- [ ] User notified: "AI analysis unavailable"

---

### Edge Case 6: Database Connection Loss

**Test:**
1. Stop PostgreSQL
2. Attempt to create PR analysis
3. Restart PostgreSQL

**Expected:**
- [ ] Error caught and logged
- [ ] 500 Internal Server Error with generic message
- [ ] No sensitive data in error
- [ ] Auto-reconnect when DB available

---

### Edge Case 7: Redis Down

**Test:**
1. Stop Redis
2. Submit analysis

**Expected:**
- [ ] Cache operations fail gracefully
- [ ] Analysis still completes (no cache)
- [ ] Warning logged
- [ ] Slower but functional

---

## Master Test Checklist

### Pre-Testing Setup
- [ ] All services running (Backend, Frontend, PostgreSQL, Redis)
- [ ] Environment variables configured
- [ ] Test accounts created
- [ ] Test repositories prepared
- [ ] API keys valid and active

### Core Functionality (Must Pass)
- [ ] User registration works
- [ ] User login works
- [ ] JWT authentication works
- [ ] Protected routes secured
- [ ] JavaScript analysis works
- [ ] Python analysis works
- [ ] Java analysis works
- [ ] Go analysis works
- [ ] Ruby analysis works
- [ ] Multi-language analyzer works (PHP, C#, Rust, Swift, Kotlin)
- [ ] Security scanner detects SQL injection
- [ ] Security scanner detects XSS
- [ ] Security scanner detects hardcoded secrets
- [ ] Performance analyzer detects nested loops
- [ ] Performance analyzer detects N+1 queries
- [ ] AI analysis works (GPT-4 or Claude)
- [ ] Caching works (second analysis faster)
- [ ] Dashboard displays metrics
- [ ] Custom rules can be created
- [ ] Custom rules can be toggled
- [ ] Custom rules detect violations
- [ ] Batch processing works (10+ files)
- [ ] Issue deduplication works

### GitHub Integration
- [ ] Webhook receives PR events
- [ ] PR analyzed automatically
- [ ] Comments posted to PR
- [ ] Status checks updated
- [ ] File diff fetched correctly

### GitLab Integration
- [ ] Webhook receives MR events
- [ ] MR analyzed automatically
- [ ] Notes posted to MR

### Performance
- [ ] Small PR analyzed in <30s
- [ ] Medium PR analyzed in <2min
- [ ] Large PR analyzed in <5min
- [ ] Cache hit rate >90%
- [ ] Concurrent requests handled

### Security
- [ ] Unauthorized access blocked
- [ ] Passwords hashed
- [ ] JWT tokens expire
- [ ] Input validation works
- [ ] No SQL injection possible
- [ ] No XSS possible
- [ ] Rate limiting active

### Error Handling
- [ ] Empty files handled
- [ ] Large files handled
- [ ] Binary files skipped
- [ ] Unsupported languages skipped
- [ ] Network failures graceful
- [ ] Database errors caught
- [ ] Redis failures non-critical

### Documentation
- [ ] README accurate
- [ ] API docs match implementation
- [ ] Environment variables documented
- [ ] Deployment guide works

---

## Test Results Template

Copy this template for recording test results:

```markdown
## Test Execution Report

**Date**: ___________
**Tester**: ___________
**Environment**: Dev / Staging / Production
**Version**: ___________

### Summary
- Total Tests: ___
- Passed: ___
- Failed: ___
- Skipped: ___
- Pass Rate: ___%

### Critical Issues Found
1. ___________
2. ___________

### Failed Tests
| Test ID | Test Name | Expected | Actual | Severity |
|---------|-----------|----------|--------|----------|
| T1.1    |           |          |        | Critical |

### Performance Metrics
- Small PR average time: ___s
- Medium PR average time: ___s
- Large PR average time: ___s
- Cache hit rate: ___%

### Recommendations
1. ___________
2. ___________

### Sign-off
Ready for production: Yes / No
Tester signature: ___________
Date: ___________
```

---

## Troubleshooting Common Issues

### Issue: "AI analysis failed"
**Cause**: API key invalid or no credits
**Solution**: Check OPENAI_API_KEY or ANTHROPIC_API_KEY, verify account has credits

### Issue: "Database connection failed"
**Cause**: PostgreSQL not running or wrong credentials
**Solution**: Check DATABASE_URL, start PostgreSQL service

### Issue: "Redis connection failed"
**Cause**: Redis not running
**Solution**: Start Redis: `redis-server`

### Issue: "Webhook not receiving events"
**Cause**: Incorrect webhook URL or secret
**Solution**: Verify webhook URL is publicly accessible, check secret matches

### Issue: "Analysis taking too long"
**Cause**: Large file or AI provider slow
**Solution**: Check file size, verify AI provider status, check internet connection

### Issue: "No issues detected in obviously buggy code"
**Cause**: Analyzer not registered or language not detected
**Solution**: Check analysis.module.ts, verify file extension recognized

---

## Next Steps After Testing

1. **Document all bugs** in issue tracker
2. **Prioritize critical failures** for immediate fix
3. **Create regression tests** for found bugs
4. **Update documentation** based on findings
5. **Conduct security audit** if passing functional tests
6. **Load test** with realistic data volumes
7. **User acceptance testing** with beta users
8. **Production deployment** when all critical tests pass

---

## Contact & Support

For questions about this testing guide:
- Create issue in repository
- Contact: testing-team@example.com
- Documentation: /docs/

---

**End of Manual Testing Guide**
