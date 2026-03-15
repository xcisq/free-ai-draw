/**
 * Mermaid 预览 Hook
 * 管理 Mermaid 代码转换和元素状态
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PlaitElement } from '@plait/core';
import type { Message } from '../types';
import { llmChatService } from '../services/llm-chat-service';
import {
  buildMermaidUserPrompt,
  validateMermaidCode,
} from '../services/prompt-templates';
import type { GenerationContext, ValidationResult } from '../types';
import { mermaidStabilizerService, MermaidStabilizationError } from '../services/mermaid-stabilizer';

interface UpdateCodeOptions {
  allowLLMRepair?: boolean;
  signal?: AbortSignal;
}

export interface UseMermaidPreviewResult {
  mermaidCode: string;
  elements: PlaitElement[];
  isConverting: boolean;
  validation: ValidationResult | null;
  isValid: boolean;
  error: string | null;
  generateFromChat: (userMessages: Message[], context: GenerationContext) => Promise<void>;
  updateCode: (code: string, options?: UpdateCodeOptions) => Promise<string>;
  clear: () => void;
  clearError: () => void;
}

const DEFAULT_CONTEXT: GenerationContext = {
  layoutDirection: 'LR',
  usageScenario: 'paper',
  nodeCount: 5,
  theme: 'academic',
};

export function useMermaidPreview(): UseMermaidPreviewResult {
  const [mermaidCode, setMermaidCode] = useState('');
  const [elements, setElements] = useState<PlaitElement[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isGeneratingRef = useRef(false);

  // 验证代码
  useEffect(() => {
    if (mermaidCode) {
      const result = validateMermaidCode(mermaidCode);
      setValidation(result);
    } else {
      setValidation(null);
    }
  }, [mermaidCode]);

  // 从对话生成 Mermaid 代码和元素
  const generateFromChat = useCallback(
    async (userMessages: Message[], context: GenerationContext = DEFAULT_CONTEXT) => {
      setIsConverting(true);
      isGeneratingRef.current = true;

      try {
        const lastUserMessage = [...userMessages]
          .reverse()
          .find((message) => message.role === 'user');
        const prompt = buildMermaidUserPrompt(
          lastUserMessage?.content || '请生成一个论文 pipeline 流程图',
          context
        );

        // 调用 LLM 生成 Mermaid 代码
        const response = await llmChatService.generateMermaid(prompt);
        const stabilized = await mermaidStabilizerService.stabilizeResponse(response, {
          allowLLMRepair: true,
          originalRequest: prompt,
        });

        setMermaidCode(stabilized.mermaidCode);
        setValidation(stabilized.validation);
        setElements(stabilized.elements);
        setError(null);
      } catch (error) {
        console.error('Failed to generate from chat:', error);
        setMermaidCode('');
        setElements([]);
        setValidation(null);
        setError(error instanceof Error ? error.message : 'Mermaid 代码生成失败');
      } finally {
        setIsConverting(false);
        isGeneratingRef.current = false;
      }
    },
    []
  );

  // 更新 Mermaid 代码
  const updateCode = useCallback(async (code: string, options: UpdateCodeOptions = {}) => {
    setMermaidCode(code);
    setError(null);

    if (code.trim()) {
      setIsConverting(true);
      try {
        const stabilized = await mermaidStabilizerService.stabilizeCode(code, {
          allowLLMRepair: options.allowLLMRepair,
          signal: options.signal,
        });

        if (stabilized.source !== 'original') {
          console.warn('[llm-mermaid] preview mermaid auto-repaired', {
            source: stabilized.source,
            fixes: stabilized.appliedFixes,
          });
        }

        setMermaidCode(stabilized.mermaidCode);
        setValidation(stabilized.validation);
        setElements(stabilized.elements);
        return stabilized.mermaidCode;
      } catch (error) {
        if (error instanceof MermaidStabilizationError) {
          console.warn('[llm-mermaid] preview mermaid stabilization failed', {
            stage: error.stage,
            details: error.details,
          });
        } else {
          console.error('Failed to convert Mermaid code:', error);
        }

        const nextValidation = validateMermaidCode(code);
        setValidation(nextValidation);
        setElements([]);
        setError(error instanceof Error ? error.message : 'Mermaid 代码预览失败');
        return code;
      } finally {
        setIsConverting(false);
      }
    } else {
      setElements([]);
      setValidation(null);
      setError(null);
    }
    return '';
  }, []);

  // 清空
  const clear = useCallback(() => {
    setMermaidCode('');
    setElements([]);
    setValidation(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    mermaidCode,
    elements,
    isConverting,
    validation,
    isValid: validation?.isValid ?? false,
    error,
    generateFromChat,
    updateCode,
    clear,
    clearError,
  };
}
