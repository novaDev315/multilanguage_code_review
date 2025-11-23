import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class SubmitFeedbackDto {
  issueId: string;
  userId: string;
  organizationId: string;
  feedbackType: 'false_positive' | 'helpful' | 'not_helpful' | 'incorrect_fix' | 'good_fix';
  comment?: string;
  suggestedFix?: string;
}

@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /**
   * Submit feedback for an issue
   */
  @Post()
  async submitFeedback(@Body() dto: SubmitFeedbackDto) {
    return this.feedbackService.submitFeedback(dto);
  }

  /**
   * Get feedback statistics for an organization
   */
  @Get('stats/:organizationId')
  async getStats(@Param('organizationId') organizationId: string) {
    return this.feedbackService.getFeedbackStats(organizationId);
  }

  /**
   * Get all feedback for a specific issue
   */
  @Get('issue/:issueId')
  async getIssueFeedback(@Param('issueId') issueId: string) {
    return this.feedbackService.getIssueFeedback(issueId);
  }

  /**
   * Get learned patterns for an organization
   */
  @Get('learned/:organizationId')
  async getLearnedPatterns(@Param('organizationId') organizationId: string) {
    return this.feedbackService.getLearnedPatterns(organizationId);
  }

  /**
   * Reset a learned pattern
   */
  @Delete('learned/:patternId')
  async resetLearning(
    @Param('patternId') patternId: string,
    @Query('organizationId') organizationId: string,
  ) {
    await this.feedbackService.resetLearning(patternId, organizationId);
    return { success: true, message: 'Learning reset successfully' };
  }

  /**
   * Get suggested rules based on feedback
   */
  @Get('suggestions/:organizationId')
  async getSuggestedRules(@Param('organizationId') organizationId: string) {
    return this.feedbackService.getSuggestedRules(organizationId);
  }

  /**
   * Export feedback data
   */
  @Get('export/:organizationId')
  async exportFeedback(@Param('organizationId') organizationId: string) {
    return this.feedbackService.exportFeedbackData(organizationId);
  }
}
