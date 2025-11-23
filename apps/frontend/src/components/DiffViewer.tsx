'use client';

import React, { useState, useMemo } from 'react';

interface DiffLine {
  type: 'add' | 'remove' | 'unchanged' | 'header';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface FixPreviewProps {
  originalCode: string;
  fixedCode: string;
  fixDescription: string;
  confidence: number;
  onApply?: () => void;
  onDismiss?: () => void;
}

interface DiffViewerProps {
  original: string;
  modified: string;
  language?: string;
  viewMode?: 'inline' | 'side-by-side';
  showLineNumbers?: boolean;
  highlightChanges?: boolean;
}

// Color scheme for diff highlighting
const diffColors = {
  add: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-l-4 border-green-500',
    text: 'text-green-800 dark:text-green-200',
    lineNum: 'text-green-600 dark:text-green-400',
  },
  remove: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-l-4 border-red-500',
    text: 'text-red-800 dark:text-red-200',
    lineNum: 'text-red-600 dark:text-red-400',
  },
  unchanged: {
    bg: 'bg-gray-50 dark:bg-gray-800',
    border: '',
    text: 'text-gray-700 dark:text-gray-300',
    lineNum: 'text-gray-400',
  },
};

/**
 * Generate diff between two strings
 */
function generateDiff(original: string, modified: string): DiffLine[] {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const diff: DiffLine[] = [];

  // Simple diff algorithm (for production, use a proper diff library)
  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < originalLines.length || newIdx < modifiedLines.length) {
    const oldLine = originalLines[oldIdx];
    const newLine = modifiedLines[newIdx];

    if (oldLine === newLine) {
      diff.push({
        type: 'unchanged',
        content: oldLine || '',
        oldLineNumber: oldIdx + 1,
        newLineNumber: newIdx + 1,
      });
      oldIdx++;
      newIdx++;
    } else if (oldLine !== undefined && !modifiedLines.slice(newIdx).includes(oldLine)) {
      diff.push({
        type: 'remove',
        content: oldLine,
        oldLineNumber: oldIdx + 1,
      });
      oldIdx++;
    } else if (newLine !== undefined && !originalLines.slice(oldIdx).includes(newLine)) {
      diff.push({
        type: 'add',
        content: newLine,
        newLineNumber: newIdx + 1,
      });
      newIdx++;
    } else {
      // Lines exist but in different positions - treat as change
      if (oldLine !== undefined) {
        diff.push({
          type: 'remove',
          content: oldLine,
          oldLineNumber: oldIdx + 1,
        });
        oldIdx++;
      }
      if (newLine !== undefined) {
        diff.push({
          type: 'add',
          content: newLine,
          newLineNumber: newIdx + 1,
        });
        newIdx++;
      }
    }
  }

  return diff;
}

/**
 * Inline Diff Viewer Component
 */
export function DiffViewer({
  original,
  modified,
  language = 'plaintext',
  viewMode = 'inline',
  showLineNumbers = true,
  highlightChanges = true,
}: DiffViewerProps) {
  const [mode, setMode] = useState<'inline' | 'side-by-side'>(viewMode);

  const diff = useMemo(() => generateDiff(original, modified), [original, modified]);

  const stats = useMemo(() => {
    const additions = diff.filter((d) => d.type === 'add').length;
    const deletions = diff.filter((d) => d.type === 'remove').length;
    return { additions, deletions };
  }, [diff]);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Diff View
          </span>
          <span className="text-sm text-green-600">+{stats.additions}</span>
          <span className="text-sm text-red-600">-{stats.deletions}</span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setMode('inline')}
            className={`px-3 py-1 text-xs rounded ${
              mode === 'inline'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Inline
          </button>
          <button
            onClick={() => setMode('side-by-side')}
            className={`px-3 py-1 text-xs rounded ${
              mode === 'side-by-side'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Side by Side
          </button>
        </div>
      </div>

      {/* Diff Content */}
      <div className="overflow-x-auto">
        {mode === 'inline' ? (
          <InlineDiffView diff={diff} showLineNumbers={showLineNumbers} />
        ) : (
          <SideBySideDiffView
            original={original}
            modified={modified}
            showLineNumbers={showLineNumbers}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Inline diff view
 */
function InlineDiffView({
  diff,
  showLineNumbers,
}: {
  diff: DiffLine[];
  showLineNumbers: boolean;
}) {
  return (
    <table className="w-full text-sm font-mono">
      <tbody>
        {diff.map((line, index) => {
          const colors = diffColors[line.type] || diffColors.unchanged;
          const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';

          return (
            <tr key={index} className={`${colors.bg} ${colors.border}`}>
              {showLineNumbers && (
                <>
                  <td className={`w-12 px-2 py-0.5 text-right ${colors.lineNum} select-none`}>
                    {line.oldLineNumber || ''}
                  </td>
                  <td className={`w-12 px-2 py-0.5 text-right ${colors.lineNum} select-none`}>
                    {line.newLineNumber || ''}
                  </td>
                </>
              )}
              <td className={`px-2 py-0.5 ${colors.text} select-none w-4`}>{prefix}</td>
              <td className={`px-2 py-0.5 ${colors.text} whitespace-pre`}>{line.content}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Side by side diff view
 */
function SideBySideDiffView({
  original,
  modified,
  showLineNumbers,
}: {
  original: string;
  modified: string;
  showLineNumbers: boolean;
}) {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const maxLines = Math.max(originalLines.length, modifiedLines.length);

  return (
    <div className="flex">
      {/* Original (Left) */}
      <div className="flex-1 border-r border-gray-200 dark:border-gray-700">
        <div className="px-3 py-1 bg-red-50 dark:bg-red-900/20 text-xs font-medium text-red-700 dark:text-red-300 border-b border-gray-200 dark:border-gray-700">
          Original
        </div>
        <table className="w-full text-sm font-mono">
          <tbody>
            {originalLines.map((line, index) => {
              const isRemoved = !modifiedLines.includes(line);
              const colors = isRemoved ? diffColors.remove : diffColors.unchanged;

              return (
                <tr key={index} className={colors.bg}>
                  {showLineNumbers && (
                    <td className={`w-12 px-2 py-0.5 text-right ${colors.lineNum} select-none`}>
                      {index + 1}
                    </td>
                  )}
                  <td className={`px-2 py-0.5 ${colors.text} whitespace-pre`}>{line}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modified (Right) */}
      <div className="flex-1">
        <div className="px-3 py-1 bg-green-50 dark:bg-green-900/20 text-xs font-medium text-green-700 dark:text-green-300 border-b border-gray-200 dark:border-gray-700">
          Modified
        </div>
        <table className="w-full text-sm font-mono">
          <tbody>
            {modifiedLines.map((line, index) => {
              const isAdded = !originalLines.includes(line);
              const colors = isAdded ? diffColors.add : diffColors.unchanged;

              return (
                <tr key={index} className={colors.bg}>
                  {showLineNumbers && (
                    <td className={`w-12 px-2 py-0.5 text-right ${colors.lineNum} select-none`}>
                      {index + 1}
                    </td>
                  )}
                  <td className={`px-2 py-0.5 ${colors.text} whitespace-pre`}>{line}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Fix Preview Component - Shows before/after with apply button
 */
export function FixPreview({
  originalCode,
  fixedCode,
  fixDescription,
  confidence,
  onApply,
  onDismiss,
}: FixPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const confidenceColor =
    confidence >= 0.9
      ? 'text-green-600 bg-green-100'
      : confidence >= 0.7
      ? 'text-yellow-600 bg-yellow-100'
      : 'text-red-600 bg-red-100';

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-900/20 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <svg
            className={`w-5 h-5 text-blue-500 transform transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span className="font-medium text-blue-800 dark:text-blue-200">
            Suggested Fix
          </span>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full ${confidenceColor}`}
          >
            {Math.round(confidence * 100)}% confidence
          </span>
        </div>
        <div className="flex space-x-2">
          {onApply && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onApply();
              }}
              className="px-3 py-1 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded"
            >
              Apply Fix
            </button>
          )}
          {onDismiss && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="px-3 py-1 text-sm font-medium text-gray-600 bg-gray-200 hover:bg-gray-300 rounded"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {isExpanded && (
        <>
          <div className="px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">{fixDescription}</p>
          </div>

          {/* Diff View */}
          <DiffViewer original={originalCode} modified={fixedCode} viewMode="inline" />
        </>
      )}
    </div>
  );
}

/**
 * Code Explanation Component
 */
export function CodeExplanation({
  explanation,
  isLoading,
}: {
  explanation?: {
    summary: string;
    explanation: string;
    keyComponents: Array<{
      name: string;
      type: string;
      lineStart: number;
      lineEnd: number;
      purpose: string;
    }>;
    complexity: {
      overall: string;
      cyclomaticComplexity: number;
      linesOfCode: number;
      maintainabilityScore: number;
    };
  };
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Analyzing code...</p>
      </div>
    );
  }

  if (!explanation) {
    return null;
  }

  const complexityColors = {
    simple: 'bg-green-100 text-green-800',
    moderate: 'bg-yellow-100 text-yellow-800',
    complex: 'bg-orange-100 text-orange-800',
    'very-complex': 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Summary</h3>
        <p className="text-gray-700 dark:text-gray-300">{explanation.summary}</p>
      </div>

      {/* Complexity Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase">Complexity</p>
          <p
            className={`mt-1 px-2 py-1 text-sm font-medium rounded inline-block ${
              complexityColors[explanation.complexity.overall as keyof typeof complexityColors]
            }`}
          >
            {explanation.complexity.overall}
          </p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase">Cyclomatic</p>
          <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-gray-200">
            {explanation.complexity.cyclomaticComplexity}
          </p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase">Lines of Code</p>
          <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-gray-200">
            {explanation.complexity.linesOfCode}
          </p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase">Maintainability</p>
          <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-gray-200">
            {explanation.complexity.maintainabilityScore}%
          </p>
        </div>
      </div>

      {/* Detailed Explanation */}
      <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
          Detailed Explanation
        </h3>
        <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
          {explanation.explanation}
        </p>
      </div>

      {/* Key Components */}
      {explanation.keyComponents.length > 0 && (
        <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Key Components
          </h3>
          <div className="space-y-3">
            {explanation.keyComponents.map((component, index) => (
              <div
                key={index}
                className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded"
              >
                <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                  {component.type}
                </span>
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">
                    {component.name}
                    <span className="ml-2 text-xs text-gray-500">
                      (lines {component.lineStart}-{component.lineEnd})
                    </span>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {component.purpose}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DiffViewer;
