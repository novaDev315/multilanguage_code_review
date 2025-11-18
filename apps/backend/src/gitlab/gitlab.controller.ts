import { Controller, Post, Body, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GitLabService, GitLabMergeRequestPayload } from './gitlab.service';

@ApiTags('webhooks')
@Controller('webhooks/gitlab')
export class GitLabController {
  constructor(private gitlabService: GitLabService) {}

  @Post()
  @ApiOperation({ summary: 'GitLab webhook handler' })
  async handleWebhook(
    @Headers('x-gitlab-token') token: string,
    @Headers('x-gitlab-event') event: string,
    @Body() payload: any,
  ) {
    // Verify webhook token
    const isValid = await this.gitlabService.verifyWebhookToken(token);

    if (!isValid) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }

    // Handle merge request events
    if (event === 'Merge Request Hook') {
      await this.gitlabService.handleMergeRequestWebhook(
        payload as GitLabMergeRequestPayload,
      );
    }

    return { received: true };
  }
}
