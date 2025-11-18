import { Injectable } from '@nestjs/common';
import { BaseAnalyzer, AnalyzerResult } from './base.analyzer';
import { TreeSitterService } from '../parsers/tree-sitter.service';
import { IssueSeverity, IssueCategory, CodeIssue } from '../types/analysis.types';
import Parser from 'tree-sitter';

@Injectable()
export class JavaScriptAnalyzer extends BaseAnalyzer {
  constructor(private treeSitterService: TreeSitterService) {
    super();
  }

  async analyze(sourceCode: string, filePath: string): Promise<AnalyzerResult> {
    const issues: CodeIssue[] = [];
    const language = this.treeSitterService.detectLanguage(filePath);

    if (!language || !['javascript', 'typescript', 'jsx', 'tsx'].includes(language)) {
      return { issues };
    }

    const parsed = this.treeSitterService.parseCode(sourceCode, language);
    if (!parsed) {
      return { issues };
    }

    const { tree } = parsed;

    // Check for various issues
    issues.push(...this.checkNullPointerErrors(tree, sourceCode, filePath));
    issues.push(...this.checkUnhandledPromises(tree, sourceCode, filePath));
    issues.push(...this.checkConsoleStatements(tree, sourceCode, filePath));
    issues.push(...this.checkVarUsage(tree, sourceCode, filePath));
    issues.push(...this.checkEmptyCatchBlocks(tree, sourceCode, filePath));
    issues.push(...this.checkDeepNesting(tree, sourceCode, filePath));
    issues.push(...this.checkMagicNumbers(tree, sourceCode, filePath));

    return {
      issues,
      metrics: {
        complexity: this.calculateComplexity(tree),
      },
    };
  }

  private checkNullPointerErrors(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const memberExpressions = this.treeSitterService.findNodesByType(tree, 'member_expression');

    for (const node of memberExpressions) {
      const text = this.treeSitterService.getNodeText(node, sourceCode);

      // Check for potential null/undefined access
      if (text.match(/\.\w+/) && !text.includes('?.')) {
        const lineNumber = node.startPosition.row + 1;

        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.MEDIUM,
            IssueCategory.BUG,
            'Potential null pointer access. Consider using optional chaining (?.) or null checks.',
            'null-check',
            `Add null check or use optional chaining: ${text.replace('.', '?.')}`,
            text.replace(/\./g, '?.'),
            node.endPosition.row + 1,
          ),
        );
      }
    }

    return issues;
  }

  private checkUnhandledPromises(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const callExpressions = this.treeSitterService.findNodesByType(tree, 'call_expression');

    for (const node of callExpressions) {
      const text = this.treeSitterService.getNodeText(node, sourceCode);

      // Check for promises without .catch() or try-catch
      if (text.includes('.then(') && !text.includes('.catch(')) {
        const lineNumber = node.startPosition.row + 1;

        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.HIGH,
            IssueCategory.ERROR_HANDLING,
            'Unhandled promise rejection. Add .catch() or use try-catch with async/await.',
            'promise-handling',
            'Add error handling: .catch(error => console.error(error))',
          ),
        );
      }
    }

    return issues;
  }

  private checkConsoleStatements(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const callExpressions = this.treeSitterService.findNodesByType(tree, 'call_expression');

    for (const node of callExpressions) {
      const text = this.treeSitterService.getNodeText(node, sourceCode);

      if (text.startsWith('console.log') || text.startsWith('console.debug')) {
        const lineNumber = node.startPosition.row + 1;

        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.LOW,
            IssueCategory.BEST_PRACTICE,
            'Console statement found. Remove before production or use proper logging.',
            'no-console',
            'Remove console statement or use a proper logger',
          ),
        );
      }
    }

    return issues;
  }

  private checkVarUsage(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const variableDeclarations = this.treeSitterService.findNodesByType(
      tree,
      'variable_declaration',
    );

    for (const node of variableDeclarations) {
      const text = this.treeSitterService.getNodeText(node, sourceCode);

      if (text.startsWith('var ')) {
        const lineNumber = node.startPosition.row + 1;

        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.MEDIUM,
            IssueCategory.BEST_PRACTICE,
            "Use 'const' or 'let' instead of 'var' for better scoping.",
            'no-var',
            "Replace 'var' with 'const' or 'let'",
            text.replace('var ', 'const '),
          ),
        );
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
      const bodyNode = node.childForFieldName('body');
      if (bodyNode) {
        const bodyText = this.treeSitterService.getNodeText(bodyNode, sourceCode).trim();

        if (bodyText === '{}' || bodyText === '{\n}') {
          const lineNumber = node.startPosition.row + 1;

          issues.push(
            this.createIssue(
              filePath,
              lineNumber,
              IssueSeverity.HIGH,
              IssueCategory.ERROR_HANDLING,
              'Empty catch block. Handle errors appropriately or remove try-catch.',
              'no-empty-catch',
              'Add proper error handling in catch block',
            ),
          );
        }
      }
    }

    return issues;
  }

  private checkDeepNesting(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const maxDepth = 4;

    const checkNestingDepth = (node: Parser.SyntaxNode, depth: number = 0) => {
      if (['if_statement', 'for_statement', 'while_statement'].includes(node.type)) {
        depth++;

        if (depth > maxDepth) {
          const lineNumber = node.startPosition.row + 1;

          issues.push(
            this.createIssue(
              filePath,
              lineNumber,
              IssueSeverity.MEDIUM,
              IssueCategory.COMPLEXITY,
              `Deeply nested code (depth: ${depth}). Consider refactoring.`,
              'max-depth',
              'Extract nested logic into separate functions',
            ),
          );
        }
      }

      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          checkNestingDepth(child, depth);
        }
      }
    };

    checkNestingDepth(tree.rootNode);
    return issues;
  }

  private checkMagicNumbers(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const numbers = this.treeSitterService.findNodesByType(tree, 'number');

    for (const node of numbers) {
      const text = this.treeSitterService.getNodeText(node, sourceCode);
      const num = parseFloat(text);

      // Ignore 0, 1, -1 and array indices
      if (![0, 1, -1].includes(num) && node.parent?.type !== 'subscript_expression') {
        const lineNumber = node.startPosition.row + 1;

        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.LOW,
            IssueCategory.MAINTAINABILITY,
            `Magic number ${text} found. Consider using a named constant.`,
            'no-magic-numbers',
            'Replace with a named constant for better maintainability',
          ),
        );
      }
    }

    return issues;
  }

  private calculateComplexity(tree: Parser.Tree): number {
    let complexity = 1;

    const complexityNodes = [
      'if_statement',
      'for_statement',
      'while_statement',
      'case',
      'catch_clause',
      'ternary_expression',
      'binary_expression',
    ];

    this.treeSitterService.traverseTree(tree.rootNode, (node) => {
      if (complexityNodes.includes(node.type)) {
        complexity++;
      }
    });

    return complexity;
  }
}
