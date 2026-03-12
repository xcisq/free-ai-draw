import type { Point } from '@plait/core';
import { PAPERDRAW_LAYOUT_DEFAULTS } from '../config/defaults';
import {
  AnalysisResult,
  Entity,
  FlowRelation,
  LayoutDirection,
  LayoutEdge,
  LayoutGroup,
  LayoutNode,
  LayoutResult,
  ModuleGroup,
} from '../types/analyzer';

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutSlot {
  id: string;
  entityIds: string[];
  module?: ModuleGroup;
  order: number;
  indexHint: number;
}

type ConnectionSide = 'left' | 'right' | 'top' | 'bottom';

const HORIZONTAL_PORTS = [0.35, 0.5, 0.65, 0.8];
const VERTICAL_PORTS = [0.3, 0.5, 0.7];

const getSequentialRelations = (relations: FlowRelation[]) => {
  return relations.filter(
    (relation): relation is Extract<FlowRelation, { type: 'sequential' }> =>
      relation.type === 'sequential'
  );
};

const topologicalSort = (entities: Entity[], relations: FlowRelation[]) => {
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

function buildSlots(orderedEntities: Entity[], modules: ModuleGroup[]) {
  const orderIndex = new Map(orderedEntities.map((entity, index) => [entity.id, index]));
  const consumed = new Set<string>();

  const moduleSlots: LayoutSlot[] = [...modules]
    .map((moduleItem, index) => {
      const orderedEntityIds = [...moduleItem.entityIds].sort((left, right) => {
        return (
          (orderIndex.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (orderIndex.get(right) ?? Number.MAX_SAFE_INTEGER)
        );
      });
      orderedEntityIds.forEach((entityId) => consumed.add(entityId));
      const explicitOrder = moduleItem.order ?? Number.MAX_SAFE_INTEGER;
      const firstEntityIndex = Math.min(
        ...orderedEntityIds.map(
          (entityId) => orderIndex.get(entityId) ?? Number.MAX_SAFE_INTEGER
        )
      );

      return {
        id: moduleItem.id,
        entityIds: orderedEntityIds,
        module: moduleItem,
        order: explicitOrder,
        indexHint:
          firstEntityIndex === Number.MAX_SAFE_INTEGER ? index : firstEntityIndex,
      };
    })
    .sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }
      return left.indexHint - right.indexHint;
    });

  const standaloneSlots: LayoutSlot[] = orderedEntities
    .filter((entity) => !consumed.has(entity.id))
    .map((entity, index) => ({
      id: `slot-${entity.id}`,
      entityIds: [entity.id],
      order: Number.MAX_SAFE_INTEGER,
      indexHint: orderIndex.get(entity.id) ?? moduleSlots.length + index,
    }));

  return [...moduleSlots, ...standaloneSlots].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.indexHint - right.indexHint;
  });
}

function buildSlotNodes(
  slot: LayoutSlot,
  entityMap: Map<string, Entity>,
  analysis: AnalysisResult,
  cursorX: number
) {
  const isModule = Boolean(slot.module);
  const entityIds = slot.entityIds.filter((entityId) => entityMap.has(entityId));
  const useGrid =
    isModule && entityIds.length > PAPERDRAW_LAYOUT_DEFAULTS.moduleGridThreshold;
  const columns = useGrid ? PAPERDRAW_LAYOUT_DEFAULTS.moduleGridColumns : 1;
  const contentOffsetY =
    PAPERDRAW_LAYOUT_DEFAULTS.moduleTitleHeight +
    PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingY;

  const nodes = entityIds.map((entityId, index) => {
    const entity = entityMap.get(entityId)!;
    const column = useGrid ? index % columns : 0;
    const row = useGrid ? Math.floor(index / columns) : index;
    const x =
      cursorX +
      column *
        (PAPERDRAW_LAYOUT_DEFAULTS.nodeWidth + PAPERDRAW_LAYOUT_DEFAULTS.nodeGapX);
    const y =
      contentOffsetY +
      row *
        (PAPERDRAW_LAYOUT_DEFAULTS.nodeHeight + PAPERDRAW_LAYOUT_DEFAULTS.nodeGapY);

    return {
      id: entity.id,
      label: entity.label,
      moduleId: slot.module?.id,
      x,
      y,
      width: PAPERDRAW_LAYOUT_DEFAULTS.nodeWidth,
      height: PAPERDRAW_LAYOUT_DEFAULTS.nodeHeight,
      weight: analysis.weights[entity.id] ?? 0.5,
      confidence: entity.confidence ?? 0.5,
      row,
      column,
    } as LayoutNode;
  });

  const slotWidth =
    (useGrid ? columns : 1) * PAPERDRAW_LAYOUT_DEFAULTS.nodeWidth +
    (useGrid ? columns - 1 : 0) * PAPERDRAW_LAYOUT_DEFAULTS.nodeGapX;

  return {
    nodes,
    width: slotWidth,
  };
}

function buildGroups(nodes: LayoutNode[], slots: LayoutSlot[]): LayoutGroup[] {
  return slots
    .filter((slot) => Boolean(slot.module))
    .map((slot, index) => {
      const memberNodes = nodes.filter((node) => slot.entityIds.includes(node.id));
      if (!memberNodes.length || !slot.module) {
        return null;
      }

      const minX = Math.min(...memberNodes.map((node) => node.x));
      const minY = Math.min(...memberNodes.map((node) => node.y));
      const maxX = Math.max(...memberNodes.map((node) => node.x + node.width));
      const maxY = Math.max(...memberNodes.map((node) => node.y + node.height));

      return {
        id: slot.module.id,
        moduleLabel: slot.module.label,
        entityIds: [...slot.entityIds],
        order: slot.module.order ?? index + 1,
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
}

function getNodeRectangle(node: LayoutNode): Rectangle {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };
}

function getGroupRectangle(group: LayoutGroup): Rectangle {
  return {
    x: group.x,
    y: group.y,
    width: group.width,
    height: group.height,
  };
}

function getConnectionPoint(node: LayoutNode, connection: [number, number]): Point {
  return [
    node.x + node.width * connection[0],
    node.y + node.height * connection[1],
  ];
}

function lineIntersectsRectangle(
  start: Point,
  end: Point,
  rect: Rectangle
) {
  const [x1, y1] = start;
  const [x2, y2] = end;
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  if (Math.abs(y1 - y2) < 1e-6) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    return y1 > top && y1 < bottom && maxX > left && minX < right;
  }

  if (Math.abs(x1 - x2) < 1e-6) {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return x1 > left && x1 < right && maxY > top && minY < bottom;
  }

  return false;
}

function getConnectionSide(connection: [number, number]): ConnectionSide {
  if (connection[0] === 0) {
    return 'left';
  }
  if (connection[0] === 1) {
    return 'right';
  }
  if (connection[1] === 0) {
    return 'top';
  }
  return 'bottom';
}

function adjustConnectionPoint(
  connection: [number, number],
  occurrence: number
): [number, number] {
  const side = getConnectionSide(connection);

  if (side === 'left' || side === 'right') {
    return [connection[0], HORIZONTAL_PORTS[occurrence % HORIZONTAL_PORTS.length]];
  }

  return [VERTICAL_PORTS[occurrence % VERTICAL_PORTS.length], connection[1]];
}

function isAdjacentInModule(sourceNode: LayoutNode, targetNode: LayoutNode) {
  if (!sourceNode.moduleId || sourceNode.moduleId !== targetNode.moduleId) {
    return false;
  }

  const rowDistance = Math.abs((sourceNode.row ?? 0) - (targetNode.row ?? 0));
  const columnDistance = Math.abs(
    (sourceNode.column ?? 0) - (targetNode.column ?? 0)
  );

  return rowDistance + columnDistance === 1;
}

function getModuleOrderMap(groups: LayoutGroup[]) {
  return new Map(groups.map((group, index) => [group.id, group.order ?? index + 1]));
}

function getDefaultConnections(
  relation: FlowRelation,
  sourceNode: LayoutNode,
  targetNode: LayoutNode
) {
  if (relation.type === 'annotative') {
    const deltaX = targetNode.x - sourceNode.x;
    const deltaY = targetNode.y - sourceNode.y;
    if (Math.abs(deltaX) < sourceNode.width / 2 && deltaY > 0) {
      return {
        sourceConnection: [0.5, 1] as [number, number],
        targetConnection: [0.5, 0] as [number, number],
      };
    }
    if (deltaX >= 0) {
      return {
        sourceConnection: [1, 0.5] as [number, number],
        targetConnection: [0, 0.5] as [number, number],
      };
    }
    return {
      sourceConnection: [0, 0.5] as [number, number],
      targetConnection: [1, 0.5] as [number, number],
    };
  }

  if (
    sourceNode.moduleId &&
    sourceNode.moduleId === targetNode.moduleId &&
    isAdjacentInModule(sourceNode, targetNode)
  ) {
    if ((sourceNode.column ?? 0) !== (targetNode.column ?? 0)) {
      return sourceNode.x < targetNode.x
        ? {
            sourceConnection: [1, 0.5] as [number, number],
            targetConnection: [0, 0.5] as [number, number],
          }
        : {
            sourceConnection: [0, 0.5] as [number, number],
            targetConnection: [1, 0.5] as [number, number],
          };
    }

    return sourceNode.y <= targetNode.y
      ? {
          sourceConnection: [0.5, 1] as [number, number],
          targetConnection: [0.5, 0] as [number, number],
        }
      : {
          sourceConnection: [0.5, 0] as [number, number],
          targetConnection: [0.5, 1] as [number, number],
        };
  }

  return {
    sourceConnection: [1, 0.5] as [number, number],
    targetConnection: [0, 0.5] as [number, number],
  };
}

function shouldUseStraightLine(
  relation: FlowRelation,
  sourceNode: LayoutNode,
  targetNode: LayoutNode,
  start: Point,
  end: Point,
  nodeRectangles: Array<{ id: string; rect: Rectangle }>,
  groupRectangles: Array<{ id: string; rect: Rectangle; entityIds: string[] }>
) {
  if (relation.type !== 'sequential') {
    return false;
  }

  if (!isAdjacentInModule(sourceNode, targetNode)) {
    return false;
  }

  const blockedByNode = nodeRectangles.some(({ id, rect }) => {
    if (id === sourceNode.id || id === targetNode.id) {
      return false;
    }
    return lineIntersectsRectangle(start, end, rect);
  });

  if (blockedByNode) {
    return false;
  }

  const blockedByGroup = groupRectangles.some(({ entityIds, rect }) => {
    const containsSource = entityIds.includes(sourceNode.id);
    const containsTarget = entityIds.includes(targetNode.id);
    if (containsSource || containsTarget) {
      return false;
    }
    return lineIntersectsRectangle(start, end, rect);
  });

  return !blockedByGroup;
}

function buildEdges(
  nodes: LayoutNode[],
  groups: LayoutGroup[],
  relations: FlowRelation[]
): LayoutEdge[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const moduleOrderMap = getModuleOrderMap(groups);
  const nodeRectangles = nodes.map((node) => ({
    id: node.id,
    rect: getNodeRectangle(node),
  }));
  const groupRectangles = groups.map((group) => ({
    id: group.id,
    rect: getGroupRectangle(group),
    entityIds: group.entityIds,
  }));
  const sourcePortUsage = new Map<string, number>();
  const targetPortUsage = new Map<string, number>();
  const edges: LayoutEdge[] = [];

  const orderedRelations = [...relations].sort((left, right) => {
    const leftSource = nodeMap.get(left.source);
    const rightSource = nodeMap.get(right.source);
    if (leftSource && rightSource && leftSource.id !== rightSource.id) {
      return leftSource.x - rightSource.x || leftSource.y - rightSource.y;
    }
    const leftTarget = nodeMap.get(left.target);
    const rightTarget = nodeMap.get(right.target);
    const leftModuleOrder = leftTarget?.moduleId
      ? moduleOrderMap.get(leftTarget.moduleId) ?? Number.MAX_SAFE_INTEGER
      : Number.MAX_SAFE_INTEGER;
    const rightModuleOrder = rightTarget?.moduleId
      ? moduleOrderMap.get(rightTarget.moduleId) ?? Number.MAX_SAFE_INTEGER
      : Number.MAX_SAFE_INTEGER;
    return (
      leftModuleOrder - rightModuleOrder ||
      (leftTarget?.y ?? 0) - (rightTarget?.y ?? 0) ||
      (leftTarget?.x ?? 0) - (rightTarget?.x ?? 0)
    );
  });

  for (const relation of orderedRelations) {
    const sourceNode = nodeMap.get(relation.source);
    const targetNode = nodeMap.get(relation.target);
    if (!sourceNode || !targetNode) {
      continue;
    }

    const baseConnections = getDefaultConnections(relation, sourceNode, targetNode);
    const sourceSide = getConnectionSide(baseConnections.sourceConnection);
    const targetSide = getConnectionSide(baseConnections.targetConnection);

    const sourceKey = `${sourceNode.id}:${sourceSide}`;
    const targetKey = `${targetNode.id}:${targetSide}`;
    const sourceConnection = adjustConnectionPoint(
      baseConnections.sourceConnection,
      sourcePortUsage.get(sourceKey) ?? 0
    );
    const targetConnection = adjustConnectionPoint(
      baseConnections.targetConnection,
      targetPortUsage.get(targetKey) ?? 0
    );
    sourcePortUsage.set(sourceKey, (sourcePortUsage.get(sourceKey) ?? 0) + 1);
    targetPortUsage.set(targetKey, (targetPortUsage.get(targetKey) ?? 0) + 1);

    const start = getConnectionPoint(sourceNode, sourceConnection);
    const end = getConnectionPoint(targetNode, targetConnection);
    const shape = shouldUseStraightLine(
      relation,
      sourceNode,
      targetNode,
      start,
      end,
      nodeRectangles,
      groupRectangles
    )
      ? 'straight'
      : 'elbow';

    edges.push({
      id: relation.id,
      type: relation.type,
      sourceId: relation.source,
      targetId: relation.target,
      shape,
      sourceConnection,
      targetConnection,
      points: [start, end],
      label: relation.label,
    });
  }

  return edges;
}

export function basicLayout(
  analysis: AnalysisResult,
  direction: LayoutDirection = PAPERDRAW_LAYOUT_DEFAULTS.direction
): LayoutResult {
  const orderedEntities = topologicalSort(analysis.entities, analysis.relations);
  const entityMap = new Map(orderedEntities.map((entity) => [entity.id, entity]));
  const slots = buildSlots(orderedEntities, analysis.modules);
  const nodes: LayoutNode[] = [];
  let cursorX = 0;

  for (const slot of slots) {
    const slotResult = buildSlotNodes(slot, entityMap, analysis, cursorX);
    nodes.push(...slotResult.nodes);
    cursorX += slotResult.width + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX;
  }

  const groups = buildGroups(nodes, slots);
  const edges = buildEdges(nodes, groups, analysis.relations);

  return {
    nodes,
    edges,
    groups,
    direction,
  };
}
