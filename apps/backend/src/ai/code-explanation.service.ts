import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface CodeExplanationRequest {
  code: string;
  language: string;
  filePath: string;
  context?: string;
  detailLevel?: 'brief' | 'detailed' | 'comprehensive';
}

export interface CodeExplanationResponse {
  summary: string;
  explanation: string;
  keyComponents: ComponentExplanation[];
  complexity: ComplexityAnalysis;
  suggestions?: string[];
  relatedConcepts?: string[];
}

interface ComponentExplanation {
  name: string;
  type: 'function' | 'class' | 'variable' | 'import' | 'export' | 'loop' | 'conditional' | 'other';
  lineStart: number;
  lineEnd: number;
  purpose: string;
  details?: string;
}

interface ComplexityAnalysis {
  overall: 'simple' | 'moderate' | 'complex' | 'very-complex';
  cyclomaticComplexity: number;
  linesOfCode: number;
  cognitiveLoad: string;
  maintainabilityScore: number; // 0-100
}

@Injectable()
export class CodeExplanationService {
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

  /**
   * Generate a comprehensive explanation of the code
   */
  async explainCode(request: CodeExplanationRequest): Promise<CodeExplanationResponse> {
    const prompt = this.buildExplanationPrompt(request);

    let aiResponse: string;
    if (this.useOpenAI && this.openai) {
      aiResponse = await this.callOpenAI(prompt);
    } else if (this.anthropic) {
      aiResponse = await this.callAnthropic(prompt);
    } else {
      // Fallback to basic analysis
      return this.generateBasicExplanation(request);
    }

    return this.parseExplanationResponse(aiResponse, request);
  }

  /**
   * Explain a specific function or code block
   */
  async explainFunction(
    code: string,
    functionName: string,
    language: string,
  ): Promise<{ explanation: string; parameters: string[]; returnValue: string; sideEffects: string[] }> {
    const prompt = `
Explain the following ${language} function named "${functionName}" in detail:

\`\`\`${language}
${code}
\`\`\`

Provide:
1. A clear explanation of what this function does
2. Description of each parameter
3. What the function returns
4. Any side effects (database calls, API requests, state mutations, etc.)
5. Time complexity if applicable

Format your response as JSON:
{
  "explanation": "...",
  "parameters": ["param1: description", "param2: description"],
  "returnValue": "description of return value",
  "sideEffects": ["side effect 1", "side effect 2"]
}
`;

    let response: string;
    if (this.useOpenAI && this.openai) {
      response = await this.callOpenAI(prompt);
    } else if (this.anthropic) {
      response = await this.callAnthropic(prompt);
    } else {
      return {
        explanation: 'AI provider not configured',
        parameters: [],
        returnValue: 'unknown',
        sideEffects: [],
      };
    }

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // Parse error, return raw explanation
    }

    return {
      explanation: response,
      parameters: [],
      returnValue: 'See explanation',
      sideEffects: [],
    };
  }

  /**
   * Generate documentation for code
   */
  async generateDocumentation(
    code: string,
    language: string,
    style: 'jsdoc' | 'docstring' | 'markdown' = 'jsdoc',
  ): Promise<string> {
    const styleGuide = {
      jsdoc: 'JSDoc format with @param, @returns, @throws, @example',
      docstring: 'Python docstring format with Args, Returns, Raises, Examples',
      markdown: 'Markdown documentation with headers, code examples, and descriptions',
    };

    const prompt = `
Generate ${styleGuide[style]} documentation for the following ${language} code:

\`\`\`${language}
${code}
\`\`\`

Include:
1. Brief description
2. Parameter descriptions with types
3. Return value description
4. Example usage
5. Any important notes or warnings

Return ONLY the documentation comments/text, no additional explanation.
`;

    if (this.useOpenAI && this.openai) {
      return await this.callOpenAI(prompt);
    } else if (this.anthropic) {
      return await this.callAnthropic(prompt);
    }

    return '// Documentation generation requires AI provider configuration';
  }

  /**
   * Explain the flow of a code file
   */
  async explainCodeFlow(code: string, language: string): Promise<{
    entryPoints: string[];
    flowDiagram: string;
    dataFlow: string[];
    dependencies: string[];
  }> {
    const prompt = `
Analyze the control flow of this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Provide:
1. Entry points (main functions, exported functions, event handlers)
2. A text-based flow diagram showing the execution path
3. Data flow description (how data moves through the code)
4. External dependencies and their purpose

Format as JSON:
{
  "entryPoints": ["function1", "function2"],
  "flowDiagram": "ASCII art or text description of flow",
  "dataFlow": ["data flows from X to Y", "..."],
  "dependencies": ["dependency1: purpose", "..."]
}
`;

    let response: string;
    if (this.useOpenAI && this.openai) {
      response = await this.callOpenAI(prompt);
    } else if (this.anthropic) {
      response = await this.callAnthropic(prompt);
    } else {
      return {
        entryPoints: [],
        flowDiagram: 'AI provider not configured',
        dataFlow: [],
        dependencies: [],
      };
    }

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // Parse error
    }

    return {
      entryPoints: [],
      flowDiagram: response,
      dataFlow: [],
      dependencies: [],
    };
  }

  private buildExplanationPrompt(request: CodeExplanationRequest): string {
    const detailInstructions = {
      brief: 'Provide a concise 2-3 sentence summary.',
      detailed: 'Provide a thorough explanation with component breakdown.',
      comprehensive: 'Provide an exhaustive analysis including complexity metrics, suggestions, and related concepts.',
    };

    return `
You are a senior software engineer explaining code to a colleague.
${detailInstructions[request.detailLevel || 'detailed']}

Analyze this ${request.language} code from ${request.filePath}:

\`\`\`${request.language}
${request.code}
\`\`\`

${request.context ? `Additional context: ${request.context}` : ''}

Provide your explanation in the following JSON format:
{
  "summary": "One paragraph overview of what this code does",
  "explanation": "Detailed explanation of the code logic and purpose",
  "keyComponents": [
    {
      "name": "componentName",
      "type": "function|class|variable|import|export|loop|conditional|other",
      "lineStart": 1,
      "lineEnd": 10,
      "purpose": "What this component does",
      "details": "Additional details if needed"
    }
  ],
  "complexity": {
    "overall": "simple|moderate|complex|very-complex",
    "cyclomaticComplexity": 5,
    "linesOfCode": 50,
    "cognitiveLoad": "Description of mental effort needed to understand",
    "maintainabilityScore": 75
  },
  "suggestions": ["Improvement suggestion 1", "..."],
  "relatedConcepts": ["Design pattern used", "Algorithm concept", "..."]
}

Be accurate about line numbers and component identification.
`;
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert code explainer. Provide clear, accurate explanations in JSON format when requested.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 3000,
    });

    return completion.choices[0]?.message?.content || '';
  }

  private async callAnthropic(prompt: string): Promise<string> {
    const message = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 3000,
      temperature: 0.3,
      system: 'You are an expert code explainer. Provide clear, accurate explanations in JSON format when requested.',
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    return content.type === 'text' ? content.text : '';
  }

  private parseExplanationResponse(
    response: string,
    request: CodeExplanationRequest,
  ): CodeExplanationResponse {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || 'Unable to generate summary',
          explanation: parsed.explanation || response,
          keyComponents: parsed.keyComponents || [],
          complexity: parsed.complexity || this.calculateBasicComplexity(request.code),
          suggestions: parsed.suggestions,
          relatedConcepts: parsed.relatedConcepts,
        };
      }
    } catch (e) {
      // JSON parse error, return basic response
    }

    return this.generateBasicExplanation(request);
  }

  private generateBasicExplanation(request: CodeExplanationRequest): CodeExplanationResponse {
    const lines = request.code.split('\n');
    const complexity = this.calculateBasicComplexity(request.code);

    return {
      summary: `This is a ${request.language} file with ${lines.length} lines of code.`,
      explanation: 'AI-powered explanation not available. Basic analysis provided.',
      keyComponents: this.identifyBasicComponents(request.code, request.language),
      complexity,
      suggestions: ['Consider adding code comments for better readability'],
      relatedConcepts: [],
    };
  }

  private calculateBasicComplexity(code: string): ComplexityAnalysis {
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter(l => l.trim().length > 0).length;

    // Simple cyclomatic complexity estimation
    const decisions = (code.match(/if|else|for|while|switch|case|catch|\?|&&|\|\|/g) || []).length;
    const cyclomaticComplexity = decisions + 1;

    let overall: 'simple' | 'moderate' | 'complex' | 'very-complex';
    if (cyclomaticComplexity <= 5) overall = 'simple';
    else if (cyclomaticComplexity <= 10) overall = 'moderate';
    else if (cyclomaticComplexity <= 20) overall = 'complex';
    else overall = 'very-complex';

    // Maintainability score (simplified Halstead-inspired metric)
    const maintainabilityScore = Math.max(0, Math.min(100,
      171 - 5.2 * Math.log(nonEmptyLines) - 0.23 * cyclomaticComplexity
    ));

    return {
      overall,
      cyclomaticComplexity,
      linesOfCode: nonEmptyLines,
      cognitiveLoad: overall === 'simple' ? 'Low - easy to understand' :
                     overall === 'moderate' ? 'Moderate - requires some focus' :
                     overall === 'complex' ? 'High - may need documentation' :
                     'Very High - consider refactoring',
      maintainabilityScore: Math.round(maintainabilityScore),
    };
  }

  private identifyBasicComponents(code: string, language: string): ComponentExplanation[] {
    const components: ComponentExplanation[] = [];
    const lines = code.split('\n');

    const patterns = {
      function: /(?:function|def|func)\s+(\w+)/,
      class: /(?:class)\s+(\w+)/,
      import: /(?:import|require|from)\s+['"@]?(\w+)/,
      export: /(?:export\s+(?:default\s+)?(?:class|function|const|let|var))\s+(\w+)/,
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const [type, pattern] of Object.entries(patterns)) {
        const match = line.match(pattern);
        if (match) {
          components.push({
            name: match[1],
            type: type as ComponentExplanation['type'],
            lineStart: i + 1,
            lineEnd: i + 1,
            purpose: `${type.charAt(0).toUpperCase() + type.slice(1)} declaration`,
          });
        }
      }
    }

    return components;
  }
}
