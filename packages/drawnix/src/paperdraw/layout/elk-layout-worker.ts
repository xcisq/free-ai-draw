import type { PlaitElement } from '@plait/core';
import type { AnalysisResult, ElkLayoutOptions, LayoutResult } from '../types/analyzer';

interface ElkWorkerSuccess {
  ok: true;
  layout: LayoutResult;
}

interface ElkWorkerFailure {
  ok: false;
  error: string;
}

type ElkWorkerResponse = ElkWorkerSuccess | ElkWorkerFailure;

export function runElkLayoutInWorker(
  analysis: AnalysisResult,
  elements: PlaitElement[],
  options: ElkLayoutOptions
) {
  return new Promise<LayoutResult>((resolve, reject) => {
    const worker = new Worker(
      new URL('./elk-layout.worker.ts', import.meta.url),
      {
        type: 'module',
      }
    );

    const timer = window.setTimeout(() => {
      worker.terminate();
      reject(new Error('ELK worker timeout'));
    }, options.timeoutMs ?? 4000);

    worker.onmessage = (event: MessageEvent<ElkWorkerResponse>) => {
      window.clearTimeout(timer);
      worker.terminate();
      if (event.data.ok) {
        resolve(event.data.layout);
      } else {
        reject(new Error(event.data.error));
      }
    };

    worker.onerror = (event) => {
      window.clearTimeout(timer);
      worker.terminate();
      reject(new Error(event.message || 'ELK worker crashed'));
    };

    worker.postMessage({
      analysis,
      elements,
      options,
    });
  });
}
