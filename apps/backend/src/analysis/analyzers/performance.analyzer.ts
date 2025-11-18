import { Injectable } from '@nestjs/common';
import { BaseAnalyzer, AnalyzerResult } from './base.analyzer';
import { TreeSitterService } from '../parsers/tree-sitter.service';
import { IssueSeverity, IssueCategory, CodeIssue } from '../types/analysis.types';
import Parser from 'tree-sitter';

@Injectable()
export class PerformanceAnalyzer extends BaseAnalyzer {
  constructor(private treeSitterService: TreeSitterService) {
    super();
  }

  async analyze(sourceCode: string, filePath: string): Promise<AnalyzerResult> {
    const issues: CodeIssue[] = [];
    const language = this.treeSitterService.detectLanguage(filePath);

    if (!language) {
      return { issues };
    }

    const parsed = this.treeSitterService.parseCode(sourceCode, language);
    if (!parsed) {
      return { issues };
    }

    const { tree } = parsed;

    // Run performance checks
    issues.push(...this.checkNestedLoops(tree, sourceCode, filePath));
    issues.push(...this.checkInefficient Algorithms(tree, sourceCode, filePath));
    issues.push(...this.checkDatabaseQueries(tree, sourceCode, filePath));
    issues.push(...this.checkMemoryLeaks(tree, sourceCode, filePath));
    issues.push(...this.checkLargeDataStructures(tree, sourceCode, filePath));
    issues.push(...this.checkSynchronousOperations(tree, sourceCode, filePath));

    return {
      issues,
      metrics: {
        complexity: this.calculateCyclomaticComplexity(tree),
      },
    };
  }

  private checkNestedLoops(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const loopTypes = ['for_statement', 'while_statement', 'for_in_statement'];

    const checkLoopNesting = (node: Parser.SyntaxNode, depth: number = 0) => {
      if (loopTypes.includes(node.type)) {
        depth++;

        if (depth >= 3) {
          const lineNumber = node.startPosition.row + 1;
          issues.push(
            this.createIssue(
              filePath,
              lineNumber,
              IssueSeverity.HIGH,
              IssueCategory.PERFORMANCE,
              `Nested loops detected (depth: ${depth}). Consider optimizing algorithm complexity.`,
              'nested-loops',
              'Use hash maps, pre-compute values, or consider alternative algorithms',
            ),
          );
        }
      }

      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          checkLoopNesting(child, depth);
        }
      }
    };

    checkLoopNesting(tree.rootNode);
    return issues;
  }

  private checkInefficientAlgorithms(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check for array operations inside loops
    const forLoops = this.treeSitterService.findNodesByType(tree, 'for_statement');

    for (const loopNode of forLoops) {
      const loopBody = loopNode.childForFieldName('body');
      if (!loopBody) continue;

      const text = this.treeSitterService.getNodeText(loopBody, sourceCode);

      // Check for indexOf, includes, find in loops (O(n²))
      if (
        text.includes('.indexOf(') ||
        text.includes('.includes(') ||
        text.includes('.find(')
      ) {
        const lineNumber = loopNode.startPosition.row + 1;
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.MEDIUM,
            IssueCategory.PERFORMANCE,
            'Array search operation inside loop. Consider using Set or Map for O(1) lookup.',
            'inefficient-search',
            'Convert array to Set before loop: const set = new Set(array)',
          ),
        );
      }

      // Check for array concat or push in loops
      if (text.includes('.concat(') || text.match(/\.push\([^)]+\)/)) {
        const lineNumber = loopNode.startPosition.row + 1;
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.LOW,
            IssueCategory.PERFORMANCE,
            'Array modification inside loop may cause performance issues.',
            'array-modification-loop',
            'Pre-allocate array size or use different data structure',
          ),
        );
      }
    }

    return issues;
  }

  private checkDatabaseQueries(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check for database queries inside loops (N+1 problem)
    const forLoops = this.treeSitterService.findNodesByType(tree, 'for_statement');

    for (const loopNode of forLoops) {
      const loopBody = loopNode.childForFieldName('body');
      if (!loopBody) continue;

      const text = this.treeSitterService.getNodeText(loopBody, sourceCode);

      // Check for database operations
      const dbOperations = [
        'findOne',
        'findById',
        'findUnique',
        'query(',
        'execute(',
        'SELECT',
        'INSERT',
        'UPDATE',
      ];

      for (const op of dbOperations) {
        if (text.includes(op)) {
          const lineNumber = loopNode.startPosition.row + 1;
          issues.push(
            this.createIssue(
              filePath,
              lineNumber,
              IssueSeverity.CRITICAL,
              IssueCategory.PERFORMANCE,
              'Database query inside loop (N+1 problem). This will cause severe performance issues.',
              'n-plus-one',
              'Use batch operations, joins, or eager loading to fetch all data at once',
            ),
          );
          break;
        }
      }
    }

    return issues;
  }

  private checkMemoryLeaks(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check for event listeners without cleanup
    const callExpressions = this.treeSitterService.findNodesByType(tree, 'call_expression');

    for (const node of callExpressions) {
      const text = this.treeSitterService.getNodeText(node, sourceCode);

      if (text.includes('addEventListener') || text.includes('.on(')) {
        // Check if there's a corresponding removeEventListener
        const hasRemoveListener =
          sourceCode.includes('removeEventListener') || sourceCode.includes('.off(');

        if (!hasRemoveListener) {
          const lineNumber = node.startPosition.row + 1;
          issues.push(
            this.createIssue(
              filePath,
              lineNumber,
              IssueSeverity.MEDIUM,
              IssueCategory.MEMORY,
              'Event listener added without cleanup. This may cause memory leaks.',
              'event-listener-leak',
              'Add removeEventListener in cleanup/destructor/useEffect return',
            ),
          );
        }
      }

      // Check for setInterval without clearInterval
      if (text.includes('setInterval')) {
        const hasClear = sourceCode.includes('clearInterval');

        if (!hasClear) {
          const lineNumber = node.startPosition.row + 1;
          issues.push(
            this.createIssue(
              filePath,
              lineNumber,
              IssueSeverity.HIGH,
              IssueCategory.MEMORY,
              'setInterval without clearInterval. This will cause memory leaks.',
              'interval-leak',
              'Store interval ID and call clearInterval in cleanup',
            ),
          );
        }
      }
    }

    return issues;
  }

  private checkLargeDataStructures(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const arrays = this.treeSitterService.findNodesByType(tree, 'array');

    for (const node of arrays) {
      const text = this.treeSitterService.getNodeText(node, sourceCode);
      const elementCount = (text.match(/,/g) || []).length + 1;

      if (elementCount > 100) {
        const lineNumber = node.startPosition.row + 1;
        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.MEDIUM,
            IssueCategory.PERFORMANCE,
            `Large array literal (${elementCount} elements). Consider loading from file or database.`,
            'large-data-structure',
            'Move large data to external file or database',
          ),
        );
      }
    }

    return issues;
  }

  private checkSynchronousOperations(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check for synchronous file operations
    const syncOperations = [
      'readFileSync',
      'writeFileSync',
      'readdirSync',
      'statSync',
      'mkdirSync',
    ];

    for (const op of syncOperations) {
      const regex = new RegExp(`\\b${op}\\b`, 'g');
      const matches = sourceCode.matchAll(regex);

      for (const match of matches) {
        const lines = sourceCode.substring(0, match.index).split('\n');
        const lineNumber = lines.length;

        issues.push(
          this.createIssue(
            filePath,
            lineNumber,
            IssueSeverity.MEDIUM,
            IssueCategory.PERFORMANCE,
            `Synchronous operation '${op}' blocks event loop. Use async version.`,
            'sync-operation',
            `Use ${op.replace('Sync', '')} with await instead`,
          ),
        );
      }
    }

    return issues;
  }

  private calculateCyclomaticComplexity(tree: Parser.Tree): number {
    let complexity = 1;

    const complexityNodes = [
      'if_statement',
      'else_clause',
      'for_statement',
      'while_statement',
      'case',
      'catch_clause',
      'ternary_expression',
      'binary_expression',
      'logical_expression',
    ];

    this.treeSitterService.traverseTree(tree.rootNode, (node) => {
      if (complexityNodes.includes(node.type)) {
        complexity++;
      }
    });

    return complexity;
  }
}
