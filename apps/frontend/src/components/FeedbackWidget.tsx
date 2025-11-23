'use client';

import React, { useState } from 'react';

interface FeedbackWidgetProps {
  issueId: string;
  onSubmit: (feedback: {
    issueId: string;
    feedbackType: string;
    comment?: string;
  }) => Promise<void>;
}

interface FeedbackStats {
  totalFeedback: number;
  falsePositives: number;
  helpfulCount: number;
  notHelpfulCount: number;
  falsePositiveRate: number;
  helpfulRate: number;
}

/**
 * Feedback Widget for marking issues as helpful/not helpful/false positive
 */
export function FeedbackWidget({ issueId, onSubmit }: FeedbackWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const feedbackTypes = [
    {
      id: 'helpful',
      label: 'Helpful',
      icon: '👍',
      color: 'bg-green-100 hover:bg-green-200 text-green-800 border-green-300',
    },
    {
      id: 'not_helpful',
      label: 'Not Helpful',
      icon: '👎',
      color: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-300',
    },
    {
      id: 'false_positive',
      label: 'False Positive',
      icon: '🚫',
      color: 'bg-red-100 hover:bg-red-200 text-red-800 border-red-300',
    },
    {
      id: 'good_fix',
      label: 'Good Fix',
      icon: '✨',
      color: 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300',
    },
  ];

  const handleSubmit = async () => {
    if (!selectedType) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        issueId,
        feedbackType: selectedType,
        comment: comment || undefined,
      });
      setSubmitted(true);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center space-x-2 text-sm text-green-600">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span>Thank you for your feedback!</span>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col">
      {/* Quick feedback buttons */}
      <div className="flex items-center space-x-2">
        <span className="text-xs text-gray-500">Was this helpful?</span>
        {feedbackTypes.slice(0, 2).map((type) => (
          <button
            key={type.id}
            onClick={() => {
              setSelectedType(type.id);
              setIsExpanded(true);
            }}
            className={`p-1 rounded text-sm transition-colors ${
              selectedType === type.id
                ? type.color + ' border'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={type.label}
          >
            {type.icon}
          </button>
        ))}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          More options
        </button>
      </div>

      {/* Expanded feedback panel */}
      {isExpanded && (
        <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-2 mb-4">
            {feedbackTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`flex items-center space-x-2 p-2 rounded border text-sm transition-colors ${
                  selectedType === type.id
                    ? type.color + ' border-2'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{type.icon}</span>
                <span>{type.label}</span>
              </button>
            ))}
          </div>

          {/* Comment input */}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment (optional)..."
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />

          {/* Submit button */}
          <div className="flex justify-end mt-3 space-x-2">
            <button
              onClick={() => setIsExpanded(false)}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedType || isSubmitting}
              className={`px-4 py-1 text-sm font-medium text-white rounded ${
                selectedType && !isSubmitting
                  ? 'bg-blue-500 hover:bg-blue-600'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Feedback Statistics Dashboard
 */
export function FeedbackStatsDashboard({ stats }: { stats: FeedbackStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        title="Total Feedback"
        value={stats.totalFeedback}
        icon="📊"
      />
      <StatCard
        title="False Positives"
        value={stats.falsePositives}
        subtitle={`${stats.falsePositiveRate.toFixed(1)}% rate`}
        icon="🚫"
        color="text-red-600"
      />
      <StatCard
        title="Helpful"
        value={stats.helpfulCount}
        subtitle={`${stats.helpfulRate.toFixed(1)}% rate`}
        icon="👍"
        color="text-green-600"
      />
      <StatCard
        title="Not Helpful"
        value={stats.notHelpfulCount}
        icon="👎"
        color="text-yellow-600"
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = 'text-gray-800',
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: string;
  color?: string;
}) {
  return (
    <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-xs text-gray-500 uppercase">{title}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

/**
 * Learned Patterns List
 */
export function LearnedPatternsList({
  patterns,
  onReset,
}: {
  patterns: Array<{
    id: string;
    ruleId: string;
    language: string;
    skipCount: number;
    reason: string;
    lastSkipped: string;
  }>;
  onReset: (patternId: string) => void;
}) {
  if (patterns.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No learned patterns yet.</p>
        <p className="text-sm mt-2">
          As you provide feedback, the system will learn to skip similar false positives.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {patterns.map((pattern) => (
        <div
          key={pattern.id}
          className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                  {pattern.language}
                </span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {pattern.ruleId}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{pattern.reason}</p>
              <p className="text-xs text-gray-500 mt-1">
                Skipped {pattern.skipCount} times | Last: {new Date(pattern.lastSkipped).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => onReset(pattern.id)}
              className="px-3 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
            >
              Reset
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default FeedbackWidget;
