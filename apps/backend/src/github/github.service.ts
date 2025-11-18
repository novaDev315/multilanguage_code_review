import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import { PrismaService } from '../prisma/prisma.service';
import { AnalysisService } from '../analysis/analysis.service';
import { CodeIssue } from '../analysis/types/analysis.types';

export interface PullRequestWebhookPayload {
  action: string;
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    state: string;
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
      sha: string;
    };
    user: {
      login: string;
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
}

@Injectable()
export class GithubService {
  private octokit: Octokit;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private analysisService: AnalysisService,
  ) {
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (token) {
      this.octokit = new Octokit({ auth: token });
    }
  }

  async handlePullRequestWebhook(payload: PullRequestWebhookPayload): Promise<void> {
    const { action, pull_request, repository } = payload;

    // Only process opened and synchronize events
    if (!['opened', 'synchronize', 'reopened'].includes(action)) {
      return;
    }

    console.log(`Processing PR #${pull_request.number} for ${repository.full_name}`);

    // Get or create repository
    const repo = await this.getOrCreateRepository(repository);

    // Fetch PR files
    const files = await this.getPullRequestFiles(
      repository.owner.login,
      repository.name,
      pull_request.number,
    );

    // Analyze the PR
    const analysis = await this.analysisService.analyzePullRequest({
      repositoryId: repo.id,
      prNumber: pull_request.number,
      files,
      baseBranch: pull_request.base.ref,
      headBranch: pull_request.head.ref,
    });

    // Post comments on the PR
    await this.postReviewComments(
      repository.owner.login,
      repository.name,
      pull_request.number,
      pull_request.head.sha,
      analysis.issues,
    );

    // Update PR status check
    await this.updateStatusCheck(
      repository.owner.login,
      repository.name,
      pull_request.head.sha,
      analysis.issues,
    );

    console.log(`Completed analysis for PR #${pull_request.number}`);
  }

  private async getOrCreateRepository(repoData: any) {
    return this.prisma.repository.upsert({
      where: {
        platform_platformRepoId: {
          platform: 'github',
          platformRepoId: repoData.id,
        },
      },
      create: {
        name: repoData.name,
        fullName: repoData.full_name,
        platform: 'github',
        platformRepoId: repoData.id,
        enabled: true,
        organizationId: 'default-org-id', // TODO: Get from user/org context
      },
      update: {
        name: repoData.name,
        fullName: repoData.full_name,
      },
    });
  }

  private async getPullRequestFiles(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<any[]> {
    try {
      const { data: files } = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
      });

      const fileContents = await Promise.all(
        files.map(async (file) => {
          // Skip deleted files
          if (file.status === 'removed') {
            return {
              filePath: file.filename,
              content: '',
              status: 'deleted' as const,
              additions: 0,
              deletions: file.deletions,
            };
          }

          // Fetch file content
          try {
            const { data: content } = await this.octokit.repos.getContent({
              owner,
              repo,
              path: file.filename,
              ref: `refs/pull/${prNumber}/head`,
            });

            if ('content' in content) {
              const decoded = Buffer.from(content.content, 'base64').toString('utf-8');
              return {
                filePath: file.filename,
                content: decoded,
                status: file.status as 'added' | 'modified',
                additions: file.additions,
                deletions: file.deletions,
              };
            }
          } catch (error) {
            console.error(`Error fetching file ${file.filename}:`, error);
          }

          return null;
        }),
      );

      return fileContents.filter(Boolean);
    } catch (error) {
      console.error('Error fetching PR files:', error);
      return [];
    }
  }

  private async postReviewComments(
    owner: string,
    repo: string,
    prNumber: number,
    commitSha: string,
    issues: CodeIssue[],
  ): Promise<void> {
    // Group issues by file
    const issuesByFile = issues.reduce((acc, issue) => {
      if (!acc[issue.filePath]) {
        acc[issue.filePath] = [];
      }
      acc[issue.filePath].push(issue);
      return acc;
    }, {} as Record<string, CodeIssue[]>);

    // Create review comments
    const comments = [];

    for (const [filePath, fileIssues] of Object.entries(issuesByFile)) {
      for (const issue of fileIssues) {
        const emoji = this.getSeverityEmoji(issue.severity);
        const body = this.formatIssueComment(issue, emoji);

        comments.push({
          path: filePath,
          line: issue.lineNumber,
          side: 'RIGHT' as const,
          body,
        });
      }
    }

    // Post review comments in batches
    const batchSize = 30;
    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize);

      try {
        await this.octokit.pulls.createReview({
          owner,
          repo,
          pull_number: prNumber,
          commit_id: commitSha,
          event: 'COMMENT',
          comments: batch,
        });
      } catch (error) {
        console.error('Error posting review comments:', error);
      }
    }

    // Post summary comment
    await this.postSummaryComment(owner, repo, prNumber, issues);
  }

  private formatIssueComment(issue: CodeIssue, emoji: string): string {
    let comment = `${emoji} **${issue.severity.toUpperCase()}** - ${issue.category}\n\n`;
    comment += `${issue.message}\n\n`;

    if (issue.fixSuggestion) {
      comment += `**Suggested Fix:**\n${issue.fixSuggestion}\n\n`;
    }

    if (issue.fixCode) {
      comment += `\`\`\`suggestion\n${issue.fixCode}\n\`\`\`\n`;
    }

    comment += `\n*Confidence: ${(issue.confidence * 100).toFixed(0)}%*`;

    return comment;
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'high':
        return '🟠';
      case 'medium':
        return '🟡';
      case 'low':
        return '🔵';
      default:
        return 'ℹ️';
    }
  }

  private async postSummaryComment(
    owner: string,
    repo: string,
    prNumber: number,
    issues: CodeIssue[],
  ): Promise<void> {
    const criticalCount = issues.filter((i) => i.severity === 'critical').length;
    const highCount = issues.filter((i) => i.severity === 'high').length;
    const mediumCount = issues.filter((i) => i.severity === 'medium').length;
    const lowCount = issues.filter((i) => i.severity === 'low').length;

    let summary = '## 🤖 AI Code Review Summary\n\n';
    summary += `**Total Issues Found:** ${issues.length}\n\n`;
    summary += '| Severity | Count |\n';
    summary += '|----------|-------|\n';
    summary += `| 🔴 Critical | ${criticalCount} |\n`;
    summary += `| 🟠 High | ${highCount} |\n`;
    summary += `| 🟡 Medium | ${mediumCount} |\n`;
    summary += `| 🔵 Low | ${lowCount} |\n\n`;

    if (criticalCount > 0 || highCount > 0) {
      summary += '⚠️ **Action Required:** Please address critical and high severity issues before merging.\n\n';
    } else {
      summary += '✅ **Looking Good:** No critical or high severity issues found!\n\n';
    }

    summary += '\n*Powered by AI Code Review*';

    try {
      await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: summary,
      });
    } catch (error) {
      console.error('Error posting summary comment:', error);
    }
  }

  private async updateStatusCheck(
    owner: string,
    repo: string,
    sha: string,
    issues: CodeIssue[],
  ): Promise<void> {
    const criticalCount = issues.filter((i) => i.severity === 'critical').length;
    const highCount = issues.filter((i) => i.severity === 'high').length;

    const state = criticalCount > 0 ? 'failure' : highCount > 0 ? 'failure' : 'success';
    const description =
      state === 'success'
        ? `✅ No critical issues found`
        : `⚠️ Found ${criticalCount} critical and ${highCount} high severity issues`;

    try {
      await this.octokit.repos.createCommitStatus({
        owner,
        repo,
        sha,
        state,
        description,
        context: 'AI Code Review',
        target_url: `https://your-dashboard.com/analysis/${sha}`,
      });
    } catch (error) {
      console.error('Error updating status check:', error);
    }
  }

  async verifyWebhookSignature(payload: string, signature: string): boolean {
    const crypto = require('crypto');
    const secret = this.configService.get<string>('GITHUB_WEBHOOK_SECRET');

    if (!secret) {
      return false;
    }

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }
}
