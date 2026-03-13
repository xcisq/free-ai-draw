import type {
  LayoutIntent,
  PipelineLocalTemplateId,
  PipelineTemplateId,
  TemplateFitFeatures,
} from '../types/analyzer';

export interface PipelineTemplateMatch {
  rootTemplateId: PipelineTemplateId;
  localTemplateIds: PipelineLocalTemplateId[];
  features: TemplateFitFeatures;
}

const ROOT_TEMPLATE_PRIORITY: PipelineTemplateId[] = [
  'paired-state-simulator',
  'spine-lower-branch',
  'split-merge',
  'input-core-output',
  'outer-feedback-loop',
  'linear-spine',
];

function countByNodeRole(intent: LayoutIntent, role: string) {
  return intent.nodes.filter((node) => node.role === role).length;
}

export function buildTemplateFitFeatures(intent: LayoutIntent): TemplateFitFeatures {
  return {
    spineLength: intent.dominantSpine.length,
    branchCount: intent.branchRoots.length,
    mergeCount: intent.mergeNodes.length,
    feedbackCount: intent.feedbackEdges.length,
    inputContainerCount: intent.nodes.filter((node) => node.primitive === 'container').length,
    stateNodeCount: countByNodeRole(intent, 'state') + countByNodeRole(intent, 'output'),
    simulatorNodeCount: countByNodeRole(intent, 'simulator'),
    topControlCount: intent.nodes.filter(
      (node) => node.preferredRail === 'top_control_rail'
    ).length,
    bottomAuxCount: intent.nodes.filter(
      (node) => node.preferredRail === 'bottom_aux_rail'
    ).length,
    outputNodeCount: countByNodeRole(intent, 'output'),
  };
}

function scoreTemplate(
  templateId: PipelineTemplateId,
  features: TemplateFitFeatures
) {
  switch (templateId) {
    case 'paired-state-simulator':
      return (
        (features.simulatorNodeCount > 0 ? 0.55 : 0) +
        Math.min(features.stateNodeCount, 2) * 0.18 +
        (features.branchCount > 0 ? 0.1 : 0)
      );
    case 'spine-lower-branch':
      return (
        (features.branchCount > 0 ? 0.45 : 0) +
        (features.bottomAuxCount > 0 ? 0.3 : 0) +
        Math.min(features.spineLength / 6, 0.25)
      );
    case 'split-merge':
      return (
        (features.branchCount > 0 ? 0.35 : 0) +
        (features.mergeCount > 0 ? 0.35 : 0) +
        Math.min(features.branchCount / 3, 0.2)
      );
    case 'input-core-output':
      return (
        (features.inputContainerCount > 0 ? 0.4 : 0.2) +
        (features.outputNodeCount > 0 ? 0.25 : 0) +
        Math.min(features.spineLength / 8, 0.2)
      );
    case 'outer-feedback-loop':
      return features.feedbackCount > 0 ? 0.55 + Math.min(features.feedbackCount * 0.1, 0.2) : 0;
    case 'linear-spine':
    default:
      return 0.2 + Math.min(features.spineLength / 8, 0.4);
  }
}

function getLocalTemplates(
  intent: LayoutIntent,
  features: TemplateFitFeatures,
  rootTemplateId: PipelineTemplateId
): PipelineLocalTemplateId[] {
  const localTemplateIds = new Set<PipelineLocalTemplateId>();

  if (features.inputContainerCount > 0) {
    localTemplateIds.add('input-container-stack');
  }
  if (features.stateNodeCount >= 2) {
    localTemplateIds.add('state-before-after');
  }
  if (features.branchCount > 0 && features.mergeCount > 0 && rootTemplateId !== 'split-merge') {
    localTemplateIds.add('small-fan-in');
  }
  if (features.branchCount > 0) {
    localTemplateIds.add('small-fan-out');
  }
  if (intent.modules.some((moduleItem) => moduleItem.members.length === 2)) {
    localTemplateIds.add('horizontal-pair');
  }

  return [...localTemplateIds];
}

export function matchPipelineTemplates(
  intent: LayoutIntent
): PipelineTemplateMatch {
  const features = buildTemplateFitFeatures(intent);
  const sortedTemplates = [...ROOT_TEMPLATE_PRIORITY].sort((left, right) => {
    const scoreDelta = scoreTemplate(right, features) - scoreTemplate(left, features);
    if (Math.abs(scoreDelta) > 1e-6) {
      return scoreDelta;
    }
    return ROOT_TEMPLATE_PRIORITY.indexOf(left) - ROOT_TEMPLATE_PRIORITY.indexOf(right);
  });

  let rootTemplateId = sortedTemplates[0];
  const rootScore = scoreTemplate(rootTemplateId, features);

  if (rootScore < 0.55) {
    rootTemplateId =
      features.inputContainerCount > 0
        ? 'input-core-output'
        : features.branchCount > 0
          ? 'spine-lower-branch'
          : 'linear-spine';
  }

  return {
    rootTemplateId,
    localTemplateIds: getLocalTemplates(intent, features, rootTemplateId),
    features,
  };
}
