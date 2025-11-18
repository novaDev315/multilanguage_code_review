import { Controller, Post, Body, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GithubService, PullRequestWebhookPayload } from './github.service';

@ApiTags('webhooks')
@Controller('webhooks/github')
export class GithubController {
  constructor(private githubService: GithubService) {}

  @Post()
  @ApiOperation({ summary: 'GitHub webhook handler' })
  async handleWebhook(
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
    @Body() payload: any,
  ) {
    // Verify webhook signature
    const rawBody = JSON.stringify(payload);
    const isValid = await this.githubService.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
    }

    // Handle pull request events
    if (event === 'pull_request') {
      await this.githubService.handlePullRequestWebhook(
        payload as PullRequestWebhookPayload,
      );
    }

    return { received: true };
  }
}
