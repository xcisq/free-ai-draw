import type {
  LayoutIntent,
  NodeRole,
  PipelineBlueprint,
  PipelineBlueprintLaneKind,
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
  'top-control-main-bottom-aux',
  'spine-lower-branch',
  'split-merge',
  'paired-state-simulator',
  'outer-feedback-loop',
  'linear-spine',
];

function countByNodeRole(intent: LayoutIntent, role: string) {
  return intent.nodes.filter((node) => node.role === role).length;
}

function isMainStructureRole(role: string | undefined) {
  return role !== 'parameter' && role !== 'decoder' && role !== 'annotation';
}

function countLaneKinds(blueprint: PipelineBlueprint, kind: PipelineBlueprintLaneKind) {
  return blueprint.lanes.filter((lane) => lane.kind === kind).length;
}

function countLaneNodes(blueprint: PipelineBlueprint, kind: PipelineBlueprintLaneKind) {
  return blueprint.lanes
    .filter((lane) => lane.kind === kind)
    .reduce((total, lane) => total + lane.nodeIds.length, 0);
}

export function buildTemplateFitFeatures(
  intent: LayoutIntent,
  blueprint: PipelineBlueprint
): TemplateFitFeatures {
  const inputModuleCount = intent.modules.filter(
    (moduleItem) => moduleItem.role === 'input_stage'
  ).length;
  const mergeBundleCount = new Set(
    blueprint.edgePolicies
      .map((policy) => policy.bundleKey)
      .filter((bundleKey) => bundleKey.startsWith('merge:'))
  ).size;
  const branchNodeCount = new Set(blueprint.branchGroups.flatMap((group) => group.nodeIds)).size;

  return {
    spineLength: blueprint.spineNodeIds.length,
    spineSegmentCount: intent.spineSegments.length,
    branchCount: branchNodeCount,
    branchAttachmentCount: blueprint.branchGroups.length,
    branchGroupCount: blueprint.branchGroups.length,
    branchLaneCount: countLaneKinds(blueprint, 'branch'),
    mergeCount: intent.mergeNodes.length,
    mergeClusterCount: blueprint.mergeGroups.length,
    mergeGroupCount: blueprint.mergeGroups.length,
    mergeBundleCount,
    feedbackCount: blueprint.feedbackLoops.length,
    feedbackLoopCount: blueprint.feedbackLoops.length,
    inputContainerCount: intent.inputContainers.length,
    inputModuleCount,
    inputLaneCount: countLaneKinds(blueprint, 'input'),
    stateNodeCount: countByNodeRole(intent, 'state') + countByNodeRole(intent, 'output'),
    statePairCount: intent.statePairs.length,
    simulatorNodeCount: countByNodeRole(intent, 'simulator'),
    topControlCount: countLaneNodes(blueprint, 'control'),
    controlLaneCount: countLaneKinds(blueprint, 'control'),
    bottomAuxCount: countLaneNodes(blueprint, 'auxiliary'),
    auxiliaryLaneCount: countLaneKinds(blueprint, 'auxiliary'),
    outputNodeCount: countLaneNodes(blueprint, 'output'),
    outputLaneCount: countLaneKinds(blueprint, 'output'),
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
        (features.inputLaneCount > 0 ? 0.08 : 0) +
        (features.outputLaneCount > 0 ? 0.08 : 0) +
        Math.min(features.spineLength / 8, 0.14) +
        (features.branchGroupCount === 0 ? 0.06 : 0) +
        (features.mergeGroupCount === 0 ? 0.04 : 0) -
        (features.feedbackLoopCount > 0 ? 0.08 : 0) -
        (features.simulatorNodeCount > 0 ? 0.08 : 0) -
        (features.statePairCount > 0 ? 0.06 : 0)
      );
    case 'spine-lower-branch':
      return (
        (features.branchGroupCount > 0 ? 0.22 : 0) +
        (features.auxiliaryLaneCount > 0 ? 0.14 : 0) +
        (features.branchLaneCount > 0 ? 0.08 : 0) +
        (features.branchGroupCount > 0 &&
        features.mergeGroupCount === 0 &&
        features.controlLaneCount === 0 &&
        features.auxiliaryLaneCount <= 1
          ? 0.16
          : 0) +
        features.auxZoneScore * 0.24 +
        Math.min(features.branchCount / 4, 0.1) +
        Math.min(features.branchGroupCount / 3, 0.08) +
        Math.min(features.mergeGroupCount / 2, 0.08) +
        Math.min(features.spineLength / 8, 0.12) +
        (features.bottomAuxCount > 0 ? 0.08 : 0)
      );
    case 'top-control-main-bottom-aux':
      return (
        (features.controlLaneCount > 0 ? 0.18 : 0) +
        (features.auxiliaryLaneCount > 0 ? 0.18 : 0) +
        (features.controlLaneCount > 0 && features.auxiliaryLaneCount > 0 ? 0.2 : 0) +
        (features.controlZoneScore > 0.18 && features.auxZoneScore > 0.18 ? 0.12 : 0) +
        features.controlZoneScore * 0.14 +
        features.auxZoneScore * 0.14 +
        Math.min(features.branchGroupCount / 3, 0.06) +
        Math.min(features.spineLength / 8, 0.06)
      );
    case 'split-merge':
      return (
        (features.mergeGroupCount > 0 ? 0.28 : 0) +
        (features.mergeBundleCount > 0 ? 0.14 : 0) +
        (features.mergeGroupCount > 0 && features.branchGroupCount > 0 ? 0.18 : 0) +
        (features.branchGroupCount > 0 ? 0.14 : 0) +
        Math.min(features.branchCount / 3, 0.12) +
        Math.min(features.mergeGroupCount / 2, 0.1) +
        (features.auxZoneScore > 0.2 ? 0.04 : 0)
      );
    case 'paired-state-simulator':
      return (
        (features.simulatorNodeCount > 0 ? 0.3 : 0) +
        (features.statePairCount > 0 ? 0.26 : 0) +
        (features.simulatorNodeCount > 0 && features.statePairCount > 0 ? 0.16 : 0) +
        (features.feedbackLoopCount > 0 ? 0.04 : 0) +
        Math.min(features.stateNodeCount / 4, 0.12) +
        features.outputZoneScore * 0.08 +
        features.inputZoneScore * 0.06 +
        (features.branchAttachmentCount > 0 ? 0.04 : 0)
      );
    case 'outer-feedback-loop':
      return (
        (features.feedbackLoopCount > 0 ? 0.42 : 0) +
        Math.min(features.feedbackLoopCount / 3, 0.18) +
        Math.min(features.spineLength / 10, 0.08) +
        (features.outputZoneScore > 0.2 ? 0.06 : 0)
      );
    case 'linear-spine':
    default:
      return (
        0.18 +
        Math.min(features.spineLength / 8, 0.3) -
        Math.min(features.branchGroupCount * 0.08, 0.2) -
        Math.min(features.mergeGroupCount * 0.08, 0.16) -
        Math.min(features.controlLaneCount * 0.04, 0.08) -
        Math.min(features.auxiliaryLaneCount * 0.04, 0.08) -
        Math.min(features.feedbackLoopCount * 0.08, 0.16)
      );
  }
}

function getLocalTemplates(
  intent: LayoutIntent,
  blueprint: PipelineBlueprint,
  features: TemplateFitFeatures,
  rootTemplateId: PipelineTemplateId
): PipelineLocalTemplateId[] {
  const localTemplateIds = new Set<PipelineLocalTemplateId>();
  const nodeRoleMap = new Map(intent.nodes.map((node) => [node.id, node.role]));

  if (features.inputContainerCount > 0 || features.inputZoneScore > 0.3) {
    localTemplateIds.add('input-container-stack');
  }
  if (features.statePairCount > 0) {
    localTemplateIds.add('state-before-after');
  }
  if (features.branchGroupCount > 0) {
    localTemplateIds.add('small-fan-out');
  }
  if (features.mergeGroupCount > 0 || rootTemplateId === 'split-merge') {
    localTemplateIds.add('small-fan-in');
  }
  if (blueprint.lanes.some((lane) => lane.kind === 'control')) {
    localTemplateIds.add('control-over-main');
  }
  if (blueprint.lanes.some((lane) => lane.kind === 'auxiliary')) {
    localTemplateIds.add('aux-under-main');
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
  if (
    intent.modules.some((moduleItem) => {
      const memberRoles = moduleItem.members
        .map((memberId) => nodeRoleMap.get(memberId))
        .filter((role): role is NodeRole => Boolean(role));
      return (
        memberRoles.some((role) => role === 'parameter') &&
        memberRoles.some((role) => isMainStructureRole(role))
      );
    })
  ) {
    localTemplateIds.add('control-over-main');
  }
  if (
    intent.modules.some((moduleItem) => {
      const memberRoles = moduleItem.members
        .map((memberId) => nodeRoleMap.get(memberId))
        .filter((role): role is NodeRole => Boolean(role));
      return (
        memberRoles.some((role) => role === 'decoder') &&
        memberRoles.some((role) => isMainStructureRole(role))
      );
    })
  ) {
    localTemplateIds.add('aux-under-main');
  }

  return [...localTemplateIds];
}

export function matchPipelineTemplates(
  intent: LayoutIntent,
  blueprint: PipelineBlueprint
): PipelineTemplateMatch {
  const features = buildTemplateFitFeatures(intent, blueprint);
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
      features.controlLaneCount > 0 && features.auxiliaryLaneCount > 0
        ? 'top-control-main-bottom-aux'
        : features.branchGroupCount > 0 &&
            features.mergeGroupCount === 0 &&
            features.controlLaneCount === 0 &&
            features.auxiliaryLaneCount <= 1
          ? 'spine-lower-branch'
        : features.inputZoneScore >= 0.25 && features.outputZoneScore >= 0.2
            ? 'input-core-output'
            : features.branchGroupCount > 0
              ? 'spine-lower-branch'
              : 'linear-spine';
  }

  return {
    rootTemplateId,
    localTemplateIds: getLocalTemplates(intent, blueprint, features, rootTemplateId),
    features,
  };
}
