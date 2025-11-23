import { Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { TreeSitterService } from './parsers/tree-sitter.service';
import { JavaScriptAnalyzer } from './analyzers/javascript.analyzer';
import { PythonAnalyzer } from './analyzers/python.analyzer';
import { JavaAnalyzer } from './analyzers/java.analyzer';
import { GoAnalyzer } from './analyzers/go.analyzer';
import { RubyAnalyzer } from './analyzers/ruby.analyzer';
import { SecurityAnalyzer } from './analyzers/security.analyzer';
import { PerformanceAnalyzer } from './analyzers/performance.analyzer';
import { MultiLanguageAnalyzer } from './analyzers/multi-language.analyzer';
import { CodeSmellAnalyzer } from './analyzers/code-smell.analyzer';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [
    AnalysisService,
    TreeSitterService,
    JavaScriptAnalyzer,
    PythonAnalyzer,
    JavaAnalyzer,
    GoAnalyzer,
    RubyAnalyzer,
    SecurityAnalyzer,
    PerformanceAnalyzer,
    MultiLanguageAnalyzer,
    CodeSmellAnalyzer,
  ],
  controllers: [AnalysisController],
  exports: [AnalysisService],
})
export class AnalysisModule {}
