import { PAPERDRAW_LAYOUT_DEFAULTS } from '../config/defaults';
import {
  AnalysisResult,
  Entity,
  LayoutDirection,
  LayoutEdge,
  LayoutGroup,
  LayoutNode,
  LayoutResult,
  Relation,
} from '../types/analyzer';

const getSequentialRelations = (relations: Relation[]) => {
  return relations.filter(
    (relation): relation is Extract<Relation, { type: 'sequential' }> =>
      relation.type === 'sequential'
  );
};

const topologicalSort = (entities: Entity[], relations: Relation[]) => {
  const sequentialRelations = getSequentialRelations(relations);
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const entity of entities) {
    indegree.set(entity.id, 0);
    outgoing.set(entity.id, []);
  }

  for (const relation of sequentialRelations) {
    indegree.set(relation.target, (indegree.get(relation.target) || 0) + 1);
    outgoing.get(relation.source)?.push(relation.target);
  }

  const queue = entities
    .filter((entity) => (indegree.get(entity.id) || 0) === 0)
    .map((entity) => entity.id);
  const orderedIds: string[] = [];

  while (queue.length) {
    const currentId = queue.shift()!;
    orderedIds.push(currentId);
    const targets = outgoing.get(currentId) || [];
    for (const target of targets) {
      const nextIndegree = (indegree.get(target) || 0) - 1;
      indegree.set(target, nextIndegree);
      if (nextIndegree === 0) {
        queue.push(target);
      }
    }
  }

  const fallbackIds = entities
    .map((entity) => entity.id)
    .filter((entityId) => !orderedIds.includes(entityId));

  return [...orderedIds, ...fallbackIds]
    .map((entityId) => entities.find((entity) => entity.id === entityId))
    .filter((entity): entity is Entity => Boolean(entity));
};

const buildNodes = (
  orderedEntities: Entity[],
  analysis: AnalysisResult,
  direction: LayoutDirection
): LayoutNode[] => {
  return orderedEntities.map((entity, index) => {
    const x =
      direction === 'LR'
        ? index * (PAPERDRAW_LAYOUT_DEFAULTS.nodeWidth + PAPERDRAW_LAYOUT_DEFAULTS.nodeGapX)
        : 0;
    const y =
      direction === 'TB'
        ? index * (PAPERDRAW_LAYOUT_DEFAULTS.nodeHeight + PAPERDRAW_LAYOUT_DEFAULTS.nodeGapY)
        : 0;

    return {
      id: entity.id,
      label: entity.label,
      x,
      y,
      width: PAPERDRAW_LAYOUT_DEFAULTS.nodeWidth,
      height: PAPERDRAW_LAYOUT_DEFAULTS.nodeHeight,
      weight: analysis.weights[entity.id] ?? 0.5,
      confidence: entity.confidence ?? 0.5,
    };
  });
};

const buildGroups = (nodes: LayoutNode[], analysis: AnalysisResult): LayoutGroup[] => {
  return analysis.modules
    .map((module, index) => {
      const memberNodes = nodes.filter((node) => module.entityIds.includes(node.id));
      if (!memberNodes.length) {
        return null;
      }

      const minX = Math.min(...memberNodes.map((node) => node.x));
      const minY = Math.min(...memberNodes.map((node) => node.y));
      const maxX = Math.max(...memberNodes.map((node) => node.x + node.width));
      const maxY = Math.max(...memberNodes.map((node) => node.y + node.height));

      return {
        id: `g${index + 1}`,
        moduleLabel: module.moduleLabel,
        entityIds: module.entityIds,
        x: minX - PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingX,
        y:
          minY -
          PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingY -
          PAPERDRAW_LAYOUT_DEFAULTS.moduleTitleHeight,
        width:
          maxX -
          minX +
          PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingX * 2,
        height:
          maxY -
          minY +
          PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingY * 2 +
          PAPERDRAW_LAYOUT_DEFAULTS.moduleTitleHeight,
      };
    })
    .filter((group): group is LayoutGroup => Boolean(group));
};

const getAnchorPoint = (
  node: LayoutNode,
  direction: LayoutDirection,
  anchor: 'source' | 'target'
): [number, number] => {
  if (direction === 'TB') {
    return anchor === 'source'
      ? [node.x + node.width / 2, node.y + node.height]
      : [node.x + node.width / 2, node.y];
  }

  return anchor === 'source'
    ? [node.x + node.width, node.y + node.height / 2]
    : [node.x, node.y + node.height / 2];
};

const buildEdges = (
  nodes: LayoutNode[],
  relations: Relation[],
  direction: LayoutDirection
): LayoutEdge[] => {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const edges: LayoutEdge[] = [];

  for (const relation of relations) {
    if (relation.type !== 'sequential' && relation.type !== 'annotative') {
      continue;
    }
    const sourceNode = nodeMap.get(relation.source);
    const targetNode = nodeMap.get(relation.target);
    if (!sourceNode || !targetNode) {
      continue;
    }

    edges.push({
        id: relation.id,
        type: relation.type,
        sourceId: relation.source,
        targetId: relation.target,
        points: [
          getAnchorPoint(sourceNode, direction, 'source'),
          getAnchorPoint(targetNode, direction, 'target'),
        ],
        label: relation.label,
      });
  }

  return edges;
};

export function basicLayout(
  analysis: AnalysisResult,
  direction: LayoutDirection = PAPERDRAW_LAYOUT_DEFAULTS.direction
): LayoutResult {
  const orderedEntities = topologicalSort(analysis.entities, analysis.relations);
  const nodes = buildNodes(orderedEntities, analysis, direction);
  const groups = buildGroups(nodes, analysis);
  const edges = buildEdges(nodes, analysis.relations, direction);

  return {
    nodes,
    edges,
    groups,
    direction,
  };
}
