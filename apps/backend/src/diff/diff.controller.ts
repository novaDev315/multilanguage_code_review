import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { DiffService } from './diff.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class GenerateDiffDto {
  original: string;
  modified: string;
}

class GenerateFixPreviewDto {
  originalCode: string;
  lineNumber: number;
  fixCode: string;
  fixDescription: string;
  confidence: number;
}

class ApplyFixesDto {
  originalCode: string;
  fixes: { lineNumber: number; fixCode: string }[];
}

@Controller('diff')
@UseGuards(JwtAuthGuard)
export class DiffController {
  constructor(private readonly diffService: DiffService) {}

  /**
   * Generate diff between two code versions
   */
  @Post('generate')
  generateDiff(@Body() dto: GenerateDiffDto) {
    return this.diffService.generateDiff(dto.original, dto.modified);
  }

  /**
   * Generate a preview of applying a fix
   */
  @Post('fix-preview')
  generateFixPreview(@Body() dto: GenerateFixPreviewDto) {
    return this.diffService.generateFixPreview(
      dto.originalCode,
      dto.lineNumber,
      dto.fixCode,
      dto.fixDescription,
      dto.confidence,
    );
  }

  /**
   * Apply multiple fixes to code
   */
  @Post('apply-fixes')
  applyFixes(@Body() dto: ApplyFixesDto) {
    return this.diffService.applyFixes(dto.originalCode, dto.fixes);
  }

  /**
   * Generate word-level diff
   */
  @Post('word-diff')
  generateWordDiff(@Body() dto: GenerateDiffDto) {
    return this.diffService.generateWordDiff(dto.original, dto.modified);
  }

  /**
   * Get context around a specific line
   */
  @Post('context')
  getLineContext(@Body() dto: { code: string; lineNumber: number; contextLines?: number }) {
    return this.diffService.getLineContext(dto.code, dto.lineNumber, dto.contextLines);
  }
}
