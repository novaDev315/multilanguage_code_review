import { Injectable } from '@nestjs/common';
import { BaseAnalyzer, AnalyzerResult } from './base.analyzer';
import { TreeSitterService } from '../parsers/tree-sitter.service';
import { IssueSeverity, IssueCategory, CodeIssue } from '../types/analysis.types';
import Parser from 'tree-sitter';

@Injectable()
export class RubyAnalyzer extends BaseAnalyzer {
  constructor(private treeSitterService: TreeSitterService) {
    super();
  }

  async analyze(sourceCode: string, filePath: string): Promise<AnalyzerResult> {
    const issues: CodeIssue[] = [];

    if (!filePath.endsWith('.rb')) {
      return { issues };
    }

    const parsed = this.treeSitterService.parseCode(sourceCode, 'ruby');
    if (!parsed) {
      return { issues };
    }

    const { tree } = parsed;

    // Check for Ruby-specific issues
    issues.push(...this.checkMassAssignment(sourceCode, filePath));
    issues.push(...this.checkSQLInjection(sourceCode, filePath));
    issues.push(...this.checkCommandInjection(sourceCode, filePath));
    issues.push(...this.checkSymbolToProc(tree, sourceCode, filePath));
    issues.push(...this.checkRescueStandardError(sourceCode, filePath));

    return { issues };
  }

  private checkMassAssignment(sourceCode: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for mass assignment in Rails
      if (line.match(/\.create\(params\[/) || line.match(/\.update\(params\[/) || line.match(/\.new\(params\[/)) {
        issues.push(
          this.createIssue(
            filePath,
            i + 1,
            IssueSeverity.CRITICAL,
            IssueCategory.SECURITY,
            'Mass assignment vulnerability. Use strong parameters to whitelist attributes.',
            'mass-assignment',
            'Use params.require(:model).permit(:attr1, :attr2)',
          ),
        );
      }
    }

    return issues;
  }

  private checkSQLInjection(sourceCode: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for SQL injection via string interpolation
      if ((line.includes('.where(') || line.includes('.find_by_sql')) && line.includes('#{')) {
        issues.push(
          this.createIssue(
            filePath,
            i + 1,
            IssueSeverity.CRITICAL,
            IssueCategory.SECURITY,
            'SQL injection via string interpolation. Use parameterized queries.',
            'sql-injection-ruby',
            'Use placeholders: .where("name = ?", params[:name])',
          ),
        );
      }
    }

    return issues;
  }

  private checkCommandInjection(sourceCode: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for command injection
      if ((line.includes('system(') || line.includes('exec(') || line.includes('`')) && line.includes('#{')) {
        issues.push(
          this.createIssue(
            filePath,
            i + 1,
            IssueSeverity.CRITICAL,
            IssueCategory.SECURITY,
            'Command injection via string interpolation. Sanitize user input.',
            'command-injection',
            'Use array form: system("command", arg1, arg2) or validate input',
          ),
        );
      }
    }

    return issues;
  }

  private checkSymbolToProc(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Suggest symbol-to-proc for simple blocks
      if (line.match(/\.map\s*\{\s*\|(\w+)\|\s*\1\.\w+\s*\}/)) {
        const match = line.match(/\.(\w+)\s*\}/);
        if (match) {
          issues.push(
            this.createIssue(
              filePath,
              i + 1,
              IssueSeverity.LOW,
              IssueCategory.STYLE,
              'Can use symbol-to-proc shorthand for cleaner code.',
              'symbol-to-proc',
              `Use: .map(&:${match[1]})`,
            ),
          );
        }
      }
    }

    return issues;
  }

  private checkRescueStandardError(sourceCode: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for bare rescue
      if (line.trim() === 'rescue' || line.match(/rescue\s*$/)) {
        issues.push(
          this.createIssue(
            filePath,
            i + 1,
            IssueSeverity.MEDIUM,
            IssueCategory.ERROR_HANDLING,
            'Bare rescue catches all exceptions including system exits. Specify exception type.',
            'bare-rescue',
            'Use: rescue StandardError or specify the exception type',
          ),
        );
      }
    }

    return issues;
  }
}
