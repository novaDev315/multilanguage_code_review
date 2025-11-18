import { CodeIssue, IssueSeverity, IssueCategory } from '../types/analysis.types';

export interface AnalyzerResult {
  issues: CodeIssue[];
  metrics?: {
    complexity?: number;
    maintainability?: number;
    [key: string]: any;
  };
}

export abstract class BaseAnalyzer {
  abstract analyze(sourceCode: string, filePath: string): Promise<AnalyzerResult>;

  protected createIssue(
    filePath: string,
    lineNumber: number,
    severity: IssueSeverity,
    category: IssueCategory,
    message: string,
    ruleId?: string,
    fixSuggestion?: string,
    fixCode?: string,
    endLineNumber?: number,
  ): CodeIssue {
    return {
      filePath,
      lineNumber,
      endLineNumber,
      severity,
      category,
      message,
      ruleId,
      fixSuggestion,
      fixCode,
      confidence: 0.8,
    };
  }

  protected calculateConfidence(factors: {
    syntaxValid?: boolean;
    contextMatches?: boolean;
    patternStrength?: number;
  }): number {
    let confidence = 0.5;

    if (factors.syntaxValid) confidence += 0.2;
    if (factors.contextMatches) confidence += 0.2;
    if (factors.patternStrength) confidence += factors.patternStrength * 0.1;

    return Math.min(confidence, 1.0);
  }
}
