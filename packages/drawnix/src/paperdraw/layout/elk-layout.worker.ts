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

type ElkWorkerScope = {
  onmessage: ((event: MessageEvent<ElkWorkerRequest>) => void | Promise<void>) | null;
  postMessage: (message: ElkWorkerSuccess | ElkWorkerFailure) => void;
};

const workerScope = globalThis as unknown as ElkWorkerScope;

workerScope.onmessage = async (
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
    workerScope.postMessage(payload);
  } catch (error: unknown) {
    const payload: ElkWorkerFailure = {
      ok: false,
      error: error instanceof Error ? error.message : 'ELK layout failed',
    };
    workerScope.postMessage(payload);
  }
};

export {};
