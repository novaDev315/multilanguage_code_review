import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { AnalysisService } from '../analysis/analysis.service';
import { CodeIssue } from '../analysis/types/analysis.types';

export interface GitLabMergeRequestPayload {
  object_kind: string;
  event_type: string;
  object_attributes: {
    id: number;
    iid: number;
    title: string;
    state: string;
    source_branch: string;
    target_branch: string;
    last_commit: {
      id: string;
    };
  };
  project: {
    id: number;
    name: string;
    path_with_namespace: string;
  };
  user: {
    username: string;
  };
}

@Injectable()
export class GitLabService {
  private client: AxiosInstance;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private analysisService: AnalysisService,
  ) {
    const token = this.configService.get<string>('GITLAB_TOKEN');
    const baseUrl = this.configService.get<string>('GITLAB_URL') || 'https://gitlab.com';

    this.client = axios.create({
      baseURL: `${baseUrl}/api/v4`,
      headers: {
        'PRIVATE-TOKEN': token,
      },
    });
  }

  async handleMergeRequestWebhook(payload: GitLabMergeRequestPayload): Promise<void> {
    const { object_attributes, project } = payload;

    // Only process opened and updated events
    if (!['open', 'update', 'reopen'].includes(object_attributes.state)) {
      return;
    }

    console.log(`Processing MR !${object_attributes.iid} for ${project.path_with_namespace}`);

    // Get or create repository
    const repo = await this.getOrCreateRepository(project);

    // Fetch MR changes
    const changes = await this.getMergeRequestChanges(
      project.id,
      object_attributes.iid,
    );

    // Analyze the MR
    const analysis = await this.analysisService.analyzePullRequest({
      repositoryId: repo.id,
      prNumber: object_attributes.iid,
      files: changes,
      baseBranch: object_attributes.target_branch,
      headBranch: object_attributes.source_branch,
    });

    // Post comments on the MR
    await this.postMergeRequestNotes(
      project.id,
      object_attributes.iid,
      analysis.issues,
    );

    console.log(`Completed analysis for MR !${object_attributes.iid}`);
  }

  private async getOrCreateRepository(projectData: any) {
    return this.prisma.repository.upsert({
      where: {
        platform_platformRepoId: {
          platform: 'gitlab',
          platformRepoId: projectData.id,
        },
      },
      create: {
        name: projectData.name,
        fullName: projectData.path_with_namespace,
        platform: 'gitlab',
        platformRepoId: projectData.id,
        enabled: true,
        organizationId: 'default-org-id',
      },
      update: {
        name: projectData.name,
        fullName: projectData.path_with_namespace,
      },
    });
  }

  private async getMergeRequestChanges(projectId: number, mrIid: number): Promise<any[]> {
    try {
      const { data: changes } = await this.client.get(
        `/projects/${projectId}/merge_requests/${mrIid}/changes`,
      );

      const fileContents = await Promise.all(
        changes.changes.map(async (change: any) => {
          if (change.deleted_file) {
            return {
              filePath: change.old_path,
              content: '',
              status: 'deleted' as const,
              additions: 0,
              deletions: 0,
            };
          }

          // Fetch file content
          try {
            const { data: file } = await this.client.get(
              `/projects/${projectId}/repository/files/${encodeURIComponent(change.new_path)}`,
              {
                params: {
                  ref: changes.diff_refs.head_sha,
                },
              },
            );

            const content = Buffer.from(file.content, 'base64').toString('utf-8');

            return {
              filePath: change.new_path,
              content,
              status: change.new_file ? ('added' as const) : ('modified' as const),
              additions: (change.diff.match(/^\+/gm) || []).length,
              deletions: (change.diff.match(/^-/gm) || []).length,
            };
          } catch (error) {
            console.error(`Error fetching file ${change.new_path}:`, error);
            return null;
          }
        }),
      );

      return fileContents.filter(Boolean);
    } catch (error) {
      console.error('Error fetching MR changes:', error);
      return [];
    }
  }

  private async postMergeRequestNotes(
    projectId: number,
    mrIid: number,
    issues: CodeIssue[],
  ): Promise<void> {
    // Post summary note
    const summary = this.generateSummary(issues);

    try {
      await this.client.post(
        `/projects/${projectId}/merge_requests/${mrIid}/notes`,
        {
          body: summary,
        },
      );

      // Post individual file comments (limited to most critical)
      const criticalIssues = issues
        .filter((i) => ['critical', 'high'].includes(i.severity))
        .slice(0, 20);

      for (const issue of criticalIssues) {
        const comment = this.formatIssueComment(issue);

        await this.client.post(
          `/projects/${projectId}/merge_requests/${mrIid}/discussions`,
          {
            body: comment,
            position: {
              base_sha: '', // Would need to fetch from MR
              start_sha: '',
              head_sha: '',
              position_type: 'text',
              new_path: issue.filePath,
              new_line: issue.lineNumber,
            },
          },
        );
      }
    } catch (error) {
      console.error('Error posting MR notes:', error);
    }
  }

  private generateSummary(issues: CodeIssue[]): string {
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

    return summary;
  }

  private formatIssueComment(issue: CodeIssue): string {
    const emoji = this.getSeverityEmoji(issue.severity);

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

  async verifyWebhookToken(token: string): boolean {
    const secret = this.configService.get<string>('GITLAB_WEBHOOK_SECRET');
    return token === secret;
  }
}
