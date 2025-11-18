import { Module } from '@nestjs/common';
import { GitLabService } from './gitlab.service';
import { GitLabController } from './gitlab.controller';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
  imports: [AnalysisModule],
  providers: [GitLabService],
  controllers: [GitLabController],
  exports: [GitLabService],
})
export class GitLabModule {}
