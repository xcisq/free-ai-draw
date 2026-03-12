import type { PlaitElement } from '@plait/core';
import {
  type AnalysisResult,
  type DraftFlowchartState,
  type ElkLayoutOptions,
  type LayoutResult,
} from '../types/analyzer';
import { basicLayout } from '../layout/basic-layout';
import { runElkLayoutInWorker } from '../layout/elk-layout-worker';
import { optimizeLayout } from '../layout/optimize-layout';
import { buildFlowchartElements } from './build-flowchart-elements';

function mergeLayoutIntoElements(
  currentElements: PlaitElement[],
  layout: LayoutResult
) {
  const nextKnownElements = new Map(
    buildFlowchartElements(layout).map((element) => [element.id, element])
  );

  return currentElements.map((element) => {
    const nextElement = nextKnownElements.get(element.id);
    if (!nextElement) {
      return element;
    }

    if ((element as any).type === 'arrow-line' && (nextElement as any).type === 'arrow-line') {
      return {
        ...element,
        shape: (nextElement as any).shape,
        source: (nextElement as any).source,
        target: (nextElement as any).target,
        points: (nextElement as any).points,
      };
    }

    if ((element as any).points && (nextElement as any).points) {
      return {
        ...element,
        points: (nextElement as any).points,
      };
    }

    return nextElement;
  });
}

export function buildFlowchartState(
  analysis: AnalysisResult
): DraftFlowchartState {
  const layout = basicLayout(analysis);
  const elements = buildFlowchartElements(layout);

  return {
    analysis,
    layout,
    elements,
  };
}

export function buildOptimizedFlowchartState(
  analysis: AnalysisResult,
  currentElements?: PlaitElement[]
): DraftFlowchartState {
  const layout = optimizeLayout(analysis);
  const elements = currentElements
    ? mergeLayoutIntoElements(currentElements, layout)
    : buildFlowchartElements(layout);

  return {
    analysis,
    layout,
    elements,
  };
}

export async function buildElkOptimizedFlowchartState(
  analysis: AnalysisResult,
  currentElements: PlaitElement[],
  options: ElkLayoutOptions
): Promise<DraftFlowchartState> {
  const layout = await runElkLayoutInWorker(analysis, currentElements, options);

  return {
    analysis,
    layout,
    elements: mergeLayoutIntoElements(currentElements, layout),
  };
}
