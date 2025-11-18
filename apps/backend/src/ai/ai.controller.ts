import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AiService, AIAnalysisRequest } from './ai.service';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze code with AI' })
  async analyzeCode(@Body() request: AIAnalysisRequest) {
    return this.aiService.analyzeCode(request);
  }

  @Post('explain')
  @ApiOperation({ summary: 'Explain code with AI' })
  async explainCode(@Body() body: { code: string; language: string }) {
    return {
      explanation: await this.aiService.explainCode(body.code, body.language),
    };
  }
}
