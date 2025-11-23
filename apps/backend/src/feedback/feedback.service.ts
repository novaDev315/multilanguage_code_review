import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

export interface FeedbackSubmission {
  issueId: string;
  userId: string;
  organizationId: string;
  feedbackType: 'false_positive' | 'helpful' | 'not_helpful' | 'incorrect_fix' | 'good_fix';
  comment?: string;
  suggestedFix?: string;
}

export interface FeedbackStats {
  totalFeedback: number;
  falsePositives: number;
  helpfulCount: number;
  notHelpfulCount: number;
  falsePositiveRate: number;
  helpfulRate: number;
}

export interface LearningRule {
  pattern: string;
  ruleId: string;
  language: string;
  organizationId: string;
  skipCount: number;
  lastSkipped: Date;
  reason: string;
}

@Injectable()
export class FeedbackService {
  private readonly FEEDBACK_THRESHOLD = 3; // Number of false positives before learning

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * Submit feedback for a code issue
   */
  async submitFeedback(submission: FeedbackSubmission): Promise<{ success: boolean; message: string }> {
    // Store feedback in database
    const feedback = await this.prisma.issueFeedback.create({
      data: {
        issueId: submission.issueId,
        userId: submission.userId,
        organizationId: submission.organizationId,
        feedbackType: submission.feedbackType,
        comment: submission.comment,
        suggestedFix: submission.suggestedFix,
      },
    });

    // Update the issue's false positive status if applicable
    if (submission.feedbackType === 'false_positive') {
      await this.prisma.codeIssue.update({
        where: { id: submission.issueId },
        data: { isFalsePositive: true },
      });

      // Check if we should learn from this pattern
      await this.checkAndLearnFromFeedback(submission);
    }

    // Update analytics
    await this.updateFeedbackMetrics(submission.organizationId, submission.feedbackType);

    // Invalidate cached analysis for similar patterns
    if (submission.feedbackType === 'false_positive') {
      await this.invalidateRelatedCache(submission.issueId);
    }

    return {
      success: true,
      message: submission.feedbackType === 'false_positive'
        ? 'Thank you! We\'ll learn from this to reduce false positives.'
        : 'Thank you for your feedback!',
    };
  }

  /**
   * Check if a pattern should be skipped based on learned feedback
   */
  async shouldSkipIssue(
    ruleId: string,
    language: string,
    codePattern: string,
    organizationId: string,
  ): Promise<boolean> {
    // Check cache first
    const cacheKey = `learned:${organizationId}:${ruleId}:${this.hashPattern(codePattern)}`;
    const cached = await this.cache.get<boolean>(cacheKey);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    // Check database for learned rules
    const learnedRule = await this.prisma.learnedPattern.findFirst({
      where: {
        organizationId,
        ruleId,
        language,
        isActive: true,
        skipCount: { gte: this.FEEDBACK_THRESHOLD },
      },
    });

    const shouldSkip = !!learnedRule;

    // Cache the result
    await this.cache.set(cacheKey, shouldSkip, 3600); // 1 hour cache

    return shouldSkip;
  }

  /**
   * Get feedback statistics for an organization
   */
  async getFeedbackStats(organizationId: string): Promise<FeedbackStats> {
    const allFeedback = await this.prisma.issueFeedback.findMany({
      where: { organizationId },
    });

    const totalFeedback = allFeedback.length;
    const falsePositives = allFeedback.filter(f => f.feedbackType === 'false_positive').length;
    const helpfulCount = allFeedback.filter(f => f.feedbackType === 'helpful' || f.feedbackType === 'good_fix').length;
    const notHelpfulCount = allFeedback.filter(f => f.feedbackType === 'not_helpful' || f.feedbackType === 'incorrect_fix').length;

    return {
      totalFeedback,
      falsePositives,
      helpfulCount,
      notHelpfulCount,
      falsePositiveRate: totalFeedback > 0 ? (falsePositives / totalFeedback) * 100 : 0,
      helpfulRate: totalFeedback > 0 ? (helpfulCount / totalFeedback) * 100 : 0,
    };
  }

  /**
   * Get learned patterns for an organization
   */
  async getLearnedPatterns(organizationId: string): Promise<LearningRule[]> {
    const patterns = await this.prisma.learnedPattern.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      orderBy: { skipCount: 'desc' },
    });

    return patterns.map(p => ({
      pattern: p.pattern,
      ruleId: p.ruleId,
      language: p.language,
      organizationId: p.organizationId,
      skipCount: p.skipCount,
      lastSkipped: p.updatedAt,
      reason: p.reason || 'User marked as false positive',
    }));
  }

  /**
   * Reset learning for a specific pattern
   */
  async resetLearning(patternId: string, organizationId: string): Promise<void> {
    await this.prisma.learnedPattern.update({
      where: { id: patternId },
      data: {
        isActive: false,
        skipCount: 0,
      },
    });

    // Clear related cache
    await this.cache.delete(`learned:${organizationId}:*`);
  }

  /**
   * Get all feedback for a specific issue
   */
  async getIssueFeedback(issueId: string): Promise<{
    feedbackType: string;
    comment?: string;
    createdAt: Date;
    userId: string;
  }[]> {
    const feedback = await this.prisma.issueFeedback.findMany({
      where: { issueId },
      orderBy: { createdAt: 'desc' },
    });

    return feedback.map(f => ({
      feedbackType: f.feedbackType,
      comment: f.comment || undefined,
      createdAt: f.createdAt,
      userId: f.userId,
    }));
  }

  /**
   * Get suggested rules based on feedback patterns
   */
  async getSuggestedRules(organizationId: string): Promise<{
    suggestedRule: string;
    basedOnFeedback: number;
    pattern: string;
    language: string;
  }[]> {
    // Find patterns that have been marked as false positives multiple times
    const frequentFalsePositives = await this.prisma.issueFeedback.groupBy({
      by: ['issueId'],
      where: {
        organizationId,
        feedbackType: 'false_positive',
      },
      _count: { id: true },
      having: {
        id: { _count: { gte: 2 } },
      },
    });

    const suggestions = [];

    for (const fp of frequentFalsePositives) {
      const issue = await this.prisma.codeIssue.findUnique({
        where: { id: fp.issueId },
      });

      if (issue) {
        suggestions.push({
          suggestedRule: `Suppress: ${issue.ruleId} for similar patterns`,
          basedOnFeedback: fp._count.id,
          pattern: issue.message.substring(0, 100),
          language: issue.language,
        });
      }
    }

    return suggestions;
  }

  /**
   * Export feedback data for analysis
   */
  async exportFeedbackData(organizationId: string): Promise<{
    feedback: any[];
    learnedPatterns: any[];
    stats: FeedbackStats;
  }> {
    const feedback = await this.prisma.issueFeedback.findMany({
      where: { organizationId },
      include: {
        issue: {
          select: {
            filePath: true,
            lineNumber: true,
            severity: true,
            category: true,
            message: true,
            ruleId: true,
            language: true,
          },
        },
      },
    });

    const learnedPatterns = await this.getLearnedPatterns(organizationId);
    const stats = await this.getFeedbackStats(organizationId);

    return {
      feedback,
      learnedPatterns,
      stats,
    };
  }

  /**
   * Check and learn from feedback patterns
   */
  private async checkAndLearnFromFeedback(submission: FeedbackSubmission): Promise<void> {
    // Get the issue details
    const issue = await this.prisma.codeIssue.findUnique({
      where: { id: submission.issueId },
    });

    if (!issue || !issue.ruleId) return;

    // Count similar false positives
    const similarFalsePositives = await this.prisma.issueFeedback.count({
      where: {
        organizationId: submission.organizationId,
        feedbackType: 'false_positive',
        issue: {
          ruleId: issue.ruleId,
          language: issue.language,
        },
      },
    });

    // If threshold reached, create or update learned pattern
    if (similarFalsePositives >= this.FEEDBACK_THRESHOLD) {
      await this.prisma.learnedPattern.upsert({
        where: {
          organizationId_ruleId_language: {
            organizationId: submission.organizationId,
            ruleId: issue.ruleId,
            language: issue.language,
          },
        },
        create: {
          organizationId: submission.organizationId,
          ruleId: issue.ruleId,
          language: issue.language,
          pattern: issue.message.substring(0, 255),
          skipCount: similarFalsePositives,
          reason: `Automatically learned from ${similarFalsePositives} user reports`,
          isActive: true,
        },
        update: {
          skipCount: similarFalsePositives,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    }
  }

  /**
   * Update feedback metrics in analytics
   */
  private async updateFeedbackMetrics(organizationId: string, feedbackType: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.analysisMetric.upsert({
      where: {
        organizationId_date: {
          organizationId,
          date: today,
        },
      },
      create: {
        organizationId,
        date: today,
        falsePositiveReports: feedbackType === 'false_positive' ? 1 : 0,
      },
      update: {
        falsePositiveReports: feedbackType === 'false_positive'
          ? { increment: 1 }
          : undefined,
      },
    });
  }

  /**
   * Invalidate cache for related patterns
   */
  private async invalidateRelatedCache(issueId: string): Promise<void> {
    const issue = await this.prisma.codeIssue.findUnique({
      where: { id: issueId },
    });

    if (issue) {
      // Clear analysis cache for similar patterns
      await this.cache.delete(`analysis:${issue.language}:*`);
    }
  }

  /**
   * Create a simple hash for pattern matching
   */
  private hashPattern(pattern: string): string {
    let hash = 0;
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}
