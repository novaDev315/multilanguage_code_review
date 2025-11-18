import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { CodeIssue, IssueSeverity, IssueCategory } from '../analysis/types/analysis.types';

export interface AIAnalysisRequest {
  code: string;
  language: string;
  filePath: string;
  context?: string;
}

export interface AIAnalysisResponse {
  issues: CodeIssue[];
  suggestions: string[];
  summary: string;
}

@Injectable()
export class AiService {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private useOpenAI: boolean;

  constructor(private configService: ConfigService) {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
      this.useOpenAI = true;
    } else if (anthropicKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
      this.useOpenAI = false;
    }
  }

  async analyzeCode(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    if (this.useOpenAI && this.openai) {
      return this.analyzeWithOpenAI(request);
    } else if (this.anthropic) {
      return this.analyzeWithAnthropic(request);
    }

    throw new Error('No AI provider configured');
  }

  private async analyzeWithOpenAI(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const prompt = this.buildAnalysisPrompt(request);

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.configService.get<string>('OPENAI_MODEL') || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      return this.parseAIResponse(response, request);
    } catch (error) {
      console.error('OpenAI analysis error:', error);
      throw error;
    }
  }

  private async analyzeWithAnthropic(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const prompt = this.buildAnalysisPrompt(request);

    try {
      const message = await this.anthropic.messages.create({
        model: this.configService.get<string>('ANTHROPIC_MODEL') || 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.3,
        system: this.getSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const response = message.content[0];
      if (response.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic');
      }

      return this.parseAIResponse(response.text, request);
    } catch (error) {
      console.error('Anthropic analysis error:', error);
      throw error;
    }
  }

  private getSystemPrompt(): string {
    return `You are an expert code reviewer with deep knowledge of software engineering best practices, security, and performance optimization.

Your task is to analyze code and identify:
1. Bugs and logic errors
2. Security vulnerabilities (OWASP Top 10)
3. Performance issues
4. Code smells and maintainability concerns
5. Best practice violations

For each issue found, provide:
- Severity (critical, high, medium, low, info)
- Category (bug, security, performance, style, complexity, etc.)
- Line number
- Clear description
- Actionable fix suggestion
- Example fix code when applicable

Return your response in JSON format with this structure:
{
  "issues": [
    {
      "lineNumber": number,
      "severity": "critical|high|medium|low|info",
      "category": "bug|security|performance|style|complexity|maintainability|best_practice",
      "message": "description",
      "fixSuggestion": "how to fix",
      "fixCode": "example code"
    }
  ],
  "suggestions": ["general improvement 1", "general improvement 2"],
  "summary": "brief overall assessment"
}`;
  }

  private buildAnalysisPrompt(request: AIAnalysisRequest): string {
    return `Analyze the following ${request.language} code from file: ${request.filePath}

${request.context ? `Context: ${request.context}\n\n` : ''}Code:
\`\`\`${request.language}
${request.code}
\`\`\`

Provide a comprehensive code review focusing on bugs, security, performance, and best practices.`;
  }

  private parseAIResponse(response: string, request: AIAnalysisRequest): AIAnalysisResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Convert to our issue format
      const issues: CodeIssue[] = (parsed.issues || []).map((issue: any) => ({
        filePath: request.filePath,
        lineNumber: issue.lineNumber || 1,
        severity: this.normalizeSeverity(issue.severity),
        category: this.normalizeCategory(issue.category),
        message: issue.message,
        fixSuggestion: issue.fixSuggestion,
        fixCode: issue.fixCode,
        confidence: 0.85,
        language: request.language,
        ruleId: 'ai-analysis',
      }));

      return {
        issues,
        suggestions: parsed.suggestions || [],
        summary: parsed.summary || 'No summary provided',
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return {
        issues: [],
        suggestions: [],
        summary: response.substring(0, 200),
      };
    }
  }

  private normalizeSeverity(severity: string): IssueSeverity {
    const normalized = severity?.toLowerCase();
    switch (normalized) {
      case 'critical':
        return IssueSeverity.CRITICAL;
      case 'high':
        return IssueSeverity.HIGH;
      case 'medium':
        return IssueSeverity.MEDIUM;
      case 'low':
        return IssueSeverity.LOW;
      default:
        return IssueSeverity.INFO;
    }
  }

  private normalizeCategory(category: string): IssueCategory {
    const normalized = category?.toLowerCase();
    switch (normalized) {
      case 'bug':
        return IssueCategory.BUG;
      case 'security':
        return IssueCategory.SECURITY;
      case 'performance':
        return IssueCategory.PERFORMANCE;
      case 'style':
        return IssueCategory.STYLE;
      case 'complexity':
        return IssueCategory.COMPLEXITY;
      case 'maintainability':
        return IssueCategory.MAINTAINABILITY;
      default:
        return IssueCategory.BEST_PRACTICE;
    }
  }

  async generateFixSuggestion(
    code: string,
    issue: CodeIssue,
    language: string,
  ): Promise<string> {
    const prompt = `Given this ${language} code with an issue:

Code:
\`\`\`${language}
${code}
\`\`\`

Issue at line ${issue.lineNumber}: ${issue.message}

Provide a specific, production-ready fix for this issue. Return only the corrected code.`;

    try {
      if (this.useOpenAI && this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [
            { role: 'system', content: 'You are a code fixing assistant. Provide only the fixed code without explanations.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 1000,
        });

        return completion.choices[0]?.message?.content || '';
      } else if (this.anthropic) {
        const message = await this.anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          temperature: 0.2,
          messages: [{ role: 'user', content: prompt }],
        });

        const response = message.content[0];
        return response.type === 'text' ? response.text : '';
      }
    } catch (error) {
      console.error('Fix generation error:', error);
      return '';
    }

    return '';
  }

  async explainCode(code: string, language: string): Promise<string> {
    const prompt = `Explain what this ${language} code does in simple terms:

\`\`\`${language}
${code}
\`\`\``;

    try {
      if (this.useOpenAI && this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [
            { role: 'system', content: 'You are a helpful code explainer. Explain code clearly and concisely.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.5,
          max_tokens: 500,
        });

        return completion.choices[0]?.message?.content || 'Unable to explain code';
      } else if (this.anthropic) {
        const message = await this.anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 500,
          temperature: 0.5,
          messages: [{ role: 'user', content: prompt }],
        });

        const response = message.content[0];
        return response.type === 'text' ? response.text : 'Unable to explain code';
      }
    } catch (error) {
      console.error('Code explanation error:', error);
      return 'Unable to explain code';
    }

    return 'No AI provider configured';
  }
}
