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
  'input-core-output',
  'spine-lower-branch',
  'split-merge',
  'paired-state-simulator',
  'outer-feedback-loop',
  'linear-spine',
];

function countByNodeRole(intent: LayoutIntent, role: string) {
  return intent.nodes.filter((node) => node.role === role).length;
}

export function buildTemplateFitFeatures(intent: LayoutIntent): TemplateFitFeatures {
  const inputModuleCount = intent.modules.filter(
    (moduleItem) => moduleItem.role === 'input_stage'
  ).length;
  const topControlCount = intent.nodes.filter(
    (node) => node.preferredRail === 'top_control_rail'
  ).length;
  const bottomAuxCount = intent.nodes.filter(
    (node) => node.preferredRail === 'bottom_aux_rail'
  ).length;

  return {
    spineLength: intent.dominantSpine.length,
    spineSegmentCount: intent.spineSegments.length,
    branchCount: intent.branchRoots.length,
    branchAttachmentCount: intent.branchAttachments.length,
    mergeCount: intent.mergeNodes.length,
    mergeClusterCount: intent.mergeClusters.length,
    feedbackCount: intent.feedbackEdges.length,
    inputContainerCount: intent.inputContainers.length,
    inputModuleCount,
    stateNodeCount: countByNodeRole(intent, 'state') + countByNodeRole(intent, 'output'),
    statePairCount: intent.statePairs.length,
    simulatorNodeCount: countByNodeRole(intent, 'simulator'),
    topControlCount,
    bottomAuxCount,
    outputNodeCount: countByNodeRole(intent, 'output'),
    inputZoneScore: intent.zoneScores.inputZoneScore,
    controlZoneScore: intent.zoneScores.controlZoneScore,
    auxZoneScore: intent.zoneScores.auxZoneScore,
    outputZoneScore: intent.zoneScores.outputZoneScore,
  };
}

function scoreTemplate(
  templateId: PipelineTemplateId,
  features: TemplateFitFeatures
) {
  switch (templateId) {
    case 'input-core-output':
      return (
        features.inputZoneScore * 0.28 +
        features.outputZoneScore * 0.24 +
        (features.inputContainerCount > 0 ? 0.2 : 0) +
        (features.inputModuleCount > 0 ? 0.08 : 0) +
        Math.min(features.spineLength / 8, 0.14) +
        (features.branchAttachmentCount <= 1 ? 0.06 : 0)
      );
    case 'spine-lower-branch':
      return (
        (features.branchAttachmentCount > 0 ? 0.3 : 0) +
        features.auxZoneScore * 0.24 +
        Math.min(features.branchCount / 4, 0.12) +
        Math.min(features.mergeClusterCount / 2, 0.12) +
        Math.min(features.spineLength / 8, 0.12) +
        (features.bottomAuxCount > 0 ? 0.08 : 0)
      );
    case 'split-merge':
      return (
        (features.mergeClusterCount > 0 ? 0.34 : 0) +
        (features.mergeClusterCount > 0 && features.branchCount > 0 ? 0.18 : 0) +
        (features.branchAttachmentCount > 0 ? 0.14 : 0) +
        Math.min(features.branchCount / 3, 0.12) +
        Math.min(features.mergeCount / 2, 0.12) +
        (features.auxZoneScore > 0.2 ? 0.04 : 0)
      );
    case 'paired-state-simulator':
      return (
        (features.simulatorNodeCount > 0 ? 0.3 : 0) +
        (features.statePairCount > 0 ? 0.26 : 0) +
        Math.min(features.stateNodeCount / 4, 0.12) +
        features.outputZoneScore * 0.08 +
        features.inputZoneScore * 0.06 +
        (features.branchAttachmentCount > 0 ? 0.04 : 0)
      );
    case 'outer-feedback-loop':
      return (
        (features.feedbackCount > 0 ? 0.42 : 0) +
        Math.min(features.feedbackCount / 3, 0.18) +
        Math.min(features.spineLength / 10, 0.08) +
        (features.outputZoneScore > 0.2 ? 0.06 : 0)
      );
    case 'linear-spine':
    default:
      return (
        0.18 +
        Math.min(features.spineLength / 8, 0.3) -
        Math.min(features.branchAttachmentCount * 0.06, 0.18) -
        Math.min(features.mergeClusterCount * 0.05, 0.15)
      );
  }
}

function getLocalTemplates(
  intent: LayoutIntent,
  features: TemplateFitFeatures,
  rootTemplateId: PipelineTemplateId
): PipelineLocalTemplateId[] {
  const localTemplateIds = new Set<PipelineLocalTemplateId>();

  if (features.inputContainerCount > 0 || features.inputZoneScore > 0.3) {
    localTemplateIds.add('input-container-stack');
  }
  if (features.statePairCount > 0) {
    localTemplateIds.add('state-before-after');
  }
  if (features.branchAttachmentCount > 0) {
    localTemplateIds.add('small-fan-out');
  }
  if (features.mergeClusterCount > 0 || rootTemplateId === 'split-merge') {
    localTemplateIds.add('small-fan-in');
  }
  if (intent.nodes.some((node) => node.primitive === 'media-card')) {
    localTemplateIds.add('media-with-caption');
  }
  if (intent.modules.some((moduleItem) => moduleItem.members.length === 2)) {
    localTemplateIds.add('horizontal-pair');
  }
  if (
    intent.modules.some(
      (moduleItem) =>
        moduleItem.members.length === 2 &&
        (moduleItem.role === 'control_stage' || moduleItem.role === 'auxiliary_stage')
    )
  ) {
    localTemplateIds.add('vertical-pair');
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

  if (rootScore < 0.58) {
    rootTemplateId =
      features.inputZoneScore >= 0.25 && features.outputZoneScore >= 0.2
        ? 'input-core-output'
        : features.branchAttachmentCount > 0
          ? 'spine-lower-branch'
          : 'linear-spine';
  }

  return {
    rootTemplateId,
    localTemplateIds: getLocalTemplates(intent, features, rootTemplateId),
    features,
  };
}
