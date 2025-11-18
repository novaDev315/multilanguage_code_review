import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateRuleDto {
  name: string;
  description?: string;
  language: string;
  pattern: string;
  severity: string;
  category: string;
  message: string;
  fixTemplate?: string;
}

@Injectable()
export class RulesService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.customRule.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.customRule.findUnique({
      where: { id },
    });
  }

  async create(organizationId: string, dto: CreateRuleDto) {
    return this.prisma.customRule.create({
      data: {
        ...dto,
        organizationId,
      },
    });
  }

  async update(id: string, dto: Partial<CreateRuleDto>) {
    return this.prisma.customRule.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string) {
    return this.prisma.customRule.delete({
      where: { id },
    });
  }

  async toggleEnabled(id: string, enabled: boolean) {
    return this.prisma.customRule.update({
      where: { id },
      data: { enabled },
    });
  }
}
