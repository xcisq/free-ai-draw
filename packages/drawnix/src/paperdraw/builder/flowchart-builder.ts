import { AnalysisResult, DraftFlowchartState } from '../types/analyzer';
import { basicLayout } from '../layout/basic-layout';
import { optimizeLayout } from '../layout/optimize-layout';
import { buildFlowchartElements } from './build-flowchart-elements';

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
  analysis: AnalysisResult
): DraftFlowchartState {
  const layout = optimizeLayout(analysis);
  const elements = buildFlowchartElements(layout);

  return {
    analysis,
    layout,
    elements,
  };
}
