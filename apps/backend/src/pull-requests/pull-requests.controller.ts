import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PullRequestsService } from './pull-requests.service';

@ApiTags('pull-requests')
@Controller('pull-requests')
export class PullRequestsController {
  constructor(private pullRequestsService: PullRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'List all pull requests' })
  async findAll(@Query('repositoryId') repositoryId?: string) {
    return this.pullRequestsService.findAll(repositoryId);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get pull request analytics' })
  async getAnalytics() {
    // TODO: Get organization from auth context
    return this.pullRequestsService.getAnalytics('default-org-id');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pull request by ID' })
  async findOne(@Param('id') id: string) {
    return this.pullRequestsService.findOne(id);
  }
}
