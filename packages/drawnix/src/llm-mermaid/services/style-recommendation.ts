import type { GraphInfo, StyleScheme, ThemePreset, UsageScenario } from '../types';
import { llmChatService } from './llm-chat-service';
import {
  getDefaultStyleRecommendationPrompt,
  getStyleAdjustmentPrompt,
} from './prompt-templates';
import { extractStyleSchemesFromMermaid } from '../utils/style-applier';
import { mermaidStabilizerService, MermaidStabilizationError } from './mermaid-stabilizer';

export interface StyleRecommendationResult {
  mermaidCode: string;
  styleSchemes: StyleScheme[];
  rawStyleText?: string;
}

export class StyleRecommendationService {
  async recommendDefault(
    graphInfo: GraphInfo,
    currentMermaid: string,
    options: {
      usageScenario?: UsageScenario;
      theme?: ThemePreset | string;
    } = {}
  ): Promise<StyleRecommendationResult> {
    const prompt = getDefaultStyleRecommendationPrompt(currentMermaid, graphInfo, options);
    return this.generate(prompt);
  }

  async adjustStyle(
    graphInfo: GraphInfo,
    currentMermaid: string,
    request: string
  ): Promise<StyleRecommendationResult> {
    const prompt = getStyleAdjustmentPrompt(currentMermaid, request, graphInfo);
    return this.generate(prompt);
  }

  private async generate(prompt: string): Promise<StyleRecommendationResult> {
    const response = await llmChatService.generateStyle(prompt);
    let result;

    try {
      result = await mermaidStabilizerService.stabilizeResponse(response, {
        allowLLMRepair: true,
        requireElements: false,
        originalRequest: prompt,
      });
    } catch (error) {
      if (error instanceof MermaidStabilizationError && error.stage === 'extract') {
        throw new Error('未从样式优化结果中解析到 classDef 定义');
      }

      throw error;
    }

    const mermaidCode = result.mermaidCode;

    const styleSchemes = extractStyleSchemesFromMermaid(mermaidCode);
    if (styleSchemes.length === 0) {
      throw new Error('未从样式优化结果中解析到 classDef 定义');
    }

    return {
      mermaidCode,
      styleSchemes,
      rawStyleText: response,
    };
  }
}

export const styleRecommendationService = new StyleRecommendationService();
