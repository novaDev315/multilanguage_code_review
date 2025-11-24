import { Injectable } from '@nestjs/common';
import { TreeSitterService } from './parsers/tree-sitter.service';
import { JavaScriptAnalyzer } from './analyzers/javascript.analyzer';
import { PythonAnalyzer } from './analyzers/python.analyzer';
import { JavaAnalyzer } from './analyzers/java.analyzer';
import { GoAnalyzer } from './analyzers/go.analyzer';
import { RubyAnalyzer } from './analyzers/ruby.analyzer';
import { SecurityAnalyzer } from './analyzers/security.analyzer';
import { PerformanceAnalyzer } from './analyzers/performance.analyzer';
import { MultiLanguageAnalyzer } from './analyzers/multi-language.analyzer';
import { CodeSmellAnalyzer } from './analyzers/code-smell.analyzer';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { DependencyScannerService } from '../security/dependency-scanner.service';
import { FeedbackService } from '../feedback/feedback.service';
import * as crypto from 'crypto';
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
    private javaAnalyzer: JavaAnalyzer,
    private goAnalyzer: GoAnalyzer,
    private rubyAnalyzer: RubyAnalyzer,
    private securityAnalyzer: SecurityAnalyzer,
    private performanceAnalyzer: PerformanceAnalyzer,
    private multiLangAnalyzer: MultiLanguageAnalyzer,
    private codeSmellAnalyzer: CodeSmellAnalyzer,
    private dependencyScanner: DependencyScannerService,
    private feedbackService: FeedbackService,
    private aiService: AiService,
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async analyzePullRequest(request: AnalysisRequest): Promise<AnalysisResult> {
    const startTime = Date.now();
    const allIssues: CodeIssue[] = [];

    // Scan for dependency vulnerabilities first
    const dependencyIssues = await this.dependencyScanner.scanDependencies(
      request.files.map(f => ({ filePath: f.filePath, content: f.content }))
    );
    allIssues.push(...dependencyIssues);

    // Process files in batches for large PRs
    const batchSize = 10;
    const filesToAnalyze = request.files.filter((f) => f.status !== 'deleted');

    for (let i = 0; i < filesToAnalyze.length; i += batchSize) {
      const batch = filesToAnalyze.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((file) => this.analyzeFile(file)),
      );

      batchResults.forEach((fileIssues) => {
        allIssues.push(...fileIssues);
      });
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

    // Check cache first
    const cacheKey = this.generateCacheKey(file.content, language);
    const cachedResult = await this.cache.get<CodeIssue[]>(`analysis:${cacheKey}`);

    if (cachedResult) {
      return cachedResult.map(issue => ({ ...issue, filePath: file.filePath }));
    }

    // Run language-specific analyzers
    if (['javascript', 'typescript', 'jsx', 'tsx'].includes(language)) {
      const result = await this.jsAnalyzer.analyze(file.content, file.filePath);
      issues.push(...result.issues);
    } else if (language === 'python') {
      const result = await this.pythonAnalyzer.analyze(file.content, file.filePath);
      issues.push(...result.issues);
    } else if (language === 'java') {
      const result = await this.javaAnalyzer.analyze(file.content, file.filePath);
      issues.push(...result.issues);
    } else if (language === 'go') {
      const result = await this.goAnalyzer.analyze(file.content, file.filePath);
      issues.push(...result.issues);
    } else if (language === 'ruby') {
      const result = await this.rubyAnalyzer.analyze(file.content, file.filePath);
      issues.push(...result.issues);
    } else if (['php', 'csharp', 'rust', 'swift', 'kotlin'].includes(language)) {
      const result = await this.multiLangAnalyzer.analyze(file.content, file.filePath);
      issues.push(...result.issues);
    }

    // Run code smell analyzer (works for all languages)
    const codeSmellResult = await this.codeSmellAnalyzer.analyze(file.content, file.filePath);
    issues.push(...codeSmellResult.issues);

    // Run performance analyzer (works for all languages)
    const perfResult = await this.performanceAnalyzer.analyze(file.content, file.filePath);
    issues.push(...perfResult.issues);

    // Run security analyzer (works for all languages)
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
    const deduped = this.deduplicateIssues(issues);

    // Cache result for 1 hour
    await this.cache.set(`analysis:${cacheKey}`, deduped, 3600);

    return deduped;
  }

  private generateCacheKey(content: string, language: string): string {
    const hash = crypto.createHash('md5').update(content).digest('hex');
    return `${language}:${hash}`;
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
