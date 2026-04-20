import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlaitElement } from '@plait/core';
import type {
  ComposerState,
  GenerationContext,
  OneShotMermaidDraft,
  PromptAssistSuggestion,
} from '../types';
import { llmChatService } from '../services/llm-chat-service';
import {
  applyPromptAssistSuggestion,
  buildPreviewMermaidConfig,
  createGenerationContext,
  createOneShotDraft,
  createPromptAssistState,
  deriveRenderPreset,
} from '../services/one-shot-assist';
import {
  getInitialPrompt,
  buildMermaidUserPrompt,
} from '../services/prompt-templates';
import {
  mermaidStabilizerService,
  MermaidStabilizationError,
} from '../services/mermaid-stabilizer';
import { sanitizeUserInput, validateUserInput } from '../utils/message-validator';
import { extractStreamingMermaidCandidate } from '../utils/mermaid-helper';
import { useMermaidPreview } from './use-mermaid-preview';

function createMessage(
  role: 'system' | 'user' | 'assistant',
  content: string,
  type: 'text' | 'mermaid' = 'text'
) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    content,
    timestamp: Date.now(),
    type,
  } as const;
}

export interface UseOneShotMermaidComposerResult {
  state: ComposerState;
  submittedDraft: OneShotMermaidDraft | null;
  submittedRenderPreset: ComposerState['renderPreset'];
  elements: PlaitElement[];
  isPreviewLoading: boolean;
  validation: ReturnType<typeof useMermaidPreview>['validation'];
  isValid: boolean;
  error: Error | null;
  previewError: string | null;
  setSourceText: (value: string) => void;
  updateContext: (updates: Partial<GenerationContext>) => void;
  applySuggestion: (suggestion: PromptAssistSuggestion) => void;
  generate: () => Promise<void>;
  regenerate: () => Promise<void>;
  updateMermaidCode: (code: string) => Promise<void>;
  setCodeEditorOpen: (open: boolean) => void;
  toggleCodeEditor: () => void;
  clearError: () => void;
  reset: () => void;
}

export function useOneShotMermaidComposer(): UseOneShotMermaidComposerResult {
  const [sourceText, setSourceText] = useState('');
  const [context, setContext] = useState<GenerationContext>(() => createGenerationContext());
  const [phase, setPhase] = useState<ComposerState['phase']>('idle');
  const [mermaidCode, setMermaidCode] = useState('');
  const [submittedCode, setSubmittedCode] = useState('');
  const [submittedDraft, setSubmittedDraft] = useState<OneShotMermaidDraft | null>(null);
  const [submittedRenderPreset, setSubmittedRenderPreset] = useState(() =>
    deriveRenderPreset('', createGenerationContext())
  );
  const [isCodeEditorOpen, setCodeEditorOpen] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    elements,
    isConverting,
    validation,
    isValid,
    error: previewError,
    updateCode,
    clear,
    clearError: clearPreviewError,
  } = useMermaidPreview();

  const draft = useMemo(() => createOneShotDraft(sourceText, context), [sourceText, context]);
  const assist = useMemo(
    () => createPromptAssistState(sourceText, draft.context),
    [draft.context, sourceText]
  );
  const renderPreset = useMemo(
    () => deriveRenderPreset(sourceText, draft.context),
    [draft.context, sourceText]
  );

  useEffect(() => {
    if (!sourceText.trim() && phase === 'idle' && mermaidCode) {
      setMermaidCode('');
      setSubmittedCode('');
      clear();
    }
  }, [clear, mermaidCode, phase, sourceText]);

  useEffect(() => {
    if (previewError) {
      setPhase('error');
      return;
    }

    if (!error && mermaidCode.trim() && phase === 'error') {
      setPhase('ready');
    }
  }, [error, mermaidCode, phase, previewError]);

  const syncPreview = useCallback(
    async (
      code: string,
      options: {
        suppressErrors?: boolean;
        preserveElementsOnFailure?: boolean;
      } = {}
    ) => {
      const nextCode = await updateCode(code, {
        allowLLMRepair: false,
        mermaidConfig: buildPreviewMermaidConfig(submittedRenderPreset),
        suppressErrors: options.suppressErrors,
        preserveElementsOnFailure: options.preserveElementsOnFailure,
      });
      setMermaidCode(nextCode);
      return nextCode;
    },
    [submittedRenderPreset, updateCode]
  );

  const updateContext = useCallback((updates: Partial<GenerationContext>) => {
    setContext((previous) => createGenerationContext({ ...previous, ...updates }));
  }, []);

  const applySuggestion = useCallback((suggestion: PromptAssistSuggestion) => {
    setContext((previousContext) => {
      const applied = applyPromptAssistSuggestion(sourceText, previousContext, suggestion);
      if (applied.sourceText !== sourceText) {
        setSourceText(applied.sourceText);
      }
      return createGenerationContext(applied.context);
    });
  }, [sourceText]);

  const clearError = useCallback(() => {
    setError(null);
    clearPreviewError();
  }, [clearPreviewError]);

  const runGeneration = useCallback(
    async (requestedSourceText: string, requestedContext: GenerationContext) => {
      const validationResult = validateUserInput(requestedSourceText);
      if (!validationResult.isValid) {
        setError(new Error(validationResult.errors.join('，')));
        return;
      }

      const sanitizedSourceText = sanitizeUserInput(requestedSourceText);
      const nextDraft = createOneShotDraft(sanitizedSourceText, requestedContext);
      const nextRenderPreset = deriveRenderPreset(sanitizedSourceText, nextDraft.context);
      const previewConfig = buildPreviewMermaidConfig(nextRenderPreset);
      const requestContent = buildMermaidUserPrompt(
        nextDraft.normalizedSourceText,
        nextDraft.context,
        {
          requestKind: 'generate',
        }
      );

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setPhase('generating');
      setError(null);
      clearPreviewError();
      clear();
      setCodeEditorOpen(false);
      setSubmittedDraft(nextDraft);
      setSubmittedRenderPreset(nextRenderPreset);
      setSubmittedCode('');
      setMermaidCode('');

      let responseContent = '';

      try {
        for await (const chunk of llmChatService.chatStream(
          [
            createMessage('system', getInitialPrompt()),
            createMessage('user', requestContent),
          ],
          {
            signal: controller.signal,
            temperature: 0.35,
            maxTokens: 2400,
          }
        )) {
          responseContent += chunk.choices[0]?.delta?.content || '';
        }

        if (controller.signal.aborted) {
          return;
        }

        setPhase('stabilizing');

        const stabilizedResult = await mermaidStabilizerService.stabilizeResponse(responseContent, {
          allowLLMRepair: false,
          originalRequest: requestContent,
          signal: controller.signal,
          mermaidConfig: previewConfig,
        });

        if (controller.signal.aborted) {
          return;
        }

        setSubmittedCode(stabilizedResult.mermaidCode);
        setMermaidCode(stabilizedResult.mermaidCode);

        await updateCode(stabilizedResult.mermaidCode, {
          allowLLMRepair: false,
          mermaidConfig: previewConfig,
        });

        setPhase('ready');
      } catch (generationError) {
        if (generationError instanceof DOMException && generationError.name === 'AbortError') {
          return;
        }

        let bestEffortCode = '';
        if (generationError instanceof MermaidStabilizationError) {
          bestEffortCode =
            generationError.bestEffortCode ||
            extractStreamingMermaidCandidate(responseContent) ||
            '';
        } else {
          bestEffortCode = extractStreamingMermaidCandidate(responseContent) || '';
        }

        if (bestEffortCode) {
          setSubmittedCode(bestEffortCode);
          setMermaidCode(bestEffortCode);
          await updateCode(bestEffortCode, {
            allowLLMRepair: false,
            mermaidConfig: previewConfig,
            suppressErrors: true,
            preserveElementsOnFailure: true,
          });
        }

        setPhase('error');
        setError(
          generationError instanceof Error
            ? generationError
            : new Error('Mermaid 生成失败')
        );
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [clear, clearPreviewError, updateCode]
  );

  const generate = useCallback(async () => {
    await runGeneration(sourceText, context);
  }, [context, runGeneration, sourceText]);

  const regenerate = useCallback(async () => {
    await runGeneration(sourceText, context);
  }, [context, runGeneration, sourceText]);

  const updateMermaidCode = useCallback(
    async (code: string) => {
      const normalizedCode = code.trim();
      if (!normalizedCode) {
        setMermaidCode('');
        clear();
        return;
      }

      await syncPreview(code);
      setPhase('ready');
    },
    [clear, syncPreview]
  );

  const toggleCodeEditor = useCallback(() => {
    if (!submittedCode.trim()) {
      return;
    }
    setCodeEditorOpen((previous) => !previous);
  }, [submittedCode]);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSourceText('');
    setContext(createGenerationContext());
    setPhase('idle');
    setMermaidCode('');
    setSubmittedCode('');
    setSubmittedDraft(null);
    setSubmittedRenderPreset(deriveRenderPreset('', createGenerationContext()));
    setCodeEditorOpen(false);
    setError(null);
    clear();
    clearPreviewError();
  }, [clear, clearPreviewError]);

  const state = useMemo<ComposerState>(
    () => ({
      sourceText,
      context,
      assist,
      draft,
      renderPreset,
      phase,
      mermaidCode,
      submittedCode,
      isCodeEditorOpen,
    }),
    [assist, context, draft, isCodeEditorOpen, mermaidCode, phase, renderPreset, sourceText, submittedCode]
  );

  return {
    state,
    submittedDraft,
    submittedRenderPreset,
    elements,
    isPreviewLoading: isConverting,
    validation,
    isValid,
    error,
    previewError,
    setSourceText,
    updateContext,
    applySuggestion,
    generate,
    regenerate,
    updateMermaidCode,
    setCodeEditorOpen,
    toggleCodeEditor,
    clearError,
    reset,
  };
}
