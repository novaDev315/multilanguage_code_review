import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class HealthService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  async detailedCheck() {
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'unknown',
      redis: 'unknown',
      memory: this.getMemoryUsage(),
    };

    // Check database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'connected';
    } catch (error) {
      checks.database = 'disconnected';
      checks.status = 'degraded';
    }

    // Check Redis
    try {
      await this.cache.set('health:check', 'ok', 10);
      const result = await this.cache.get('health:check');
      checks.redis = result === 'ok' ? 'connected' : 'disconnected';
    } catch (error) {
      checks.redis = 'disconnected';
      checks.status = 'degraded';
    }

    return checks;
  }

  private getMemoryUsage() {
    const used = process.memoryUsage();
    return {
      rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(used.external / 1024 / 1024)}MB`,
    };
  }
}
