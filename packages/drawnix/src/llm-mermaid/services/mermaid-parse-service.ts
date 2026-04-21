import mermaid from 'mermaid';
import type { ValidationResult } from '../types';

export interface MermaidParseValidation extends ValidationResult {
  diagramType?: string;
}

let isInitialized = false;

function ensureInitialized() {
  if (isInitialized) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
  });
  isInitialized = true;
}

function getParseErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return 'Mermaid 官方解析失败';
}

function getParsedDiagramType(result: unknown) {
  if (result && typeof result === 'object' && 'diagramType' in result) {
    const diagramType = result.diagramType;
    return typeof diagramType === 'string' ? diagramType : undefined;
  }

  return undefined;
}

export class MermaidParseService {
  async validate(code: string): Promise<MermaidParseValidation> {
    if (!code.trim()) {
      return {
        isValid: false,
        errors: ['Mermaid 代码为空'],
        warnings: [],
      };
    }

    ensureInitialized();

    try {
      const result = await mermaid.parse(code);
      return {
        isValid: true,
        errors: [],
        warnings: [],
        diagramType: getParsedDiagramType(result),
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [getParseErrorMessage(error)],
        warnings: [],
      };
    }
  }
}

export const mermaidParseService = new MermaidParseService();
