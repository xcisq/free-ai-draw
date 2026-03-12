import type { AnalysisResult, ElkLayoutOptions, LayoutResult } from '../types/analyzer';
import { computeElkOptimizedLayout } from './elk-layout';

interface ElkWorkerRequest {
  analysis: AnalysisResult;
  elements: any[];
  options: ElkLayoutOptions;
}

interface ElkWorkerSuccess {
  ok: true;
  layout: LayoutResult;
}

interface ElkWorkerFailure {
  ok: false;
  error: string;
}

self.onmessage = async (
  event: MessageEvent<ElkWorkerRequest>
) => {
  try {
    const layout = await computeElkOptimizedLayout(
      event.data.analysis,
      event.data.elements as any,
      event.data.options
    );
    const payload: ElkWorkerSuccess = {
      ok: true,
      layout,
    };
    self.postMessage(payload);
  } catch (error: any) {
    const payload: ElkWorkerFailure = {
      ok: false,
      error: error?.message ?? 'ELK layout failed',
    };
    self.postMessage(payload);
  }
};

export {};
