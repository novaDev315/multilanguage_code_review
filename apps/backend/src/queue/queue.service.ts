import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

@Injectable()
export class QueueService implements OnModuleInit {
  private analysisQueue: Queue;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const connection = new Redis({
      host: this.configService.get<string>('QUEUE_REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('QUEUE_REDIS_PORT') || 6379,
      maxRetriesPerRequest: null,
    });

    this.analysisQueue = new Queue('analysis', { connection });

    console.log('✅ Queue service initialized');
  }

  async addAnalysisJob(data: any) {
    return this.analysisQueue.add('analyze-pr', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  getQueue() {
    return this.analysisQueue;
  }
}
