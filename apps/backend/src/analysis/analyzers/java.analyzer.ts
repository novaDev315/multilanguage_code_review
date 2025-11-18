import { Injectable } from '@nestjs/common';
import { BaseAnalyzer, AnalyzerResult } from './base.analyzer';
import { TreeSitterService } from '../parsers/tree-sitter.service';
import { IssueSeverity, IssueCategory, CodeIssue } from '../types/analysis.types';
import Parser from 'tree-sitter';

@Injectable()
export class JavaAnalyzer extends BaseAnalyzer {
  constructor(private treeSitterService: TreeSitterService) {
    super();
  }

  async analyze(sourceCode: string, filePath: string): Promise<AnalyzerResult> {
    const issues: CodeIssue[] = [];

    if (!filePath.endsWith('.java')) {
      return { issues };
    }

    const parsed = this.treeSitterService.parseCode(sourceCode, 'java');
    if (!parsed) {
      return { issues };
    }

    const { tree } = parsed;

    // Check for various Java-specific issues
    issues.push(...this.checkNullPointerExceptions(tree, sourceCode, filePath));
    issues.push(...this.checkResourceLeaks(tree, sourceCode, filePath));
    issues.push(...this.checkEmptyCatchBlocks(tree, sourceCode, filePath));
    issues.push(...this.checkStringComparison(tree, sourceCode, filePath));
    issues.push(...this.checkSynchronizationIssues(tree, sourceCode, filePath));
    issues.push(...this.checkSerializationIssues(sourceCode, filePath));

    return { issues };
  }

  private checkNullPointerExceptions(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const methodInvocations = this.treeSitterService.findNodesByType(tree, 'method_invocation');

    for (const node of methodInvocations) {
      const text = this.treeSitterService.getNodeText(node, sourceCode);

      // Check for potential NPE
      if (!text.includes('!=') && !text.includes('Optional')) {
        const lineNumber = node.startPosition.row + 1;
        const lines = sourceCode.split('\n');
        const contextLines = lines.slice(Math.max(0, lineNumber - 3), lineNumber);
        const hasNullCheck = contextLines.some(line => line.includes('if') && line.includes('null'));

        if (!hasNullCheck && text.match(/\.\w+\(/)) {
          issues.push(
            this.createIssue(
              filePath,
              lineNumber,
              IssueSeverity.MEDIUM,
              IssueCategory.BUG,
              'Potential NullPointerException. Consider null checking or using Optional.',
              'null-pointer-java',
              'Add null check or use Optional.ofNullable()',
            ),
          );
        }
      }
    }

    return issues;
  }

  private checkResourceLeaks(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check for resources not in try-with-resources
    const patterns = [
      /new\s+(FileInputStream|FileOutputStream|BufferedReader|BufferedWriter)/,
      /new\s+(Socket|ServerSocket|DatagramSocket)/,
      /DriverManager\.getConnection/,
    ];

    const lines = sourceCode.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of patterns) {
        if (pattern.test(line) && !line.includes('try') && i > 0 && !lines[i - 1].includes('try')) {
          issues.push(
            this.createIssue(
              filePath,
              i + 1,
              IssueSeverity.HIGH,
              IssueCategory.MEMORY,
              'Resource not managed with try-with-resources. Potential resource leak.',
              'resource-leak',
              'Use try-with-resources statement to ensure proper resource cleanup',
            ),
          );
        }
      }
    }

    return issues;
  }

  private checkEmptyCatchBlocks(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const catchClauses = this.treeSitterService.findNodesByType(tree, 'catch_clause');

    for (const node of catchClauses) {
      const text = this.treeSitterService.getNodeText(node, sourceCode);

      if (text.match(/catch\s*\([^)]+\)\s*\{\s*\}/)) {
        const lineNumber = node.startPosition.row + 1;
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.HIGH,
            IssueCategory.ERROR_HANDLING,
            'Empty catch block. Exceptions should be logged or handled.',
            'empty-catch',
            'Add proper exception handling or at least log the exception',
          ),
        );
      }
    }

    return issues;
  }

  private checkStringComparison(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check for == with strings
    const lines = sourceCode.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.match(/\w+\s*==\s*"/) || line.match(/"\s*==\s*\w+/)) {
        issues.push(
          this.createIssue(
            filePath,
            i + 1,
            IssueSeverity.HIGH,
            IssueCategory.BUG,
            'String comparison using == instead of .equals(). This compares references, not values.',
            'string-equals',
            'Use .equals() method for string comparison',
          ),
        );
      }
    }

    return issues;
  }

  private checkSynchronizationIssues(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check for synchronized on this
    if (sourceCode.includes('synchronized(this)') || sourceCode.includes('synchronized (this)')) {
      const lines = sourceCode.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('synchronized(this)') || lines[i].includes('synchronized (this)')) {
          issues.push(
            this.createIssue(
              filePath,
              i + 1,
              IssueSeverity.MEDIUM,
              IssueCategory.BEST_PRACTICE,
              'Synchronizing on this can lead to deadlocks. Use a private lock object.',
              'sync-on-this',
              'Create a private final Object lock = new Object() and synchronize on that',
            ),
          );
        }
      }
    }

    return issues;
  }

  private checkSerializationIssues(sourceCode: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check for Serializable without serialVersionUID
    if (sourceCode.includes('implements Serializable') && !sourceCode.includes('serialVersionUID')) {
      const lines = sourceCode.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('implements Serializable')) {
          issues.push(
            this.createIssue(
              filePath,
              i + 1,
              IssueSeverity.LOW,
              IssueCategory.BEST_PRACTICE,
              'Serializable class should declare serialVersionUID to ensure version compatibility.',
              'serialversion-uid',
              'Add: private static final long serialVersionUID = 1L;',
            ),
          );
        }
      }
    }

    return issues;
  }
}
