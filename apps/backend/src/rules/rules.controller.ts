import { Controller, Get, Post, Put, Delete, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RulesService, CreateRuleDto } from './rules.service';

@ApiTags('rules')
@Controller('rules')
export class RulesController {
  constructor(private rulesService: RulesService) {}

  @Get()
  @ApiOperation({ summary: 'List all custom rules' })
  async findAll() {
    // TODO: Get organization from auth context
    return this.rulesService.findAll('default-org-id');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get rule by ID' })
  async findOne(@Param('id') id: string) {
    return this.rulesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom rule' })
  async create(@Body() dto: CreateRuleDto) {
    // TODO: Get organization from auth context
    return this.rulesService.create('default-org-id', dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a custom rule' })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateRuleDto>) {
    return this.rulesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a custom rule' })
  async delete(@Param('id') id: string) {
    return this.rulesService.delete(id);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Enable/disable a rule' })
  async toggleEnabled(@Param('id') id: string, @Body('enabled') enabled: boolean) {
    return this.rulesService.toggleEnabled(id, enabled);
  }
}
