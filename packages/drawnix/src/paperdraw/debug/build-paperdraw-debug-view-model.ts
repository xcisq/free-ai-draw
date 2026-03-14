import type {
  AnalysisResult,
  ExtractionResult,
  FlowRelation,
  LayoutIntent,
  ModuleGroup,
  TemplateFitFeatures,
} from '../types/analyzer';
import { basicLayout } from '../layout/basic-layout';
import { buildLayoutIntent } from '../layout/pipeline-layout-intent';
import { matchPipelineTemplates } from '../layout/pipeline-template-matcher';

const UNKNOWN_ROLE_LABEL = '未标注';

const TEMPLATE_FEATURE_LABELS: Record<keyof TemplateFitFeatures, string> = {
  spineLength: '主干长度',
  spineSegmentCount: '主干段数',
  branchCount: '分支节点数',
  branchAttachmentCount: '分支挂接数',
  mergeCount: '汇聚节点数',
  mergeClusterCount: '汇聚簇数',
  feedbackCount: '反馈边数',
  inputContainerCount: '输入容器数',
  inputModuleCount: '输入模块数',
  stateNodeCount: '状态节点数',
  statePairCount: '状态对数',
  simulatorNodeCount: '仿真节点数',
  topControlCount: '控制区节点数',
  bottomAuxCount: '辅助区节点数',
  outputNodeCount: '输出节点数',
  inputZoneScore: '输入区得分',
  controlZoneScore: '控制区得分',
  auxZoneScore: '辅助区得分',
  outputZoneScore: '输出区得分',
};

export interface PaperDrawDebugRoleCount {
  role: string;
  count: number;
}

export interface PaperDrawDebugStageSummary {
  entityCount: number;
  relationCount: number;
  moduleCount: number;
  spineLength: number;
  warningCount: number;
  entityRoles: PaperDrawDebugRoleCount[];
  relationRoles: PaperDrawDebugRoleCount[];
  moduleRoles: PaperDrawDebugRoleCount[];
}

export interface PaperDrawDebugRoleChange {
  id: string;
  label: string;
  before: string;
  after: string;
}

export interface PaperDrawDebugIntentSummary {
  dominantSpine: string[];
  branchRoots: string[];
  mergeNodes: string[];
  feedbackEdges: string[];
  layoutHints: string[];
  zoneScores: LayoutIntent['zoneScores'];
}

export interface PaperDrawDebugTemplateSummary {
  rootTemplateId: string;
  localTemplateIds: string[];
  featureHighlights: Array<{
    key: keyof TemplateFitFeatures;
    label: string;
    value: number;
  }>;
}

export interface PaperDrawDebugViewModel {
  extraction: PaperDrawDebugStageSummary | null;
  analysis: PaperDrawDebugStageSummary | null;
  intent: PaperDrawDebugIntentSummary | null;
  template: PaperDrawDebugTemplateSummary | null;
  entityRoleChanges: PaperDrawDebugRoleChange[];
  relationRoleChanges: PaperDrawDebugRoleChange[];
  moduleRoleChanges: PaperDrawDebugRoleChange[];
}

function summarizeRoleCounts(roles: Array<string | undefined>) {
  const counts = new Map<string, number>();
  roles.forEach((role) => {
    const normalizedRole = role ?? UNKNOWN_ROLE_LABEL;
    counts.set(normalizedRole, (counts.get(normalizedRole) ?? 0) + 1);
  });

  return [...counts.entries()]
    .map(([role, count]) => ({ role, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.role.localeCompare(right.role);
    });
}

function summarizeStage(result: ExtractionResult | AnalysisResult): PaperDrawDebugStageSummary {
  return {
    entityCount: result.entities.length,
    relationCount: result.relations.length,
    moduleCount: result.modules.length,
    spineLength: result.spineCandidate?.length ?? 0,
    warningCount: result.warnings?.length ?? 0,
    entityRoles: summarizeRoleCounts(result.entities.map((entity) => entity.roleCandidate)),
    relationRoles: summarizeRoleCounts(result.relations.map((relation) => relation.roleCandidate)),
    moduleRoles: summarizeRoleCounts(result.modules.map((moduleItem) => moduleItem.roleCandidate)),
  };
}

function buildEntityLabelMap(
  extraction: ExtractionResult | null,
  analysis: AnalysisResult | null
) {
  const labels = new Map<string, string>();
  extraction?.entities.forEach((entity) => labels.set(entity.id, entity.label));
  analysis?.entities.forEach((entity) => labels.set(entity.id, entity.label));
  return labels;
}

function buildRelationLabel(
  relation: FlowRelation,
  entityLabelMap: Map<string, string>
) {
  const sourceLabel = entityLabelMap.get(relation.source) ?? relation.source;
  const targetLabel = entityLabelMap.get(relation.target) ?? relation.target;
  return `${sourceLabel} -> ${targetLabel}`;
}

function buildRoleChangesById<T extends { id: string }>(
  beforeItems: T[],
  afterItems: T[],
  getLabel: (item: T) => string,
  getRole: (item: T) => string | undefined
) {
  const beforeMap = new Map(beforeItems.map((item) => [item.id, item]));
  return afterItems
    .map((item) => {
      const beforeItem = beforeMap.get(item.id);
      if (!beforeItem) {
        return null;
      }
      const beforeRole = getRole(beforeItem) ?? UNKNOWN_ROLE_LABEL;
      const afterRole = getRole(item) ?? UNKNOWN_ROLE_LABEL;
      if (beforeRole === afterRole) {
        return null;
      }
      return {
        id: item.id,
        label: getLabel(item),
        before: beforeRole,
        after: afterRole,
      };
    })
    .filter((item): item is PaperDrawDebugRoleChange => Boolean(item));
}

function buildModuleSnapshotMap(modules: ModuleGroup[]) {
  const labelCounts = new Map<string, number>();
  return new Map(
    modules.map((moduleItem) => {
      const nextCount = (labelCounts.get(moduleItem.label) ?? 0) + 1;
      labelCounts.set(moduleItem.label, nextCount);
      return [`${moduleItem.label}#${nextCount}`, moduleItem] as const;
    })
  );
}

function buildModuleRoleChanges(
  extraction: ExtractionResult,
  analysis: AnalysisResult
) {
  const beforeMap = buildModuleSnapshotMap(extraction.modules);
  const afterMap = buildModuleSnapshotMap(analysis.modules);

  return [...afterMap.entries()]
    .map(([key, moduleItem]) => {
      const beforeItem = beforeMap.get(key);
      if (!beforeItem) {
        return null;
      }
      const beforeRole = beforeItem.roleCandidate ?? UNKNOWN_ROLE_LABEL;
      const afterRole = moduleItem.roleCandidate ?? UNKNOWN_ROLE_LABEL;
      if (beforeRole === afterRole) {
        return null;
      }
      return {
        id: moduleItem.id,
        label: moduleItem.label,
        before: beforeRole,
        after: afterRole,
      };
    })
    .filter((item): item is PaperDrawDebugRoleChange => Boolean(item));
}

function summarizeIntent(intent: LayoutIntent): PaperDrawDebugIntentSummary {
  return {
    dominantSpine: [...intent.dominantSpine],
    branchRoots: [...intent.branchRoots],
    mergeNodes: [...intent.mergeNodes],
    feedbackEdges: [...intent.feedbackEdges],
    layoutHints: [...intent.layoutHints],
    zoneScores: { ...intent.zoneScores },
  };
}

function summarizeTemplate(features: TemplateFitFeatures, rootTemplateId: string, localTemplateIds: string[]) {
  const featureHighlights = Object.entries(features)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      key: key as keyof TemplateFitFeatures,
      label: TEMPLATE_FEATURE_LABELS[key as keyof TemplateFitFeatures],
      value,
    }))
    .sort((left, right) => {
      if (right.value !== left.value) {
        return right.value - left.value;
      }
      return left.label.localeCompare(right.label);
    });

  return {
    rootTemplateId,
    localTemplateIds: [...localTemplateIds],
    featureHighlights,
  };
}

export function buildPaperDrawDebugViewModel(
  extraction: ExtractionResult | null,
  analysis: AnalysisResult | null
): PaperDrawDebugViewModel | null {
  if (!extraction && !analysis) {
    return null;
  }

  const entityLabelMap = buildEntityLabelMap(extraction, analysis);
  const extractionSummary = extraction ? summarizeStage(extraction) : null;
  const analysisSummary = analysis ? summarizeStage(analysis) : null;

  if (!analysis) {
    return {
      extraction: extractionSummary,
      analysis: null,
      intent: null,
      template: null,
      entityRoleChanges: [],
      relationRoleChanges: [],
      moduleRoleChanges: [],
    };
  }

  const layout = basicLayout(analysis);
  const intent = buildLayoutIntent(analysis, layout);
  const templateMatch = matchPipelineTemplates(intent);

  return {
    extraction: extractionSummary,
    analysis: analysisSummary,
    intent: summarizeIntent(intent),
    template: summarizeTemplate(
      templateMatch.features,
      templateMatch.rootTemplateId,
      templateMatch.localTemplateIds
    ),
    entityRoleChanges: extraction
      ? buildRoleChangesById(
          extraction.entities,
          analysis.entities,
          (entity) => entity.label,
          (entity) => entity.roleCandidate
        )
      : [],
    relationRoleChanges: extraction
      ? buildRoleChangesById(
          extraction.relations,
          analysis.relations,
          (relation) => buildRelationLabel(relation, entityLabelMap),
          (relation) => relation.roleCandidate
        )
      : [],
    moduleRoleChanges: extraction ? buildModuleRoleChanges(extraction, analysis) : [],
  };
}
