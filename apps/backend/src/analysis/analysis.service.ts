import { Injectable } from '@nestjs/common';
import { TreeSitterService } from './parsers/tree-sitter.service';
import { JavaScriptAnalyzer } from './analyzers/javascript.analyzer';
import { PythonAnalyzer } from './analyzers/python.analyzer';
import { SecurityAnalyzer } from './analyzers/security.analyzer';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AnalysisRequest,
  AnalysisResult,
  CodeIssue,
  FileChange,
} from './types/analysis.types';

@Injectable()
export class AnalysisService {
  constructor(
    private treeSitterService: TreeSitterService,
    private jsAnalyzer: JavaScriptAnalyzer,
    private pythonAnalyzer: PythonAnalyzer,
    private securityAnalyzer: SecurityAnalyzer,
    private aiService: AiService,
    private prisma: PrismaService,
  ) {}

  async analyzePullRequest(request: AnalysisRequest): Promise<AnalysisResult> {
    const startTime = Date.now();
    const allIssues: CodeIssue[] = [];

    // Process each file
    for (const file of request.files) {
      if (file.status === 'deleted') continue;

      const fileIssues = await this.analyzeFile(file);
      allIssues.push(...fileIssues);
    }

    const analysisTime = Date.now() - startTime;

    // Create or update pull request record
    const pr = await this.prisma.pullRequest.upsert({
      where: {
        repositoryId_prNumber: {
          repositoryId: request.repositoryId,
          prNumber: request.prNumber,
        },
      },
      create: {
        repositoryId: request.repositoryId,
        prNumber: request.prNumber,
        title: `PR #${request.prNumber}`,
        status: 'open',
        sourceBranch: request.headBranch,
        targetBranch: request.baseBranch,
        issueCount: allIssues.length,
        linesChanged: request.files.reduce((sum, f) => sum + f.additions + f.deletions, 0),
        linesAdded: request.files.reduce((sum, f) => sum + f.additions, 0),
        linesDeleted: request.files.reduce((sum, f) => sum + f.deletions, 0),
        filesChanged: request.files.length,
        analyzedAt: new Date(),
        analysisStatus: 'completed',
      },
      update: {
        issueCount: allIssues.length,
        analyzedAt: new Date(),
        analysisStatus: 'completed',
      },
    });

    // Store issues in database
    await this.storeIssues(pr.id, allIssues);

    // Generate summary
    const summary = this.generateSummary(allIssues, request.files, analysisTime);

    return {
      pullRequestId: pr.id,
      issues: allIssues,
      summary,
    };
  }

  private async analyzeFile(file: FileChange): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    const language = this.treeSitterService.detectLanguage(file.filePath);

    if (!language) {
      return issues;
    }

    // Run static analyzers
    if (['javascript', 'typescript', 'jsx', 'tsx'].includes(language)) {
      const result = await this.jsAnalyzer.analyze(file.content, file.filePath);
      issues.push(...result.issues);
    } else if (language === 'python') {
      const result = await this.pythonAnalyzer.analyze(file.content, file.filePath);
      issues.push(...result.issues);
    }

    // Run security analyzer
    const securityIssues = this.securityAnalyzer.analyze(
      file.content,
      file.filePath,
      language,
    );
    issues.push(...securityIssues);

    // Run AI analysis for critical files or if there are significant changes
    if (file.additions > 50 || issues.filter((i) => i.severity === 'critical').length > 0) {
      try {
        const aiResult = await this.aiService.analyzeCode({
          code: file.content,
          language,
          filePath: file.filePath,
          context: `This file has ${file.additions} additions and ${file.deletions} deletions`,
        });
        issues.push(...aiResult.issues);
      } catch (error) {
        console.error('AI analysis failed:', error);
      }
    }

    // Deduplicate issues
    return this.deduplicateIssues(issues);
  }

  private deduplicateIssues(issues: CodeIssue[]): CodeIssue[] {
    const seen = new Set<string>();
    return issues.filter((issue) => {
      const key = `${issue.filePath}:${issue.lineNumber}:${issue.message}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private async storeIssues(pullRequestId: string, issues: CodeIssue[]): Promise<void> {
    // Delete existing issues
    await this.prisma.codeIssue.deleteMany({
      where: { pullRequestId },
    });

    // Create new issues
    await this.prisma.codeIssue.createMany({
      data: issues.map((issue) => ({
        pullRequestId,
        filePath: issue.filePath,
        lineNumber: issue.lineNumber,
        endLineNumber: issue.endLineNumber,
        severity: issue.severity,
        category: issue.category,
        message: issue.message,
        fixSuggestion: issue.fixSuggestion,
        fixCode: issue.fixCode,
        ruleId: issue.ruleId,
        language: issue.language || 'unknown',
        confidence: issue.confidence,
      })),
    });
  }

  private generateSummary(
    issues: CodeIssue[],
    files: FileChange[],
    analysisTime: number,
  ): AnalysisResult['summary'] {
    const criticalIssues = issues.filter((i) => i.severity === 'critical').length;
    const highIssues = issues.filter((i) => i.severity === 'high').length;
    const mediumIssues = issues.filter((i) => i.severity === 'medium').length;
    const lowIssues = issues.filter((i) => i.severity === 'low').length;

    return {
      totalIssues: issues.length,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      filesAnalyzed: files.length,
      linesAnalyzed: files.reduce((sum, f) => sum + f.additions + f.deletions, 0),
      analysisTime,
    };
  }

  async getIssuesByPullRequest(pullRequestId: string): Promise<CodeIssue[]> {
    const issues = await this.prisma.codeIssue.findMany({
      where: { pullRequestId },
      orderBy: [{ severity: 'asc' }, { lineNumber: 'asc' }],
    });

    return issues.map((issue) => ({
      filePath: issue.filePath,
      lineNumber: issue.lineNumber,
      endLineNumber: issue.endLineNumber,
      severity: issue.severity as any,
      category: issue.category as any,
      message: issue.message,
      fixSuggestion: issue.fixSuggestion,
      fixCode: issue.fixCode,
      ruleId: issue.ruleId,
      confidence: issue.confidence,
      language: issue.language,
    }));
  }
}
