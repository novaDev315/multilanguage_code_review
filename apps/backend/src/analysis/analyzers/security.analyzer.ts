import { Injectable } from '@nestjs/common';
import { CodeIssue, IssueSeverity, IssueCategory } from '../types/analysis.types';

interface SecurityPattern {
  pattern: RegExp;
  message: string;
  severity: IssueSeverity;
  category: IssueCategory;
  ruleId: string;
  languages?: string[];
}

@Injectable()
export class SecurityAnalyzer {
  private securityPatterns: SecurityPattern[] = [
    // SQL Injection
    {
      pattern: /exec\s*\(\s*["'].*?(SELECT|INSERT|UPDATE|DELETE).*?["']\s*\+/gi,
      message: 'Potential SQL injection via string concatenation',
      severity: IssueSeverity.CRITICAL,
      category: IssueCategory.SECURITY,
      ruleId: 'sql-injection',
    },
    {
      pattern: /execute\s*\(\s*["'].*?(SELECT|INSERT|UPDATE|DELETE).*?["']\s*%/gi,
      message: 'Potential SQL injection via string formatting',
      severity: IssueSeverity.CRITICAL,
      category: IssueCategory.SECURITY,
      ruleId: 'sql-injection',
      languages: ['python'],
    },

    // XSS
    {
      pattern: /dangerouslySetInnerHTML|innerHTML\s*=/gi,
      message: 'Potential XSS vulnerability. Sanitize user input.',
      severity: IssueSeverity.HIGH,
      category: IssueCategory.SECURITY,
      ruleId: 'xss-vulnerability',
      languages: ['javascript', 'typescript'],
    },
    {
      pattern: /eval\s*\(/gi,
      message: 'Use of eval() is dangerous and can lead to code injection',
      severity: IssueSeverity.CRITICAL,
      category: IssueCategory.SECURITY,
      ruleId: 'dangerous-eval',
    },

    // Command Injection
    {
      pattern: /exec\s*\(|system\s*\(|shell_exec\s*\(/gi,
      message: 'Potential command injection. Validate and sanitize input.',
      severity: IssueSeverity.CRITICAL,
      category: IssueCategory.SECURITY,
      ruleId: 'command-injection',
    },

    // Hardcoded Secrets
    {
      pattern: /(?:password|passwd|pwd|secret|api[_-]?key|private[_-]?key|token)\s*=\s*["'][^"']+["']/gi,
      message: 'Hardcoded secret detected. Use environment variables.',
      severity: IssueSeverity.CRITICAL,
      category: IssueCategory.SECURITY,
      ruleId: 'hardcoded-secret',
    },

    // Insecure Cryptography
    {
      pattern: /md5|sha1(?!SHA256|SHA512)/gi,
      message: 'Weak cryptographic algorithm. Use SHA-256 or stronger.',
      severity: IssueSeverity.HIGH,
      category: IssueCategory.SECURITY,
      ruleId: 'weak-crypto',
    },

    // Path Traversal
    {
      pattern: /\.\.\/|\.\.\\|path\.join\s*\([^)]*\.\./gi,
      message: 'Potential path traversal vulnerability',
      severity: IssueSeverity.HIGH,
      category: IssueCategory.SECURITY,
      ruleId: 'path-traversal',
    },

    // Insecure Randomness
    {
      pattern: /Math\.random\(\)/gi,
      message: 'Math.random() is not cryptographically secure. Use crypto.randomBytes().',
      severity: IssueSeverity.MEDIUM,
      category: IssueCategory.SECURITY,
      ruleId: 'insecure-random',
      languages: ['javascript', 'typescript'],
    },

    // CSRF
    {
      pattern: /@(Post|Put|Delete|Patch)\s*\([^)]*\)\s*(?!.*@UseGuards)/gi,
      message: 'Missing CSRF protection for state-changing endpoint',
      severity: IssueSeverity.HIGH,
      category: IssueCategory.SECURITY,
      ruleId: 'missing-csrf',
      languages: ['typescript'],
    },

    // Insecure Deserialization
    {
      pattern: /JSON\.parse\s*\(\s*req\./gi,
      message: 'Unsafe deserialization of user input. Validate before parsing.',
      severity: IssueSeverity.HIGH,
      category: IssueCategory.SECURITY,
      ruleId: 'unsafe-deserialization',
    },

    // SSRF
    {
      pattern: /fetch\s*\(\s*req\.|axios\s*\.\s*get\s*\(\s*req\./gi,
      message: 'Potential SSRF vulnerability. Validate URLs before making requests.',
      severity: IssueSeverity.HIGH,
      category: IssueCategory.SECURITY,
      ruleId: 'ssrf-vulnerability',
    },

    // Open Redirect
    {
      pattern: /redirect\s*\(\s*req\.|location\s*=\s*req\./gi,
      message: 'Potential open redirect vulnerability. Validate redirect URLs.',
      severity: IssueSeverity.MEDIUM,
      category: IssueCategory.SECURITY,
      ruleId: 'open-redirect',
    },

    // Regex DoS
    {
      pattern: /new\s+RegExp\s*\([^)]*\+|RegExp\s*\([^)]*req\./gi,
      message: 'Potential ReDoS vulnerability. Avoid user-controlled regex.',
      severity: IssueSeverity.MEDIUM,
      category: IssueCategory.SECURITY,
      ruleId: 'regex-dos',
    },
  ];

  analyze(sourceCode: string, filePath: string, language: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      for (const pattern of this.securityPatterns) {
        // Skip if pattern is language-specific and doesn't match
        if (pattern.languages && !pattern.languages.includes(language)) {
          continue;
        }

        if (pattern.pattern.test(line)) {
          issues.push({
            filePath,
            lineNumber,
            severity: pattern.severity,
            category: pattern.category,
            message: pattern.message,
            ruleId: pattern.ruleId,
            confidence: 0.75,
            language,
          });

          // Reset regex lastIndex
          pattern.pattern.lastIndex = 0;
        }
      }
    }

    return issues;
  }

  async analyzeOwaspTop10(sourceCode: string, filePath: string, language: string): Promise<{
    issues: CodeIssue[];
    owaspCategories: string[];
  }> {
    const issues = this.analyze(sourceCode, filePath, language);

    const owaspCategories = Array.from(
      new Set(
        issues
          .map((issue) => {
            switch (issue.ruleId) {
              case 'sql-injection':
                return 'A03:2021 - Injection';
              case 'xss-vulnerability':
                return 'A03:2021 - Injection';
              case 'hardcoded-secret':
                return 'A07:2021 - Identification and Authentication Failures';
              case 'weak-crypto':
                return 'A02:2021 - Cryptographic Failures';
              case 'insecure-random':
                return 'A02:2021 - Cryptographic Failures';
              case 'missing-csrf':
                return 'A01:2021 - Broken Access Control';
              case 'unsafe-deserialization':
                return 'A08:2021 - Software and Data Integrity Failures';
              case 'ssrf-vulnerability':
                return 'A10:2021 - Server-Side Request Forgery';
              default:
                return null;
            }
          })
          .filter(Boolean),
      ),
    );

    return {
      issues,
      owaspCategories,
    };
  }
}
