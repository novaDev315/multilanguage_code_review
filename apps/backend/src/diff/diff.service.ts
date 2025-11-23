import { Injectable } from '@nestjs/common';
import * as Diff from 'diff';

export interface DiffResult {
  original: string;
  modified: string;
  hunks: DiffHunk[];
  stats: DiffStats;
  inlineView: InlineDiffLine[];
  sideBySideView: SideBySideLine[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'unchanged';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  changes: number;
  totalLines: number;
}

export interface InlineDiffLine {
  type: 'add' | 'remove' | 'unchanged' | 'header';
  content: string;
  lineNumber?: number;
  oldLineNumber?: number;
  newLineNumber?: number;
  highlights?: { start: number; end: number }[];
}

export interface SideBySideLine {
  left: {
    lineNumber?: number;
    content: string;
    type: 'remove' | 'unchanged' | 'empty';
    highlights?: { start: number; end: number }[];
  };
  right: {
    lineNumber?: number;
    content: string;
    type: 'add' | 'unchanged' | 'empty';
    highlights?: { start: number; end: number }[];
  };
}

export interface FixPreview {
  original: string;
  fixed: string;
  diff: DiffResult;
  fixDescription: string;
  confidence: number;
  canAutoApply: boolean;
}

@Injectable()
export class DiffService {
  /**
   * Generate a comprehensive diff between original and modified code
   */
  generateDiff(original: string, modified: string): DiffResult {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');

    // Generate patch
    const patch = Diff.structuredPatch('original', 'modified', original, modified, '', '', {
      context: 3,
    });

    // Convert to our hunk format
    const hunks: DiffHunk[] = patch.hunks.map((hunk) => ({
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
      lines: hunk.lines.map((line, idx) => {
        const type = line.startsWith('+') ? 'add' : line.startsWith('-') ? 'remove' : 'unchanged';
        return {
          type,
          content: line.substring(1),
          oldLineNumber: type !== 'add' ? hunk.oldStart + idx : undefined,
          newLineNumber: type !== 'remove' ? hunk.newStart + idx : undefined,
        };
      }),
    }));

    // Calculate stats
    const stats = this.calculateStats(original, modified);

    // Generate inline view
    const inlineView = this.generateInlineView(original, modified);

    // Generate side-by-side view
    const sideBySideView = this.generateSideBySideView(original, modified);

    return {
      original,
      modified,
      hunks,
      stats,
      inlineView,
      sideBySideView,
    };
  }

  /**
   * Generate a preview of applying a fix
   */
  generateFixPreview(
    originalCode: string,
    lineNumber: number,
    fixCode: string,
    fixDescription: string,
    confidence: number,
  ): FixPreview {
    const lines = originalCode.split('\n');

    // Determine fix type (replace line, insert, or multi-line)
    const fixLines = fixCode.split('\n');
    let modifiedCode: string;

    if (fixCode.includes('__DELETE__')) {
      // Delete the line
      lines.splice(lineNumber - 1, 1);
      modifiedCode = lines.join('\n');
    } else if (fixCode.includes('__INSERT_BEFORE__')) {
      // Insert before the line
      const insertContent = fixCode.replace('__INSERT_BEFORE__', '').trim();
      lines.splice(lineNumber - 1, 0, insertContent);
      modifiedCode = lines.join('\n');
    } else if (fixCode.includes('__INSERT_AFTER__')) {
      // Insert after the line
      const insertContent = fixCode.replace('__INSERT_AFTER__', '').trim();
      lines.splice(lineNumber, 0, insertContent);
      modifiedCode = lines.join('\n');
    } else {
      // Replace the line(s)
      const linesToReplace = fixLines.length > 1 ? fixLines.length : 1;
      lines.splice(lineNumber - 1, linesToReplace, ...fixLines);
      modifiedCode = lines.join('\n');
    }

    const diff = this.generateDiff(originalCode, modifiedCode);

    // Determine if fix can be auto-applied
    const canAutoApply = this.canAutoApplyFix(fixCode, confidence);

    return {
      original: originalCode,
      fixed: modifiedCode,
      diff,
      fixDescription,
      confidence,
      canAutoApply,
    };
  }

  /**
   * Apply multiple fixes to code
   */
  applyFixes(
    originalCode: string,
    fixes: { lineNumber: number; fixCode: string }[],
  ): { code: string; appliedCount: number; skippedCount: number } {
    let code = originalCode;
    let appliedCount = 0;
    let skippedCount = 0;

    // Sort fixes by line number (descending) to avoid line number shifts
    const sortedFixes = [...fixes].sort((a, b) => b.lineNumber - a.lineNumber);

    for (const fix of sortedFixes) {
      try {
        const lines = code.split('\n');

        if (fix.lineNumber > 0 && fix.lineNumber <= lines.length) {
          if (fix.fixCode.includes('__DELETE__')) {
            lines.splice(fix.lineNumber - 1, 1);
          } else if (fix.fixCode.includes('__INSERT_BEFORE__')) {
            const content = fix.fixCode.replace('__INSERT_BEFORE__', '').trim();
            lines.splice(fix.lineNumber - 1, 0, content);
          } else if (fix.fixCode.includes('__INSERT_AFTER__')) {
            const content = fix.fixCode.replace('__INSERT_AFTER__', '').trim();
            lines.splice(fix.lineNumber, 0, content);
          } else {
            lines[fix.lineNumber - 1] = fix.fixCode;
          }
          code = lines.join('\n');
          appliedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        skippedCount++;
      }
    }

    return { code, appliedCount, skippedCount };
  }

  /**
   * Generate word-level diff for more precise highlighting
   */
  generateWordDiff(original: string, modified: string): {
    original: { text: string; highlighted: boolean }[];
    modified: { text: string; highlighted: boolean }[];
  } {
    const wordDiff = Diff.diffWords(original, modified);

    const originalParts: { text: string; highlighted: boolean }[] = [];
    const modifiedParts: { text: string; highlighted: boolean }[] = [];

    for (const part of wordDiff) {
      if (part.added) {
        modifiedParts.push({ text: part.value, highlighted: true });
      } else if (part.removed) {
        originalParts.push({ text: part.value, highlighted: true });
      } else {
        originalParts.push({ text: part.value, highlighted: false });
        modifiedParts.push({ text: part.value, highlighted: false });
      }
    }

    return { original: originalParts, modified: modifiedParts };
  }

  /**
   * Get context around a specific line
   */
  getLineContext(
    code: string,
    lineNumber: number,
    contextLines: number = 3,
  ): { lines: { lineNumber: number; content: string; isTarget: boolean }[] } {
    const lines = code.split('\n');
    const start = Math.max(0, lineNumber - 1 - contextLines);
    const end = Math.min(lines.length, lineNumber + contextLines);

    const contextResult = [];
    for (let i = start; i < end; i++) {
      contextResult.push({
        lineNumber: i + 1,
        content: lines[i],
        isTarget: i + 1 === lineNumber,
      });
    }

    return { lines: contextResult };
  }

  private calculateStats(original: string, modified: string): DiffStats {
    const changes = Diff.diffLines(original, modified);
    let additions = 0;
    let deletions = 0;

    for (const change of changes) {
      if (change.added) {
        additions += change.count || 0;
      } else if (change.removed) {
        deletions += change.count || 0;
      }
    }

    return {
      additions,
      deletions,
      changes: additions + deletions,
      totalLines: modified.split('\n').length,
    };
  }

  private generateInlineView(original: string, modified: string): InlineDiffLine[] {
    const changes = Diff.diffLines(original, modified);
    const inlineLines: InlineDiffLine[] = [];
    let oldLineNum = 1;
    let newLineNum = 1;

    for (const change of changes) {
      const lines = change.value.split('\n').filter((l, i, arr) => i < arr.length - 1 || l.length > 0);

      for (const line of lines) {
        if (change.added) {
          inlineLines.push({
            type: 'add',
            content: line,
            newLineNumber: newLineNum++,
          });
        } else if (change.removed) {
          inlineLines.push({
            type: 'remove',
            content: line,
            oldLineNumber: oldLineNum++,
          });
        } else {
          inlineLines.push({
            type: 'unchanged',
            content: line,
            oldLineNumber: oldLineNum++,
            newLineNumber: newLineNum++,
          });
        }
      }
    }

    return inlineLines;
  }

  private generateSideBySideView(original: string, modified: string): SideBySideLine[] {
    const changes = Diff.diffLines(original, modified);
    const sideBySide: SideBySideLine[] = [];
    let oldLineNum = 1;
    let newLineNum = 1;

    const processedChanges: { type: string; lines: string[] }[] = [];

    for (const change of changes) {
      const lines = change.value.split('\n').filter((l, i, arr) => i < arr.length - 1 || l.length > 0);

      if (change.added) {
        processedChanges.push({ type: 'add', lines });
      } else if (change.removed) {
        processedChanges.push({ type: 'remove', lines });
      } else {
        processedChanges.push({ type: 'unchanged', lines });
      }
    }

    // Combine adjacent remove/add pairs for side-by-side view
    for (let i = 0; i < processedChanges.length; i++) {
      const current = processedChanges[i];
      const next = processedChanges[i + 1];

      if (current.type === 'remove' && next?.type === 'add') {
        // Pair them side by side
        const maxLen = Math.max(current.lines.length, next.lines.length);
        for (let j = 0; j < maxLen; j++) {
          sideBySide.push({
            left: {
              lineNumber: j < current.lines.length ? oldLineNum++ : undefined,
              content: current.lines[j] || '',
              type: j < current.lines.length ? 'remove' : 'empty',
            },
            right: {
              lineNumber: j < next.lines.length ? newLineNum++ : undefined,
              content: next.lines[j] || '',
              type: j < next.lines.length ? 'add' : 'empty',
            },
          });
        }
        i++; // Skip next since we processed it
      } else if (current.type === 'remove') {
        for (const line of current.lines) {
          sideBySide.push({
            left: { lineNumber: oldLineNum++, content: line, type: 'remove' },
            right: { content: '', type: 'empty' },
          });
        }
      } else if (current.type === 'add') {
        for (const line of current.lines) {
          sideBySide.push({
            left: { content: '', type: 'empty' },
            right: { lineNumber: newLineNum++, content: line, type: 'add' },
          });
        }
      } else {
        for (const line of current.lines) {
          sideBySide.push({
            left: { lineNumber: oldLineNum++, content: line, type: 'unchanged' },
            right: { lineNumber: newLineNum++, content: line, type: 'unchanged' },
          });
        }
      }
    }

    return sideBySide;
  }

  private canAutoApplyFix(fixCode: string, confidence: number): boolean {
    // Auto-apply only high confidence, simple fixes
    if (confidence < 0.9) return false;

    // Don't auto-apply deletions or multi-line changes
    if (fixCode.includes('__DELETE__')) return false;
    if (fixCode.split('\n').length > 3) return false;

    return true;
  }
}
