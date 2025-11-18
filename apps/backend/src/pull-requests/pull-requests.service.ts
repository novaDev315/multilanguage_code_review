import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PullRequestsService {
  constructor(private prisma: PrismaService) {}

  async findAll(repositoryId?: string) {
    return this.prisma.pullRequest.findMany({
      where: repositoryId ? { repositoryId } : undefined,
      include: {
        repository: true,
        _count: {
          select: { issues: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findOne(id: string) {
    return this.prisma.pullRequest.findUnique({
      where: { id },
      include: {
        repository: true,
        issues: {
          orderBy: [{ severity: 'asc' }, { lineNumber: 'asc' }],
        },
      },
    });
  }

  async getAnalytics(organizationId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const pullRequests = await this.prisma.pullRequest.findMany({
      where: {
        repository: {
          organizationId,
        },
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      include: {
        issues: true,
      },
    });

    const totalPRs = pullRequests.length;
    const totalIssues = pullRequests.reduce((sum, pr) => sum + pr.issues.length, 0);
    const criticalIssues = pullRequests.reduce(
      (sum, pr) => sum + pr.issues.filter((i) => i.severity === 'critical').length,
      0,
    );

    return {
      totalPRs,
      totalIssues,
      criticalIssues,
      averageIssuesPerPR: totalPRs > 0 ? (totalIssues / totalPRs).toFixed(2) : 0,
    };
  }
}
