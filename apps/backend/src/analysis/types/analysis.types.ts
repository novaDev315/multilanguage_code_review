export enum IssueSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum IssueCategory {
  BUG = 'bug',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  STYLE = 'style',
  COMPLEXITY = 'complexity',
  MAINTAINABILITY = 'maintainability',
  BEST_PRACTICE = 'best_practice',
  ERROR_HANDLING = 'error_handling',
  MEMORY = 'memory',
  TYPE_SAFETY = 'type_safety',
  CODE_SMELL = 'code_smell',
  DEPENDENCY = 'dependency',
}

export interface CodeIssue {
  filePath: string;
  lineNumber: number;
  endLineNumber?: number;
  severity: IssueSeverity;
  category: IssueCategory;
  message: string;
  ruleId?: string;
  fixSuggestion?: string;
  fixCode?: string;
  confidence: number;
  language?: string;
}

export interface AnalysisRequest {
  repositoryId: string;
  prNumber: number;
  files: FileChange[];
  baseBranch: string;
  headBranch: string;
}

export interface FileChange {
  filePath: string;
  content: string;
  previousContent?: string;
  status: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
}

export interface AnalysisResult {
  pullRequestId: string;
  issues: CodeIssue[];
  summary: {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    filesAnalyzed: number;
    linesAnalyzed: number;
    analysisTime: number;
  };
  metrics?: {
    averageComplexity?: number;
    securityScore?: number;
    performanceScore?: number;
  };
}
