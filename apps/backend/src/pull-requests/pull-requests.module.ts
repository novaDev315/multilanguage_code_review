import { Module } from '@nestjs/common';
import { PullRequestsService } from './pull-requests.service';
import { PullRequestsController } from './pull-requests.controller';

@Module({
  providers: [PullRequestsService],
  controllers: [PullRequestsController],
  exports: [PullRequestsService],
})
export class PullRequestsModule {}
