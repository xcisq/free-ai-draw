import type { PlaitElement } from '@plait/core';
import type {
  AnalysisResult,
  LayoutConstraintModel,
  LayoutEdge,
  LayoutGroup,
  LayoutOptimizeOptions,
  LayoutResult,
} from '../types/analyzer';
import { resolveLayoutProfile } from './layout-profile';
import {
  buildSnapshotFromElements,
  getSelectionNodeIds,
} from './layout-snapshot';

function getEdgesByType(layout: LayoutResult) {
  const sequentialEdges = layout.edges.filter((edge) => edge.type === 'sequential');
  const annotativeEdges = layout.edges.filter((edge) => edge.type === 'annotative');
  return { sequentialEdges, annotativeEdges };
}

function resolveMainFlowDirection(profileId: LayoutConstraintModel['profile']['id']) {
  return profileId === 'double' ? 'LR' : 'TB';
}

function getGroupIdsForNodes(groups: LayoutGroup[], nodeIds: Set<string>) {
  return groups
    .filter((group) => group.entityIds.some((entityId) => nodeIds.has(entityId)))
    .map((group) => group.id);
}

export function buildLayoutConstraintModel(
  layout: LayoutResult,
  options: LayoutOptimizeOptions,
  pinnedNodeIds: string[] = [],
  pinnedGroupIds: string[] = []
): LayoutConstraintModel {
  const { sequentialEdges, annotativeEdges } = getEdgesByType(layout);
  const profile = resolveLayoutProfile(
    options.profile,
    layout.nodes,
    layout.groups,
    sequentialEdges
  );

  return {
    nodes: layout.nodes.map((node) => ({ ...node })),
    edges: layout.edges.map((edge) => ({
      ...edge,
      points: [...edge.points] as [[number, number], [number, number]],
      routing: edge.routing?.map((point) => [...point] as [number, number]),
    })),
    groups: layout.groups.map((group) => ({ ...group, entityIds: [...group.entityIds] })),
    sequentialEdges: sequentialEdges.map((edge) => ({ ...edge })),
    annotativeEdges: annotativeEdges.map((edge) => ({ ...edge })),
    pinnedNodeIds: [...pinnedNodeIds],
    pinnedGroupIds: [...pinnedGroupIds],
    profile,
    mainFlowDirection: resolveMainFlowDirection(profile.id),
  };
}

export function getSelectionOptimizationNodeIds(
  selection: LayoutOptimizeOptions['selection'],
  analysis: AnalysisResult,
  layout: LayoutResult
) {
  const selectedNodeIds = getSelectionNodeIds(selection, analysis, layout);
  const expandedNodeIds = new Set<string>(selectedNodeIds);

  layout.groups.forEach((group) => {
    if (group.entityIds.some((entityId) => selectedNodeIds.has(entityId))) {
      group.entityIds.forEach((entityId) => expandedNodeIds.add(entityId));
    }
  });

  return expandedNodeIds;
}

export function getSelectionBaseNodeIds(
  selection: LayoutOptimizeOptions['selection'],
  analysis: AnalysisResult,
  layout: LayoutResult
) {
  return getSelectionNodeIds(selection, analysis, layout);
}

export function getPinnedIdsForSelection(layout: LayoutResult, movableNodeIds: Set<string>) {
  const pinnedNodeIds = layout.nodes
    .filter((node) => !movableNodeIds.has(node.id))
    .map((node) => node.id);
  const movableGroupIds = new Set(getGroupIdsForNodes(layout.groups, movableNodeIds));
  const pinnedGroupIds = layout.groups
    .filter((group) => !movableGroupIds.has(group.id))
    .map((group) => group.id);
  return { pinnedNodeIds, pinnedGroupIds };
}

export function buildConstraintSnapshot(
  analysis: AnalysisResult,
  elements: PlaitElement[]
) {
  return buildSnapshotFromElements(analysis, elements);
}
