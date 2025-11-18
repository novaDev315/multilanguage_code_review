import { Injectable } from '@nestjs/common';
import { BaseAnalyzer, AnalyzerResult } from './base.analyzer';
import { TreeSitterService } from '../parsers/tree-sitter.service';
import { IssueSeverity, IssueCategory, CodeIssue } from '../types/analysis.types';
import Parser from 'tree-sitter';

@Injectable()
export class PythonAnalyzer extends BaseAnalyzer {
  constructor(private treeSitterService: TreeSitterService) {
    super();
  }

  async analyze(sourceCode: string, filePath: string): Promise<AnalyzerResult> {
    const issues: CodeIssue[] = [];

    if (!filePath.endsWith('.py')) {
      return { issues };
    }

    const parsed = this.treeSitterService.parseCode(sourceCode, 'python');
    if (!parsed) {
      return { issues };
    }

    const { tree } = parsed;

    // Check for various issues
    issues.push(...this.checkBarExcept(tree, sourceCode, filePath));
    issues.push(...this.checkMutableDefaultArgs(tree, sourceCode, filePath));
    issues.push(...this.checkGlobalVariables(tree, sourceCode, filePath));
    issues.push(...this.checkSQLInjection(tree, sourceCode, filePath));
    issues.push(...this.checkHardcodedSecrets(tree, sourceCode, filePath));
    issues.push(...this.checkUnsafePickle(tree, sourceCode, filePath));

    return {
      issues,
      metrics: {
        complexity: this.calculateComplexity(tree),
      },
    };
  }

  private checkBarExcept(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const exceptClauses = this.treeSitterService.findNodesByType(tree, 'except_clause');

    for (const node of exceptClauses) {
      const text = this.treeSitterService.getNodeText(node, sourceCode);

      // Check for bare except
      if (text.trim() === 'except:' || text.match(/except\s*:/)) {
        const lineNumber = node.startPosition.row + 1;

        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.HIGH,
            IssueCategory.ERROR_HANDLING,
            'Bare except clause catches all exceptions, including system exits. Specify exception types.',
            'bare-except',
            'Specify the exception type: except Exception:',
            text.replace('except:', 'except Exception:'),
          ),
        );
      }
    }

    return issues;
  }

  private checkMutableDefaultArgs(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const functionDefs = this.treeSitterService.findNodesByType(tree, 'function_definition');

    for (const funcNode of functionDefs) {
      const parameters = funcNode.childForFieldName('parameters');
      if (!parameters) continue;

      this.treeSitterService.traverseTree(parameters, (node) => {
        if (node.type === 'default_parameter') {
          const defaultValue = node.childForFieldName('value');
          if (defaultValue) {
            const valueText = this.treeSitterService.getNodeText(defaultValue, sourceCode);

            if (valueText.startsWith('[') || valueText.startsWith('{')) {
              const lineNumber = node.startPosition.row + 1;

              issues.push(
                this.createIssue(
                  filePath,
                  lineNumber,
                  IssueSeverity.HIGH,
                  IssueCategory.BUG,
                  'Mutable default argument. Use None and create inside function.',
                  'mutable-default',
                  'Replace with None and create the mutable object inside the function',
                ),
              );
            }
          }
        }
      });
    }

    return issues;
  }

  private checkGlobalVariables(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const globalStatements = this.treeSitterService.findNodesByType(tree, 'global_statement');

    for (const node of globalStatements) {
      const lineNumber = node.startPosition.row + 1;

      issues.push(
        this.createIssue(
          filePath,
          lineNumber,
          IssueSeverity.MEDIUM,
          IssueCategory.BEST_PRACTICE,
          'Global variable usage. Consider using function parameters or class attributes.',
          'global-usage',
          'Avoid global variables; use function parameters or class attributes instead',
        ),
      );
    }

    return issues;
  }

  private checkSQLInjection(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const stringNodes = this.treeSitterService.findNodesByType(tree, 'string');

    for (const node of stringNodes) {
      const text = this.treeSitterService.getNodeText(node, sourceCode).toLowerCase();

      // Check for SQL string concatenation
      if (
        (text.includes('select') || text.includes('insert') || text.includes('update')) &&
        node.parent?.type === 'binary_operator'
      ) {
        const lineNumber = node.startPosition.row + 1;

        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.CRITICAL,
            IssueCategory.SECURITY,
            'Potential SQL injection vulnerability. Use parameterized queries.',
            'sql-injection',
            'Use parameterized queries or an ORM to prevent SQL injection',
          ),
        );
      }
    }

    return issues;
  }

  private checkHardcodedSecrets(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const assignments = this.treeSitterService.findNodesByType(tree, 'assignment');

    const secretPatterns = [
      /password\s*=/i,
      /api[_-]?key\s*=/i,
      /secret\s*=/i,
      /token\s*=/i,
      /private[_-]?key\s*=/i,
    ];

    for (const node of assignments) {
      const text = this.treeSitterService.getNodeText(node, sourceCode);

      for (const pattern of secretPatterns) {
        if (pattern.test(text) && !text.includes('os.environ') && !text.includes('getenv')) {
          const lineNumber = node.startPosition.row + 1;

          issues.push(
            this.createIssue(
              filePath,
              lineNumber,
              IssueSeverity.CRITICAL,
              IssueCategory.SECURITY,
              'Hardcoded secret detected. Use environment variables or secret management.',
              'hardcoded-secret',
              'Move secret to environment variables or a secrets manager',
            ),
          );
          break;
        }
      }
    }

    return issues;
  }

  private checkUnsafePickle(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const importStatements = this.treeSitterService.findNodesByType(tree, 'import_statement');
    const importFromStatements = this.treeSitterService.findNodesByType(
      tree,
      'import_from_statement',
    );

    const allImports = [...importStatements, ...importFromStatements];

    for (const node of allImports) {
      const text = this.treeSitterService.getNodeText(node, sourceCode);

      if (text.includes('pickle')) {
        // Look for pickle.load or pickle.loads calls
        const callExpressions = this.treeSitterService.findNodesByType(tree, 'call');

        for (const callNode of callExpressions) {
          const callText = this.treeSitterService.getNodeText(callNode, sourceCode);

          if (callText.includes('pickle.load')) {
            const lineNumber = callNode.startPosition.row + 1;

            issues.push(
              this.createIssue(
                filePath,
                lineNumber,
                IssueSeverity.HIGH,
                IssueCategory.SECURITY,
                'Unsafe pickle deserialization. Consider using JSON or validate input.',
                'unsafe-pickle',
                'Use JSON instead or validate pickle input from trusted sources only',
              ),
            );
          }
        }
      }
    }

    return issues;
  }

  private calculateComplexity(tree: Parser.Tree): number {
    let complexity = 1;

    const complexityNodes = [
      'if_statement',
      'elif_clause',
      'for_statement',
      'while_statement',
      'except_clause',
      'conditional_expression',
      'boolean_operator',
    ];

    this.treeSitterService.traverseTree(tree.rootNode, (node) => {
      if (complexityNodes.includes(node.type)) {
        complexity++;
      }
    });

    return complexity;
  }
}
