import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RepositoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.repository.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.repository.findUnique({
      where: { id },
      include: {
        pullRequests: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async toggleEnabled(id: string, enabled: boolean) {
    return this.prisma.repository.update({
      where: { id },
      data: { enabled },
    });
  }
}
