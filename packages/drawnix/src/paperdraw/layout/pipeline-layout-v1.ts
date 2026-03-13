import type {
  AnalysisResult,
  LayoutOptimizeOptions,
  LayoutResult,
} from '../types/analyzer';
import { buildLayoutConstraintModel } from './constraint-model';
import { refineLayoutWithElk } from './elk-layout';
import { withLayoutMetrics } from './layout-metrics';
import { routeLayoutOrthogonally } from './orthogonal-router';
import { buildLayoutIntent } from './pipeline-layout-intent';
import { generatePipelineSkeletonLayout } from './pipeline-skeleton-generator';
import { matchPipelineTemplates } from './pipeline-template-matcher';

export async function computePipelineLayoutV1(
  analysis: AnalysisResult,
  layout: LayoutResult,
  options: LayoutOptimizeOptions
): Promise<LayoutResult> {
  const intent = buildLayoutIntent(analysis, layout);
  if (!intent.dominantSpine.length) {
    throw new Error('PIPELINE_INTENT_NO_SPINE');
  }

  const templateMatch = matchPipelineTemplates(intent);
  const skeletonLayout = generatePipelineSkeletonLayout(
    layout,
    intent,
    templateMatch
  );
  const model = buildLayoutConstraintModel(skeletonLayout, options);
  const refined = await refineLayoutWithElk(skeletonLayout, model);
  const routed = routeLayoutOrthogonally(
    {
      ...refined,
      engine: 'pipeline_v1',
      templateId: templateMatch.rootTemplateId,
    },
    model
  );

  return withLayoutMetrics(
    {
      ...routed,
      engine: 'pipeline_v1',
      templateId: templateMatch.rootTemplateId,
    },
    model
  );
}
