/**
 * Mermaid 预览 Hook
 * 管理 Mermaid 代码转换和元素状态
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PlaitElement } from '@plait/core';
import type { Message } from '../types';
import { mermaidConverter, MermaidConverter } from '../services/mermaid-converter';
import { llmChatService } from '../services/llm-chat-service';
import { getMermaidGenerationPrompt, extractMermaidCode, validateMermaidCode } from '../services/prompt-templates';
import type { GenerationContext, ValidationResult } from '../types';

export interface UseMermaidPreviewResult {
  mermaidCode: string;
  elements: PlaitElement[];
  isConverting: boolean;
  validation: ValidationResult | null;
  isValid: boolean;
  generateFromChat: (userMessages: Message[], context: GenerationContext) => Promise<void>;
  updateCode: (code: string) => Promise<void>;
  clear: () => void;
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
        // 构建提示词
        const prompt = getMermaidGenerationPrompt(context);

        // 调用 LLM 生成 Mermaid 代码
        const response = await llmChatService.generateMermaid(prompt);

        // 提取 Mermaid 代码
        const extractedCode = extractMermaidCode(response);

        // 设置代码
        setMermaidCode(extractedCode);

        // 转换为元素
        if (extractedCode) {
          const convertedElements = await mermaidConverter.convertToElements(extractedCode);
          setElements(convertedElements);
        } else {
          setElements([]);
        }
      } catch (error) {
        console.error('Failed to generate from chat:', error);
        setMermaidCode('');
        setElements([]);
      } finally {
        setIsConverting(false);
        isGeneratingRef.current = false;
      }
    },
    []
  );

  // 更新 Mermaid 代码
  const updateCode = useCallback(async (code: string) => {
    setMermaidCode(code);

    if (code.trim()) {
      setIsConverting(true);
      try {
        const convertedElements = await mermaidConverter.convertToElements(code);
        setElements(convertedElements);
      } catch (error) {
        console.error('Failed to convert Mermaid code:', error);
        setElements([]);
      } finally {
        setIsConverting(false);
      }
    } else {
      setElements([]);
    }
  }, []);

  // 清空
  const clear = useCallback(() => {
    setMermaidCode('');
    setElements([]);
    setValidation(null);
  }, []);

  return {
    mermaidCode,
    elements,
    isConverting,
    validation,
    isValid: validation?.isValid ?? false,
    generateFromChat,
    updateCode,
    clear,
  };
}
