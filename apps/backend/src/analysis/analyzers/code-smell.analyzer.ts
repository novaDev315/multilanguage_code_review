import { Injectable } from '@nestjs/common';
import { BaseAnalyzer, AnalyzerResult } from './base.analyzer';
import { TreeSitterService } from '../parsers/tree-sitter.service';
import { IssueSeverity, IssueCategory, CodeIssue } from '../types/analysis.types';
import Parser from 'tree-sitter';

interface CodeSmellPattern {
  name: string;
  description: string;
  refactoringSuggestion: string;
}

@Injectable()
export class CodeSmellAnalyzer extends BaseAnalyzer {
  constructor(private treeSitterService: TreeSitterService) {
    super();
  }

  async analyze(sourceCode: string, filePath: string): Promise<AnalyzerResult> {
    const issues: CodeIssue[] = [];
    const language = this.treeSitterService.detectLanguage(filePath);

    if (!language) {
      return { issues };
    }

    // Run all code smell detectors
    issues.push(...this.detectLongMethods(sourceCode, filePath, language));
    issues.push(...this.detectLargeClasses(sourceCode, filePath, language));
    issues.push(...this.detectDuplicateCode(sourceCode, filePath));
    issues.push(...this.detectLongParameterList(sourceCode, filePath, language));
    issues.push(...this.detectDeadCode(sourceCode, filePath, language));
    issues.push(...this.detectComplexConditionals(sourceCode, filePath));
    issues.push(...this.detectFeatureEnvy(sourceCode, filePath, language));
    issues.push(...this.detectDataClumps(sourceCode, filePath, language));
    issues.push(...this.detectPrimitiveObsession(sourceCode, filePath, language));
    issues.push(...this.detectRefusedBequest(sourceCode, filePath, language));

    return { issues };
  }

  /**
   * Detect methods/functions that are too long (>50 lines)
   */
  private detectLongMethods(
    sourceCode: string,
    filePath: string,
    language: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');
    const maxMethodLength = 50;

    // Pattern to detect function/method declarations
    const functionPatterns: Record<string, RegExp[]> = {
      javascript: [
        /^\s*(async\s+)?function\s+(\w+)\s*\(/,
        /^\s*(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(/,
        /^\s*(const|let|var)\s+(\w+)\s*=\s*(async\s+)?function/,
        /^\s*(\w+)\s*\([^)]*\)\s*{/,
      ],
      typescript: [
        /^\s*(async\s+)?function\s+(\w+)\s*\(/,
        /^\s*(public|private|protected)?\s*(async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/,
        /^\s*(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(/,
      ],
      python: [
        /^\s*def\s+(\w+)\s*\(/,
        /^\s*async\s+def\s+(\w+)\s*\(/,
      ],
      java: [
        /^\s*(public|private|protected)?\s*(static)?\s*\w+\s+(\w+)\s*\([^)]*\)\s*{/,
      ],
      go: [
        /^\s*func\s+(\w+)?\s*\([^)]*\)/,
      ],
      ruby: [
        /^\s*def\s+(\w+)/,
      ],
    };

    const patterns = functionPatterns[language] || functionPatterns['javascript'];
    let currentMethod: { name: string; startLine: number } | null = null;
    let braceCount = 0;
    let inMethod = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for method start
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          if (currentMethod && inMethod) {
            // End previous method
            const methodLength = i - currentMethod.startLine;
            if (methodLength > maxMethodLength) {
              issues.push(
                this.createCodeSmellIssue(
                  filePath,
                  currentMethod.startLine + 1,
                  'Long Method',
                  `Method '${currentMethod.name}' has ${methodLength} lines (max recommended: ${maxMethodLength})`,
                  'Extract smaller, focused methods. Each method should do one thing well.',
                ),
              );
            }
          }
          currentMethod = {
            name: match[2] || match[3] || match[1] || 'anonymous',
            startLine: i,
          };
          inMethod = true;
          braceCount = 0;
          break;
        }
      }

      // Track braces to find method end
      if (inMethod) {
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;

        if (braceCount <= 0 && currentMethod) {
          const methodLength = i - currentMethod.startLine;
          if (methodLength > maxMethodLength) {
            issues.push(
              this.createCodeSmellIssue(
                filePath,
                currentMethod.startLine + 1,
                'Long Method',
                `Method '${currentMethod.name}' has ${methodLength} lines (max recommended: ${maxMethodLength})`,
                'Extract smaller, focused methods. Each method should do one thing well.',
              ),
            );
          }
          inMethod = false;
          currentMethod = null;
        }
      }
    }

    return issues;
  }

  /**
   * Detect classes that are too large (>300 lines or >20 methods)
   */
  private detectLargeClasses(
    sourceCode: string,
    filePath: string,
    language: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');
    const maxClassLines = 300;
    const maxMethods = 20;

    const classPattern = /^\s*(export\s+)?(class|interface)\s+(\w+)/;
    let currentClass: { name: string; startLine: number; methodCount: number } | null = null;
    let braceCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const classMatch = line.match(classPattern);

      if (classMatch) {
        currentClass = {
          name: classMatch[3],
          startLine: i,
          methodCount: 0,
        };
        braceCount = 0;
      }

      if (currentClass) {
        // Count methods in class
        if (line.match(/^\s*(public|private|protected)?\s*(async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/)) {
          currentClass.methodCount++;
        }

        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;

        if (braceCount <= 0) {
          const classLength = i - currentClass.startLine;

          if (classLength > maxClassLines) {
            issues.push(
              this.createCodeSmellIssue(
                filePath,
                currentClass.startLine + 1,
                'Large Class (God Class)',
                `Class '${currentClass.name}' has ${classLength} lines (max recommended: ${maxClassLines})`,
                'Split into smaller, focused classes following Single Responsibility Principle.',
              ),
            );
          }

          if (currentClass.methodCount > maxMethods) {
            issues.push(
              this.createCodeSmellIssue(
                filePath,
                currentClass.startLine + 1,
                'Too Many Methods',
                `Class '${currentClass.name}' has ${currentClass.methodCount} methods (max recommended: ${maxMethods})`,
                'Consider extracting related methods into separate classes or modules.',
              ),
            );
          }

          currentClass = null;
        }
      }
    }

    return issues;
  }

  /**
   * Detect duplicate code blocks (similar code patterns)
   */
  private detectDuplicateCode(sourceCode: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');
    const minDuplicateLines = 6;
    const blockHashes: Map<string, number[]> = new Map();

    // Create sliding window of code blocks
    for (let i = 0; i <= lines.length - minDuplicateLines; i++) {
      const block = lines
        .slice(i, i + minDuplicateLines)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('//') && !l.startsWith('#') && !l.startsWith('*'))
        .join('\n');

      if (block.length < 50) continue; // Skip very short blocks

      const hash = this.simpleHash(block);
      if (blockHashes.has(hash)) {
        const existingLines = blockHashes.get(hash)!;
        if (!existingLines.includes(i + 1)) {
          existingLines.push(i + 1);
          if (existingLines.length === 2) {
            issues.push(
              this.createCodeSmellIssue(
                filePath,
                existingLines[0],
                'Duplicate Code',
                `Similar code block found at lines ${existingLines.join(', ')}`,
                'Extract duplicate code into a reusable function or method.',
              ),
            );
          }
        }
      } else {
        blockHashes.set(hash, [i + 1]);
      }
    }

    return issues;
  }

  /**
   * Detect functions with too many parameters (>4)
   */
  private detectLongParameterList(
    sourceCode: string,
    filePath: string,
    language: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');
    const maxParams = 4;

    const functionParamPattern = /(?:function|def|func)\s+\w+\s*\(([^)]*)\)/;
    const arrowFunctionPattern = /(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/;
    const methodPattern = /(?:public|private|protected)?\s*(?:async\s+)?\w+\s*\(([^)]*)\)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let params: string | null = null;

      const funcMatch = line.match(functionParamPattern);
      const arrowMatch = line.match(arrowFunctionPattern);
      const methodMatch = line.match(methodPattern);

      if (funcMatch) params = funcMatch[1];
      else if (arrowMatch) params = arrowMatch[1];
      else if (methodMatch) params = methodMatch[1];

      if (params) {
        const paramCount = params
          .split(',')
          .filter((p) => p.trim().length > 0).length;

        if (paramCount > maxParams) {
          issues.push(
            this.createCodeSmellIssue(
              filePath,
              i + 1,
              'Long Parameter List',
              `Function has ${paramCount} parameters (max recommended: ${maxParams})`,
              'Use a configuration object or builder pattern to reduce parameters.',
            ),
          );
        }
      }
    }

    return issues;
  }

  /**
   * Detect potential dead code (unreachable code after return/throw)
   */
  private detectDeadCode(
    sourceCode: string,
    filePath: string,
    language: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      const nextLine = lines[i + 1]?.trim();

      // Check for code after return/throw/break/continue
      if (
        (line.startsWith('return ') || line === 'return;' || line === 'return') &&
        nextLine &&
        !nextLine.startsWith('}') &&
        !nextLine.startsWith('//') &&
        !nextLine.startsWith('/*') &&
        !nextLine.startsWith('case ') &&
        !nextLine.startsWith('default:') &&
        nextLine.length > 0
      ) {
        issues.push(
          this.createCodeSmellIssue(
            filePath,
            i + 2,
            'Dead Code',
            'Unreachable code after return statement',
            'Remove unreachable code or fix control flow logic.',
          ),
        );
      }

      if (
        (line.startsWith('throw ') || line.startsWith('throw new')) &&
        nextLine &&
        !nextLine.startsWith('}') &&
        !nextLine.startsWith('//') &&
        !nextLine.startsWith('catch') &&
        nextLine.length > 0
      ) {
        issues.push(
          this.createCodeSmellIssue(
            filePath,
            i + 2,
            'Dead Code',
            'Unreachable code after throw statement',
            'Remove unreachable code or fix error handling logic.',
          ),
        );
      }
    }

    // Detect unused variables (simple pattern)
    const declaredVars: Map<string, number> = new Map();
    const usedVars: Set<string> = new Set();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track declarations
      const declMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=/);
      if (declMatch) {
        declaredVars.set(declMatch[1], i + 1);
      }

      // Track usage (simplified)
      const words = line.match(/\b\w+\b/g) || [];
      words.forEach((w) => usedVars.add(w));
    }

    // Find unused (only report if declared but never used elsewhere)
    declaredVars.forEach((lineNum, varName) => {
      // Count occurrences
      const regex = new RegExp(`\\b${varName}\\b`, 'g');
      const matches = sourceCode.match(regex);
      if (matches && matches.length === 1) {
        issues.push(
          this.createCodeSmellIssue(
            filePath,
            lineNum,
            'Dead Code',
            `Variable '${varName}' is declared but never used`,
            'Remove unused variable or use it in your code.',
          ),
        );
      }
    });

    return issues;
  }

  /**
   * Detect complex conditional expressions
   */
  private detectComplexConditionals(sourceCode: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');
    const maxConditions = 3;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Count logical operators in if statements
      if (line.includes('if') && line.includes('(')) {
        const andCount = (line.match(/&&/g) || []).length;
        const orCount = (line.match(/\|\|/g) || []).length;
        const totalConditions = andCount + orCount + 1;

        if (totalConditions > maxConditions) {
          issues.push(
            this.createCodeSmellIssue(
              filePath,
              i + 1,
              'Complex Conditional',
              `Conditional has ${totalConditions} conditions (max recommended: ${maxConditions})`,
              'Extract conditions into well-named boolean variables or separate methods.',
            ),
          );
        }
      }

      // Detect deeply nested ternary operators
      const ternaryCount = (line.match(/\?/g) || []).length;
      if (ternaryCount > 1) {
        issues.push(
          this.createCodeSmellIssue(
            filePath,
            i + 1,
            'Nested Ternary',
            'Nested ternary operators reduce readability',
            'Replace with if-else statements or extract into a function.',
          ),
        );
      }
    }

    return issues;
  }

  /**
   * Detect Feature Envy - method uses more features from other classes
   */
  private detectFeatureEnvy(
    sourceCode: string,
    filePath: string,
    language: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    // Simple heuristic: method with many calls to same external object
    const methodBlocks: { start: number; externalCalls: Map<string, number> }[] = [];
    let currentBlock: { start: number; externalCalls: Map<string, number> } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect method start
      if (line.match(/(?:function|def|func|async)\s+\w+|(?:public|private)\s+\w+\s*\(/)) {
        if (currentBlock) {
          methodBlocks.push(currentBlock);
        }
        currentBlock = { start: i + 1, externalCalls: new Map() };
      }

      // Count external object access
      if (currentBlock) {
        const objectAccess = line.match(/(\w+)\.\w+/g) || [];
        objectAccess.forEach((access) => {
          const objName = access.split('.')[0];
          if (!['this', 'self', 'console', 'Math', 'JSON', 'Object', 'Array'].includes(objName)) {
            currentBlock!.externalCalls.set(
              objName,
              (currentBlock!.externalCalls.get(objName) || 0) + 1,
            );
          }
        });
      }
    }

    if (currentBlock) {
      methodBlocks.push(currentBlock);
    }

    // Check for feature envy
    methodBlocks.forEach((block) => {
      block.externalCalls.forEach((count, objName) => {
        if (count >= 5) {
          issues.push(
            this.createCodeSmellIssue(
              filePath,
              block.start,
              'Feature Envy',
              `Method accesses '${objName}' ${count} times. Consider moving logic to that class.`,
              'Move this method to the class it primarily operates on.',
            ),
          );
        }
      });
    });

    return issues;
  }

  /**
   * Detect Data Clumps - groups of variables that appear together frequently
   */
  private detectDataClumps(
    sourceCode: string,
    filePath: string,
    language: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    // Common data clump patterns
    const clumpPatterns = [
      { pattern: /\b(x|left)\b.*\b(y|top)\b.*\b(width|w)\b.*\b(height|h)\b/i, name: 'Rectangle/Bounds' },
      { pattern: /\b(firstName|first_name)\b.*\b(lastName|last_name)\b/i, name: 'Name' },
      { pattern: /\b(street|address)\b.*\b(city)\b.*\b(zip|postal)/i, name: 'Address' },
      { pattern: /\b(start|begin)\b.*\b(end|finish)\b/i, name: 'Range' },
      { pattern: /\b(min)\b.*\b(max)\b/i, name: 'Range' },
      { pattern: /\b(host|hostname)\b.*\b(port)\b.*\b(protocol)/i, name: 'Connection' },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check function parameters for clumps
      if (line.match(/\([^)]{50,}\)/)) { // Long parameter list
        for (const { pattern, name } of clumpPatterns) {
          if (pattern.test(line)) {
            issues.push(
              this.createCodeSmellIssue(
                filePath,
                i + 1,
                'Data Clump',
                `Related parameters (${name}) should be grouped into an object`,
                `Create a ${name} class/interface to encapsulate these related values.`,
              ),
            );
            break;
          }
        }
      }
    }

    return issues;
  }

  /**
   * Detect Primitive Obsession - overuse of primitives instead of objects
   */
  private detectPrimitiveObsession(
    sourceCode: string,
    filePath: string,
    language: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    // Patterns suggesting primitive obsession
    const suspiciousPatterns = [
      { pattern: /\bemail\w*\s*[:=]\s*['"]?string/i, suggestion: 'Email' },
      { pattern: /\bphone\w*\s*[:=]\s*['"]?string/i, suggestion: 'PhoneNumber' },
      { pattern: /\bmoney|amount|price|cost\s*[:=]\s*['"]?number/i, suggestion: 'Money' },
      { pattern: /\burl\w*\s*[:=]\s*['"]?string/i, suggestion: 'URL' },
      { pattern: /\bdate\w*\s*[:=]\s*['"]?string/i, suggestion: 'Date' },
      { pattern: /\bpassword\s*[:=]\s*['"]?string/i, suggestion: 'Password (hashed)' },
    ];

    // Type annotations with repeated string/number for domain concepts
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const { pattern, suggestion } of suspiciousPatterns) {
        if (pattern.test(line)) {
          issues.push(
            this.createCodeSmellIssue(
              filePath,
              i + 1,
              'Primitive Obsession',
              `Consider using a value object instead of primitive type`,
              `Create a ${suggestion} value object to encapsulate validation and behavior.`,
            ),
          );
          break;
        }
      }
    }

    return issues;
  }

  /**
   * Detect Refused Bequest - subclass doesn't use inherited methods
   */
  private detectRefusedBequest(
    sourceCode: string,
    filePath: string,
    language: string,
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = sourceCode.split('\n');

    // Find classes that extend but override to throw or do nothing
    let inClass = false;
    let classStartLine = 0;
    let className = '';
    let hasExtends = false;
    let emptyOverrides: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const classMatch = line.match(/class\s+(\w+)\s+extends\s+(\w+)/);
      if (classMatch) {
        inClass = true;
        classStartLine = i + 1;
        className = classMatch[1];
        hasExtends = true;
        emptyOverrides = [];
      }

      if (inClass) {
        // Check for methods that just throw "not implemented" or call super only
        if (line.match(/throw\s+new\s+Error\s*\(\s*['"]not\s+implemented/i)) {
          const methodMatch = lines[i - 1]?.match(/(\w+)\s*\(/);
          if (methodMatch) {
            emptyOverrides.push(methodMatch[1]);
          }
        }

        // Check for empty method bodies
        if (line.match(/{\s*}\s*$/) || line.match(/{\s*\/\/\s*TODO/i)) {
          const methodMatch = lines[i]?.match(/(\w+)\s*\([^)]*\)\s*{/);
          if (methodMatch) {
            emptyOverrides.push(methodMatch[1]);
          }
        }

        if (line.match(/^}\s*$/) && hasExtends && emptyOverrides.length >= 2) {
          issues.push(
            this.createCodeSmellIssue(
              filePath,
              classStartLine,
              'Refused Bequest',
              `Class '${className}' extends parent but refuses inherited behavior (${emptyOverrides.join(', ')})`,
              'Consider using composition instead of inheritance, or create a different abstraction.',
            ),
          );
          inClass = false;
        }
      }
    }

    return issues;
  }

  private createCodeSmellIssue(
    filePath: string,
    lineNumber: number,
    smellName: string,
    message: string,
    refactoringSuggestion: string,
  ): CodeIssue {
    return this.createIssue(
      filePath,
      lineNumber,
      IssueSeverity.MEDIUM,
      IssueCategory.CODE_SMELL,
      `[${smellName}] ${message}`,
      `code-smell-${smellName.toLowerCase().replace(/\s+/g, '-')}`,
      refactoringSuggestion,
    );
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}
