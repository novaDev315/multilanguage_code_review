import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AnalysisModule } from './analysis/analysis.module';
import { GithubModule } from './github/github.module';
import { GitLabModule } from './gitlab/gitlab.module';
import { RulesModule } from './rules/rules.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { PullRequestsModule } from './pull-requests/pull-requests.module';
import { AiModule } from './ai/ai.module';
import { CacheModule } from './cache/cache.module';
import { QueueModule } from './queue/queue.module';
import { HealthModule } from './health/health.module';
import { SecurityModule } from './security/security.module';
import { FeedbackModule } from './feedback/feedback.module';
import { DiffModule } from './diff/diff.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    AnalysisModule,
    GithubModule,
    GitLabModule,
    RulesModule,
    RepositoriesModule,
    PullRequestsModule,
    AiModule,
    CacheModule,
    QueueModule,
    HealthModule,
    SecurityModule,
    FeedbackModule,
    DiffModule,
  ],
})
export class AppModule {}
