import { Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { TreeSitterService } from './parsers/tree-sitter.service';
import { JavaScriptAnalyzer } from './analyzers/javascript.analyzer';
import { PythonAnalyzer } from './analyzers/python.analyzer';
import { SecurityAnalyzer } from './analyzers/security.analyzer';
import { PerformanceAnalyzer } from './analyzers/performance.analyzer';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [
    AnalysisService,
    TreeSitterService,
    JavaScriptAnalyzer,
    PythonAnalyzer,
    SecurityAnalyzer,
    PerformanceAnalyzer,
  ],
  controllers: [AnalysisController],
  exports: [AnalysisService],
})
export class AnalysisModule {}
