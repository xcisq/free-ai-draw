import type { PlaitElement } from '@plait/core';
import type { MermaidConfig } from '@plait-board/mermaid-to-drawnix/dist';
import type { ValidationResult } from '../types';
import { llmChatService } from './llm-chat-service';
import { mermaidConverter } from './mermaid-converter';
import {
  extractMermaidCode,
  getMermaidRepairPrompt,
  validateMermaidCode,
} from './prompt-templates';
import { normalizeMermaidCode } from '../utils/mermaid-helper';
import { mermaidParseService } from './mermaid-parse-service';

export type MermaidStabilizationSource = 'original' | 'local-fix' | 'llm-repair';
export type MermaidFailureStage = 'extract' | 'validate' | 'convert' | 'repair';

export interface MermaidStabilizeOptions {
  allowLLMRepair?: boolean;
  originalRequest?: string;
  signal?: AbortSignal;
  requireElements?: boolean;
  mermaidConfig?: MermaidConfig;
}

export interface MermaidStabilizeResult {
  mermaidCode: string;
  elements: PlaitElement[];
  validation: ValidationResult;
  source: MermaidStabilizationSource;
  appliedFixes: string[];
}

export class MermaidStabilizationError extends Error {
  constructor(
    message: string,
    public stage: MermaidFailureStage,
    public details: string[] = [],
    public bestEffortCode?: string,
    public validation?: ValidationResult
  ) {
    super(message);
    this.name = 'MermaidStabilizationError';
  }
}

interface CandidateAttemptResult {
  mermaidCode: string;
  elements: PlaitElement[];
  validation: ValidationResult;
}

interface CandidateAttemptSummary {
  result: CandidateAttemptResult | null;
  validation: ValidationResult;
  conversionError: string | null;
}

export class MermaidStabilizerService {
  async stabilizeResponse(
    responseContent: string,
    options: MermaidStabilizeOptions = {}
  ): Promise<MermaidStabilizeResult> {
    return this.stabilize(responseContent, {
      ...options,
      sourceText: responseContent,
    });
  }

  async stabilizeCode(
    mermaidCode: string,
    options: MermaidStabilizeOptions = {}
  ): Promise<MermaidStabilizeResult> {
    return this.stabilize(mermaidCode, options);
  }

  private async stabilize(
    input: string,
    options: MermaidStabilizeOptions & { sourceText?: string } = {}
  ): Promise<MermaidStabilizeResult> {
    throwIfAborted(options.signal);
    const rawCode = extractMermaidCode(input);

    if (!rawCode.trim()) {
      throw new MermaidStabilizationError(
        'AI 返回结果中没有可提取的 Mermaid 正文',
        'extract',
        ['模型没有直接输出可识别的 Mermaid 图代码']
      );
    }

    const normalized = normalizeMermaidCode(rawCode);
    const localCandidate = normalized.code.trim();

    if (!localCandidate) {
      throw new MermaidStabilizationError(
        'AI 返回结果中没有可提取的 Mermaid 正文',
        'extract',
        ['模型没有直接输出可识别的 Mermaid 图代码'],
        normalized.code || rawCode.trim()
      );
    }

    const localAttempt = await this.tryCandidate(
      localCandidate,
      options.requireElements !== false,
      options.signal,
      options.mermaidConfig
    );
    if (localAttempt.result) {
      throwIfAborted(options.signal);
      return {
        ...localAttempt.result,
        source:
          localAttempt.result.mermaidCode === rawCode.trim() && normalized.appliedFixes.length === 0
            ? 'original'
            : 'local-fix',
        appliedFixes: normalized.appliedFixes,
      };
    }

    const localErrors = collectFailureDetails(localAttempt.validation, localAttempt.conversionError);

    if (!options.allowLLMRepair) {
      throw new MermaidStabilizationError(
        buildFailureMessage(localErrors, false),
        resolveFailureStage(localAttempt.validation, localAttempt.conversionError),
        localErrors,
        selectBestEffortCode([localCandidate], normalized.code),
        localAttempt.validation
      );
    }

    const repairedResponse = await llmChatService.repairMermaid(
      getMermaidRepairPrompt({
        brokenMermaid: normalized.code,
        errors: localErrors,
        originalRequest: options.originalRequest,
      }),
      {
        signal: options.signal,
      }
    );
    throwIfAborted(options.signal);

    const repairedNormalization = normalizeMermaidCode(repairedResponse);
    const repairedCandidate = repairedNormalization.code.trim();
    const repairedAttempt = await this.tryCandidate(
      repairedCandidate,
      options.requireElements !== false,
      options.signal,
      options.mermaidConfig
    );

    if (repairedAttempt.result) {
      throwIfAborted(options.signal);
      return {
        ...repairedAttempt.result,
        source: 'llm-repair',
        appliedFixes: [...normalized.appliedFixes, ...repairedNormalization.appliedFixes, 'LLM 定向修复'],
      };
    }

    const repairedErrors = collectFailureDetails(
      repairedAttempt.validation,
      repairedAttempt.conversionError
    );
    throw new MermaidStabilizationError(
      buildFailureMessage(repairedErrors, true),
      resolveFailureStage(repairedAttempt.validation, repairedAttempt.conversionError, true),
      repairedErrors,
      selectBestEffortCode([repairedCandidate], repairedNormalization.code, normalized.code),
      repairedAttempt.validation
    );
  }

  private async tryCandidate(
    candidate: string,
    requireElements: boolean,
    signal?: AbortSignal,
    mermaidConfig?: MermaidConfig
  ): Promise<CandidateAttemptSummary> {
    const validation = await this.validateCandidate(candidate);
    if (!validation.isValid) {
      return {
        result: null,
        validation,
        conversionError: null,
      };
    }

    if (!requireElements) {
      return {
        result: {
          mermaidCode: candidate,
          validation,
          elements: [],
        },
        validation,
        conversionError: null,
      };
    }

    let conversionError: string | null = null;
    try {
      throwIfAborted(signal);
      const elements = await mermaidConverter.convertToElements(candidate, mermaidConfig);
      throwIfAborted(signal);
      return {
        result: {
          mermaidCode: candidate,
          validation,
          elements,
        },
        validation,
        conversionError: null,
      };
    } catch (error) {
      conversionError = error instanceof Error ? error.message : 'Mermaid 转换失败';
    }

    return {
      result: null,
      validation,
      conversionError,
    };
  }

  private async validateCandidate(candidate: string): Promise<ValidationResult> {
    const heuristicValidation = validateMermaidCode(candidate);
    const parseValidation = await mermaidParseService.validate(candidate);
    return mergeValidation(heuristicValidation, parseValidation);
  }
}

function mergeValidation(
  heuristicValidation: ValidationResult,
  parseValidation: ValidationResult
): ValidationResult {
  return {
    isValid: parseValidation.isValid,
    errors: parseValidation.isValid
      ? []
      : Array.from(new Set([...heuristicValidation.errors, ...parseValidation.errors])).filter(
          Boolean
        ),
    warnings: Array.from(new Set([...heuristicValidation.warnings, ...parseValidation.warnings])).filter(
      Boolean
    ),
  };
}

function collectFailureDetails(validation: ValidationResult, conversionError: string | null): string[] {
  const details = [...validation.errors];
  if (validation.warnings.length > 0) {
    details.push(...validation.warnings);
  }
  if (conversionError) {
    details.push(conversionError);
  }
  return Array.from(new Set(details)).filter(Boolean);
}

function resolveFailureStage(
  validation: ValidationResult,
  conversionError: string | null,
  afterRepair = false
): MermaidFailureStage {
  if (afterRepair) {
    return 'repair';
  }

  if (validation.errors.length > 0) {
    return 'validate';
  }

  if (conversionError) {
    return 'convert';
  }

  return 'extract';
}

function buildFailureMessage(errors: string[], attemptedRepair: boolean): string {
  const reason = errors[0] || '未知 Mermaid 语法问题';

  if (attemptedRepair) {
    return `Mermaid 代码已尝试自动修复，但仍无法稳定预览：${reason}`;
  }

  return `Mermaid 代码暂时无法预览：${reason}`;
}

function selectBestEffortCode(
  candidates: string[],
  ...fallbackCandidates: Array<string | undefined>
) {
  const rankedCandidates = [...candidates, ...fallbackCandidates]
    .map((candidate) => candidate?.trim())
    .filter((candidate): candidate is string => Boolean(candidate))
    .filter((candidate, index, array) => array.indexOf(candidate) === index)
    .map((candidate) => ({
      candidate,
      validation: validateMermaidCode(candidate),
    }))
    .sort((left, right) => {
      if (left.validation.errors.length !== right.validation.errors.length) {
        return left.validation.errors.length - right.validation.errors.length;
      }

      if (left.validation.warnings.length !== right.validation.warnings.length) {
        return left.validation.warnings.length - right.validation.warnings.length;
      }

      return right.candidate.length - left.candidate.length;
    });

  return rankedCandidates[0]?.candidate;
}

export const mermaidStabilizerService = new MermaidStabilizerService();

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
}
