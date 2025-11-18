import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnalysisService } from './analysis.service';
import { AnalysisRequest } from './types/analysis.types';

@ApiTags('analysis')
@Controller('analysis')
export class AnalysisController {
  constructor(private analysisService: AnalysisService) {}

  @Post('pull-request')
  @ApiOperation({ summary: 'Analyze a pull request' })
  async analyzePullRequest(@Body() request: AnalysisRequest) {
    return this.analysisService.analyzePullRequest(request);
  }

  @Get('pull-request/:id/issues')
  @ApiOperation({ summary: 'Get issues for a pull request' })
  async getIssues(@Param('id') pullRequestId: string) {
    return this.analysisService.getIssuesByPullRequest(pullRequestId);
  }
}
