import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RepositoriesService } from './repositories.service';

@ApiTags('repositories')
@Controller('repositories')
export class RepositoriesController {
  constructor(private repositoriesService: RepositoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List all repositories' })
  async findAll() {
    // TODO: Get organization from auth context
    return this.repositoriesService.findAll('default-org-id');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get repository by ID' })
  async findOne(@Param('id') id: string) {
    return this.repositoriesService.findOne(id);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Enable/disable repository analysis' })
  async toggleEnabled(@Param('id') id: string, @Body('enabled') enabled: boolean) {
    return this.repositoriesService.toggleEnabled(id, enabled);
  }
}
