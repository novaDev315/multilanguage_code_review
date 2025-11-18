import { Injectable } from '@nestjs/common';
import { BaseAnalyzer, AnalyzerResult } from './base.analyzer';
import { TreeSitterService } from '../parsers/tree-sitter.service';
import { IssueSeverity, IssueCategory, CodeIssue } from '../types/analysis.types';
import Parser from 'tree-sitter';

@Injectable()
export class GoAnalyzer extends BaseAnalyzer {
  constructor(private treeSitterService: TreeSitterService) {
    super();
  }

  async analyze(sourceCode: string, filePath: string): Promise<AnalyzerResult> {
    const issues: CodeIssue[] = [];

    if (!filePath.endsWith('.go')) {
      return { issues };
    }

    const parsed = this.treeSitterService.parseCode(sourceCode, 'go');
    if (!parsed) {
      return { issues };
    }

    const { tree } = parsed;

    // Check for Go-specific issues
    issues.push(...this.checkErrorHandling(tree, sourceCode, filePath));
    issues.push(...this.checkGoroutineLeaks(sourceCode, filePath));
    issues.push(...this.checkDeferInLoops(tree, sourceCode, filePath));
    issues.push(...this.checkUnusedResults(sourceCode, filePath));
    issues.push(...this.checkRaceConditions(sourceCode, filePath));

    return { issues };
  }

  private checkErrorHandling(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check for unchecked errors
    const lines = sourceCode.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for function calls that return error but don't check it
      if (line.match(/\w+\([^)]*\)/) && i < lines.length - 1) {
        const nextLine = lines[i + 1];
        if (line.includes(', err') && !nextLine.trim().startsWith('if err')) {
          issues.push(
            this.createIssue(
              filePath,
              i + 1,
              IssueSeverity.HIGH,
              IssueCategory.ERROR_HANDLING,
              'Error returned but not checked. Always check errors in Go.',
              'unchecked-error',
              'Add: if err != nil { return err }',
            ),
          );
        }
      }
    }

    return issues;
  }

  private checkGoroutineLeaks(sourceCode: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for goroutines without proper context or cancellation
      if (line.includes('go func()') || line.includes('go ')) {
        const hasContext = sourceCode.includes('context.Context');
        const hasCancel = sourceCode.includes('cancel()') || sourceCode.includes('defer cancel()');

        if (!hasContext && !hasCancel) {
          issues.push(
            this.createIssue(
              filePath,
              i + 1,
              IssueSeverity.MEDIUM,
              IssueCategory.MEMORY,
              'Goroutine without context or cancellation mechanism. Potential goroutine leak.',
              'goroutine-leak',
              'Use context.WithCancel or context.WithTimeout to properly manage goroutine lifecycle',
            ),
          );
        }
      }
    }

    return issues;
  }

  private checkDeferInLoops(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    let inLoop = false;
    let loopStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('for ')) {
        inLoop = true;
        loopStart = i;
      }

      if (inLoop && line.includes('defer ')) {
        issues.push(
          this.createIssue(
            filePath,
            i + 1,
            IssueSeverity.HIGH,
            IssueCategory.MEMORY,
            'defer in loop. Deferred functions accumulate and execute after loop completes, potentially causing memory issues.',
            'defer-in-loop',
            'Move defer out of loop or use a separate function',
          ),
        );
      }

      if (inLoop && line.includes('}')) {
        inLoop = false;
      }
    }

    return issues;
  }

  private checkUnusedResults(sourceCode: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check for function calls that are commonly important but result is ignored
      const criticalFunctions = ['Close', 'Flush', 'Write', 'Read', 'Exec'];

      for (const fn of criticalFunctions) {
        if (line.match(new RegExp(`\\.${fn}\\s*\\(`)) && !line.includes(':=') && !line.includes('=') && !line.includes('if')) {
          issues.push(
            this.createIssue(
              filePath,
              i + 1,
              IssueSeverity.MEDIUM,
              IssueCategory.ERROR_HANDLING,
              `Result of ${fn}() call is ignored. This may return an error that should be checked.`,
              'unused-result',
              'Check the error: if err := obj.' + fn + '(); err != nil { ... }',
            ),
          );
        }
      }
    }

    return issues;
  }

  private checkRaceConditions(sourceCode: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check for shared variable access in goroutines without synchronization
    if (sourceCode.includes('go func()') && !sourceCode.includes('sync.Mutex') && !sourceCode.includes('sync.RWMutex') && !sourceCode.includes('chan ')) {
      const lines = sourceCode.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('go func()')) {
          issues.push(
            this.createIssue(
              filePath,
              i + 1,
              IssueSeverity.MEDIUM,
              IssueCategory.BUG,
              'Goroutine accessing shared variables without synchronization. Potential race condition.',
              'race-condition',
              'Use sync.Mutex, sync.RWMutex, or channels for synchronization',
            ),
          );
        }
      }
    }

    return issues;
  }
}
