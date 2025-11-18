import { Injectable } from '@nestjs/common';
import { BaseAnalyzer, AnalyzerResult } from './base.analyzer';
import { IssueSeverity, IssueCategory, CodeIssue } from '../types/analysis.types';

/**
 * Multi-language analyzer for languages without Tree-sitter parsers
 * Supports: PHP, C#, Rust, Swift, Kotlin
 */
@Injectable()
export class MultiLanguageAnalyzer extends BaseAnalyzer {
  async analyze(sourceCode: string, filePath: string): Promise<AnalyzerResult> {
    const issues: CodeIssue[] = [];
    const extension = filePath.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'php':
        issues.push(...this.analyzePHP(sourceCode, filePath));
        break;
      case 'cs':
        issues.push(...this.analyzeCSharp(sourceCode, filePath));
        break;
      case 'rs':
        issues.push(...this.analyzeRust(sourceCode, filePath));
        break;
      case 'swift':
        issues.push(...this.analyzeSwift(sourceCode, filePath));
        break;
      case 'kt':
        issues.push(...this.analyzeKotlin(sourceCode, filePath));
        break;
    }

    return { issues };
  }

  private analyzePHP(sourceCode: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // SQL injection
      if (line.includes('mysql_query') && line.includes('$_')) {
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.CRITICAL,
            IssueCategory.SECURITY,
            'SQL injection vulnerability. Use prepared statements.',
            'php-sql-injection',
            'Use PDO with prepared statements or mysqli_prepare()',
          ),
        );
      }

      // eval() usage
      if (line.includes('eval(')) {
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.CRITICAL,
            IssueCategory.SECURITY,
            'Use of eval() is extremely dangerous. Avoid if possible.',
            'php-eval',
            'Refactor code to avoid eval() or strictly validate input',
          ),
        );
      }

      // Register globals
      if (line.includes('register_globals')) {
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.CRITICAL,
            IssueCategory.SECURITY,
            'register_globals is deprecated and creates security vulnerabilities.',
            'php-register-globals',
            'Remove register_globals and use $_GET, $_POST explicitly',
          ),
        );
      }

      // Weak comparison
      if (line.match(/==\s*['"]/) && !line.includes('===')) {
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.MEDIUM,
            IssueCategory.BUG,
            'Weak comparison (==) can lead to type juggling issues. Use === instead.',
            'php-weak-comparison',
            'Replace == with === for strict comparison',
          ),
        );
      }
    }

    return issues;
  }

  private analyzeCSharp(sourceCode: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // SQL injection
      if (line.includes('SqlCommand') && line.includes('+') && line.includes('"')) {
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.CRITICAL,
            IssueCategory.SECURITY,
            'SQL injection via string concatenation. Use parameterized queries.',
            'cs-sql-injection',
            'Use SqlParameter to pass parameters safely',
          ),
        );
      }

      // Dispose not called
      if (line.includes('new ') && (line.includes('Stream') || line.includes('SqlConnection')) && !line.includes('using')) {
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.HIGH,
            IssueCategory.MEMORY,
            'IDisposable object not in using statement. Resource leak possible.',
            'cs-dispose',
            'Wrap in using statement: using (var obj = new ...)',
          ),
        );
      }

      // Empty catch
      if (line.trim() === 'catch' || line.match(/catch\s*\([^)]*\)\s*\{\s*\}/)) {
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.HIGH,
            IssueCategory.ERROR_HANDLING,
            'Empty catch block. Exceptions should be logged or handled.',
            'cs-empty-catch',
            'Add logging or proper exception handling',
          ),
        );
      }
    }

    return issues;
  }

  private analyzeRust(sourceCode: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // unwrap() usage
      if (line.includes('.unwrap()')) {
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.MEDIUM,
            IssueCategory.ERROR_HANDLING,
            'unwrap() will panic if value is None/Err. Consider using match or ?.',
            'rust-unwrap',
            'Use match, if let, or ? operator for proper error handling',
          ),
        );
      }

      // expect() in production
      if (line.includes('.expect(')) {
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.LOW,
            IssueCategory.ERROR_HANDLING,
            'expect() will panic. Consider proper error propagation.',
            'rust-expect',
            'Use ? operator or match for recoverable errors',
          ),
        );
      }

      // clone() overuse
      if (line.split('.clone()').length > 2) {
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.LOW,
            IssueCategory.PERFORMANCE,
            'Multiple clone() calls. Consider using references or restructuring.',
            'rust-clone',
            'Use references (&) or restructure to avoid unnecessary clones',
          ),
        );
      }
    }

    return issues;
  }

  private analyzeSwift(sourceCode: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Force unwrapping
      if (line.includes('!') && !line.includes('!=')) {
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.MEDIUM,
            IssueCategory.BUG,
            'Force unwrapping (!) can crash if value is nil. Use optional binding.',
            'swift-force-unwrap',
            'Use if let, guard let, or optional chaining (?.)',
          ),
        );
      }

      // Strong reference cycles
      if (line.includes('self.') && !line.includes('[weak self]') && !line.includes('[unowned self]')) {
        const context = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
        if (context.includes('{') && context.includes('in')) {
          issues.push(
            this.createIssue(
              filePath,
              lineNumber,
              IssueSeverity.MEDIUM,
              IssueCategory.MEMORY,
              'Potential retain cycle. Use [weak self] or [unowned self] in closures.',
              'swift-retain-cycle',
              'Add [weak self] to closure capture list',
            ),
          );
        }
      }
    }

    return issues;
  }

  private analyzeKotlin(sourceCode: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Force not-null assertion
      if (line.includes('!!')) {
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.MEDIUM,
            IssueCategory.BUG,
            'Force not-null assertion (!!) can throw NPE. Use safe call (?.) or let.',
            'kotlin-force-not-null',
            'Use safe call (?.) or let { } for null safety',
          ),
        );
      }

      // GlobalScope.launch
      if (line.includes('GlobalScope.launch')) {
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.MEDIUM,
            IssueCategory.BEST_PRACTICE,
            'GlobalScope.launch can lead to coroutine leaks. Use structured concurrency.',
            'kotlin-global-scope',
            'Use lifecycleScope, viewModelScope, or define custom CoroutineScope',
          ),
        );
      }

      // Empty catch
      if (line.includes('catch') && line.includes('{}')) {
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.HIGH,
            IssueCategory.ERROR_HANDLING,
            'Empty catch block. Exceptions should be logged or handled.',
            'kotlin-empty-catch',
            'Add proper exception handling or logging',
          ),
        );
      }
    }

    return issues;
  }
}
