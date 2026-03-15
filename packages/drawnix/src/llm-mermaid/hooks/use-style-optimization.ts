import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GenerationContext, StyleScheme, ThemePreset } from '../types';
import { mermaidConverter } from '../services/mermaid-converter';
import { styleRecommendationService } from '../services/style-recommendation';
import { clearStyles, isValidMermaid } from '../utils/mermaid-helper';
import { extractStyleSchemesFromMermaid } from '../utils/style-applier';

export interface UseStyleOptimizationOptions {
  mermaidCode: string;
  generationContext?: Partial<GenerationContext>;
  onMermaidCodeChange?: (code: string) => Promise<void> | void;
}

export interface UseStyleOptimizationResult {
  isOptimizing: boolean;
  styleError: string | null;
  lastStyleRequest: string | null;
  recommendedStyles: StyleScheme[];
  applyPreset: (theme: ThemePreset) => Promise<void>;
  optimizeByPrompt: (request: string) => Promise<void>;
  resetStyleState: () => void;
}

const PRESET_REQUESTS: Record<ThemePreset, string> = {
  academic: '学术风格，简洁配色，适合论文插图',
  professional: '专业风格，层次清晰，适合方案展示',
  lively: '活泼风格，颜色更明亮，但保持可读性',
  minimal: '极简风格，减少装饰和颜色数量',
};

export function useStyleOptimization({
  mermaidCode,
  generationContext,
  onMermaidCodeChange,
}: UseStyleOptimizationOptions): UseStyleOptimizationResult {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);
  const [lastStyleRequest, setLastStyleRequest] = useState<string | null>(null);
  const [recommendedStyles, setRecommendedStyles] = useState<StyleScheme[]>([]);
  const requestIdRef = useRef(0);
  const autoStyledStructureKeysRef = useRef<Set<string>>(new Set());

  const usageScenario = generationContext?.usageScenario || 'paper';
  const themePreset = normalizeThemePreset(generationContext?.theme);
  const currentStyles = useMemo(
    () => extractStyleSchemesFromMermaid(mermaidCode),
    [mermaidCode]
  );

  useEffect(() => {
    if (!mermaidCode.trim()) {
      autoStyledStructureKeysRef.current.clear();
      setRecommendedStyles([]);
      setStyleError(null);
      setLastStyleRequest(null);
      return;
    }

    setRecommendedStyles(currentStyles);
  }, [currentStyles, mermaidCode]);

  const runOptimization = useCallback(
    async (params: { request?: string; preset?: ThemePreset; isDefault?: boolean }) => {
      if (!mermaidCode.trim() || !isValidMermaid(mermaidCode)) {
        return;
      }

      const requestId = ++requestIdRef.current;
      setIsOptimizing(true);
      setStyleError(null);

      try {
        const graphInfo = mermaidConverter.extractGraphInfoFromCode(mermaidCode);
        const result = params.isDefault || params.preset
          ? await styleRecommendationService.recommendDefault(graphInfo, mermaidCode, {
            usageScenario,
            theme: params.preset || themePreset,
          })
          : await styleRecommendationService.adjustStyle(
            graphInfo,
            mermaidCode,
            params.request || ''
          );

        if (requestId !== requestIdRef.current) {
          return;
        }

        setRecommendedStyles(result.styleSchemes);
        setLastStyleRequest(
          params.request || (params.preset ? PRESET_REQUESTS[params.preset] : PRESET_REQUESTS[themePreset])
        );

        await onMermaidCodeChange?.(result.mermaidCode);
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setStyleError(error instanceof Error ? error.message : '样式优化失败');
      } finally {
        if (requestId === requestIdRef.current) {
          setIsOptimizing(false);
        }
      }
    },
    [mermaidCode, onMermaidCodeChange, themePreset, usageScenario]
  );

  useEffect(() => {
    if (!mermaidCode.trim() || !isValidMermaid(mermaidCode) || currentStyles.length > 0) {
      return;
    }

    const structureKey = clearStyles(mermaidCode);
    if (!structureKey || autoStyledStructureKeysRef.current.has(structureKey)) {
      return;
    }

    autoStyledStructureKeysRef.current.add(structureKey);
    void runOptimization({ isDefault: true });
  }, [currentStyles.length, mermaidCode, runOptimization]);

  const applyPreset = useCallback(async (theme: ThemePreset) => {
    await runOptimization({ preset: theme });
  }, [runOptimization]);

  const optimizeByPrompt = useCallback(async (request: string) => {
    const trimmedRequest = request.trim();
    if (!trimmedRequest) {
      return;
    }

    await runOptimization({ request: trimmedRequest });
  }, [runOptimization]);

  const resetStyleState = useCallback(() => {
    setStyleError(null);
    setLastStyleRequest(null);
  }, []);

  return {
    isOptimizing,
    styleError,
    lastStyleRequest,
    recommendedStyles,
    applyPreset,
    optimizeByPrompt,
    resetStyleState,
  };
}

function normalizeThemePreset(theme: string | undefined): ThemePreset {
  if (theme === 'professional' || theme === 'lively' || theme === 'minimal') {
    return theme;
  }

  return 'academic';
}
