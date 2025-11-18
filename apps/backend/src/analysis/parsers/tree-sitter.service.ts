import { Injectable } from '@nestjs/common';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Java from 'tree-sitter-java';
import Go from 'tree-sitter-go';
import Ruby from 'tree-sitter-ruby';

export interface ParsedFile {
  language: string;
  tree: Parser.Tree;
  sourceCode: string;
}

export interface ASTNode {
  type: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  text: string;
  children?: ASTNode[];
}

@Injectable()
export class TreeSitterService {
  private parsers: Map<string, Parser> = new Map();

  constructor() {
    this.initializeParsers();
  }

  private initializeParsers() {
    // JavaScript
    const jsParser = new Parser();
    jsParser.setLanguage(JavaScript);
    this.parsers.set('javascript', jsParser);
    this.parsers.set('js', jsParser);

    // TypeScript
    const tsParser = new Parser();
    tsParser.setLanguage(TypeScript.typescript);
    this.parsers.set('typescript', tsParser);
    this.parsers.set('ts', tsParser);

    // TSX
    const tsxParser = new Parser();
    tsxParser.setLanguage(TypeScript.tsx);
    this.parsers.set('tsx', tsxParser);
    this.parsers.set('jsx', tsxParser);

    // Python
    const pythonParser = new Parser();
    pythonParser.setLanguage(Python);
    this.parsers.set('python', pythonParser);
    this.parsers.set('py', pythonParser);

    // Java
    const javaParser = new Parser();
    javaParser.setLanguage(Java);
    this.parsers.set('java', javaParser);

    // Go
    const goParser = new Parser();
    goParser.setLanguage(Go);
    this.parsers.set('go', goParser);

    // Ruby
    const rubyParser = new Parser();
    rubyParser.setLanguage(Ruby);
    this.parsers.set('ruby', rubyParser);
    this.parsers.set('rb', rubyParser);
  }

  detectLanguage(filePath: string): string | null {
    const extension = filePath.split('.').pop()?.toLowerCase();

    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'tsx',
      'py': 'python',
      'java': 'java',
      'go': 'go',
      'rb': 'ruby',
      'php': 'php',
      'cs': 'csharp',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
    };

    return languageMap[extension] || null;
  }

  parseCode(sourceCode: string, language: string): ParsedFile | null {
    const parser = this.parsers.get(language.toLowerCase());

    if (!parser) {
      console.warn(`No parser available for language: ${language}`);
      return null;
    }

    try {
      const tree = parser.parse(sourceCode);
      return {
        language,
        tree,
        sourceCode,
      };
    } catch (error) {
      console.error(`Error parsing ${language} code:`, error);
      return null;
    }
  }

  parseFile(filePath: string, sourceCode: string): ParsedFile | null {
    const language = this.detectLanguage(filePath);

    if (!language) {
      return null;
    }

    return this.parseCode(sourceCode, language);
  }

  traverseTree(node: Parser.SyntaxNode, callback: (node: Parser.SyntaxNode) => void) {
    callback(node);

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.traverseTree(child, callback);
      }
    }
  }

  findNodesByType(tree: Parser.Tree, nodeType: string): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];

    this.traverseTree(tree.rootNode, (node) => {
      if (node.type === nodeType) {
        nodes.push(node);
      }
    });

    return nodes;
  }

  getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    return sourceCode.substring(node.startIndex, node.endIndex);
  }

  convertToASTNode(node: Parser.SyntaxNode, sourceCode: string): ASTNode {
    return {
      type: node.type,
      startPosition: {
        row: node.startPosition.row,
        column: node.startPosition.column,
      },
      endPosition: {
        row: node.endPosition.row,
        column: node.endPosition.column,
      },
      text: this.getNodeText(node, sourceCode),
      children: node.children.map((child) => this.convertToASTNode(child, sourceCode)),
    };
  }

  getSupportedLanguages(): string[] {
    return Array.from(this.parsers.keys());
  }
}
