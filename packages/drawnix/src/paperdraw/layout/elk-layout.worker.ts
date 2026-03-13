import type { AnalysisResult, ElkLayoutOptions, LayoutResult } from '../types/analyzer';
import { computeOptimizedLayoutV2 } from './layout-optimizer-v2';

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
    const layout = await computeOptimizedLayoutV2(
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
