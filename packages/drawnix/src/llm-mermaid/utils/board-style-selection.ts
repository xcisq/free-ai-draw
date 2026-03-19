import type { PlaitBoard, PlaitElement, Point } from '@plait/core';
import { PlaitDrawElement } from '@plait/draw';
import { MindElement } from '@plait/mind';
import type {
  BoardLineSemanticRole,
  BoardNodeSemanticRole,
  BoardStyleSelector,
  BoardTextSemanticRole,
  SelectedElementsSummary,
} from '../types';

export interface ResolveBoardStyleSelectionOptions {
  includeConnectedLines?: boolean;
}

export interface BoardStyleSelectionResult {
  originalElements: PlaitElement[];
  targetElements: PlaitElement[];
  relatedLines: PlaitElement[];
  summary: SelectedElementsSummary;
}

interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  area: number;
}

interface ShapeSemanticInfo {
  element: PlaitElement;
  id: string;
  label: string;
  bounds: ElementBounds | null;
  isModule: boolean;
  grouped: boolean;
  role: BoardNodeSemanticRole;
  inDegree: number;
  outDegree: number;
}

interface LineSemanticInfo {
  element: PlaitElement;
  id: string;
  role: BoardLineSemanticRole;
}

export interface BoardStyleSemanticMetadata {
  selectors: BoardStyleSelector[];
  textSelectors: BoardStyleSelector[];
  nodeRole?: BoardNodeSemanticRole;
  lineRole?: BoardLineSemanticRole;
  textRole?: BoardTextSemanticRole;
  grouped?: boolean;
  isModule?: boolean;
  label?: string;
}

export interface BoardStyleSemanticIndex {
  metadataByElement: Map<PlaitElement, BoardStyleSemanticMetadata>;
  semanticNodeCounts: Partial<Record<BoardNodeSemanticRole, number>>;
  lineRoleCounts: Partial<Record<BoardLineSemanticRole, number>>;
  textRoleCounts: Partial<Record<BoardTextSemanticRole, number>>;
  groupedShapeCount: number;
  ungroupedShapeCount: number;
  moduleCount: number;
  branchingNodeCount: number;
  mergeNodeCount: number;
  layoutBias: 'horizontal' | 'vertical' | 'mixed' | 'unknown';
  roleLabelExamples: Partial<Record<BoardNodeSemanticRole, string[]>>;
}

export function resolveBoardStyleSelection(
  board: PlaitBoard | null,
  selectedElements: PlaitElement[],
  options: ResolveBoardStyleSelectionOptions = {}
): BoardStyleSelectionResult {
  const includeConnectedLines = options.includeConnectedLines ?? true;
  const originalElements = uniqueElements(selectedElements);
  const nodeIds = new Set(
    originalElements
      .filter((element) => !isLineElement(element))
      .map((element) => getElementId(element))
      .filter(Boolean)
  );
  const selectedLineIds = new Set(
    originalElements
      .filter((element) => isLineElement(element))
      .map((element) => getElementId(element))
      .filter(Boolean)
  );

  const relatedLines = includeConnectedLines && board
    ? flattenBoardElements(board.children).filter((element) => {
      if (!isLineElement(element)) {
        return false;
      }

      const elementId = getElementId(element);
      if (elementId && selectedLineIds.has(elementId)) {
        return false;
      }

      const endpoints = getLineEndpointIds(element);
      return !!endpoints.sourceId && !!endpoints.targetId
        && nodeIds.has(endpoints.sourceId)
        && nodeIds.has(endpoints.targetId);
    })
    : [];

  const targetElements = uniqueElements([...originalElements, ...relatedLines]);

  return {
    originalElements,
    targetElements,
    relatedLines,
    summary: summarizeBoardStyleSelection(
      board,
      targetElements,
      originalElements.length,
      relatedLines.length,
      includeConnectedLines
    ),
  };
}

export function summarizeBoardStyleSelection(
  board: PlaitBoard | null,
  elements: PlaitElement[],
  originalTotal: number,
  relatedLineCount: number,
  includeConnectedLines: boolean
): SelectedElementsSummary {
  const semanticIndex = createBoardStyleSemanticIndex(board, elements);
  const fills = new Set<string>();
  const strokes = new Set<string>();
  const fontSizes = new Set<number>();
  let shapeCount = 0;
  let lineCount = 0;
  let textCount = 0;

  elements.forEach((element) => {
    const rawElement = element as Record<string, unknown>;

    if (board && MindElement.isMindElement(board, element)) {
      shapeCount++;
    } else if (isLineElement(element)) {
      lineCount++;
    } else if (PlaitDrawElement.isText(element)) {
      textCount++;
    } else if (PlaitDrawElement.isShapeElement(element)) {
      shapeCount++;
    }

    if (typeof rawElement['fill'] === 'string' && rawElement['fill']) {
      fills.add(rawElement['fill']);
    }

    const strokeColor = getStrokeColor(rawElement);
    if (strokeColor) {
      strokes.add(strokeColor);
    }

    const fontSize = getFontSize(rawElement);
    if (typeof fontSize === 'number') {
      fontSizes.add(fontSize);
    }
  });

  return {
    total: elements.length,
    originalTotal,
    shapeCount,
    lineCount,
    textCount,
    relatedLineCount,
    includeConnectedLines,
    fills: Array.from(fills).slice(0, 4),
    strokes: Array.from(strokes).slice(0, 4),
    fontSizes: Array.from(fontSizes).sort((a, b) => a - b).slice(0, 4),
    semanticNodeCounts: semanticIndex.semanticNodeCounts,
    lineRoleCounts: semanticIndex.lineRoleCounts,
    textRoleCounts: semanticIndex.textRoleCounts,
    groupedShapeCount: semanticIndex.groupedShapeCount,
    ungroupedShapeCount: semanticIndex.ungroupedShapeCount,
    moduleCount: semanticIndex.moduleCount,
    branchingNodeCount: semanticIndex.branchingNodeCount,
    mergeNodeCount: semanticIndex.mergeNodeCount,
    layoutBias: semanticIndex.layoutBias,
    roleLabelExamples: semanticIndex.roleLabelExamples,
  };
}

export function createBoardStyleSemanticIndex(
  board: PlaitBoard | null,
  elements: PlaitElement[]
): BoardStyleSemanticIndex {
  const metadataByElement = new Map<PlaitElement, BoardStyleSemanticMetadata>();
  const unique = uniqueElements(elements);
  const shapeElements = unique.filter((element) => isShapeNodeElement(board, element));
  const shapeInfos = shapeElements
    .map((element) => {
      const id = getElementId(element);
      if (!id) {
        return null;
      }

      return {
        element,
        id,
        label: getElementText(element),
        bounds: getElementBounds(element),
        isModule: false,
        grouped: false,
        role: 'process' as BoardNodeSemanticRole,
        inDegree: 0,
        outDegree: 0,
      };
    })
    .filter((info): info is ShapeSemanticInfo => info !== null);

  const moduleIds = resolveModuleIds(shapeInfos);
  const groupedIds = resolveGroupedIds(shapeInfos, moduleIds);
  const degreeMap = buildDegreeMap(unique);

  const roleLabelExamples: Partial<Record<BoardNodeSemanticRole, string[]>> = {};
  const semanticNodeCounts: Partial<Record<BoardNodeSemanticRole, number>> = {};
  let groupedShapeCount = 0;
  let ungroupedShapeCount = 0;
  let branchingNodeCount = 0;
  let mergeNodeCount = 0;

  shapeInfos.forEach((info) => {
    info.isModule = moduleIds.has(info.id);
    info.grouped = groupedIds.has(info.id);
    info.inDegree = degreeMap.get(info.id)?.inDegree ?? 0;
    info.outDegree = degreeMap.get(info.id)?.outDegree ?? 0;
    info.role = classifyNodeRole(info, info.element);

    if (info.outDegree > 1) {
      branchingNodeCount++;
    }
    if (info.inDegree > 1) {
      mergeNodeCount++;
    }
    if (!info.isModule) {
      if (info.grouped) {
        groupedShapeCount++;
      } else {
        ungroupedShapeCount++;
      }
    }

    semanticNodeCounts[info.role] = (semanticNodeCounts[info.role] ?? 0) + 1;
    if (info.label) {
      const samples = roleLabelExamples[info.role] ?? [];
      if (samples.length < 3 && !samples.includes(info.label)) {
        roleLabelExamples[info.role] = [...samples, info.label];
      }
    }
  });

  const shapeInfoMap = new Map(shapeInfos.map((info) => [info.id, info]));
  const layoutBias = resolveLayoutBias(unique, shapeInfoMap);
  const lineRoleCounts: Partial<Record<BoardLineSemanticRole, number>> = {};
  const textRoleCounts: Partial<Record<BoardTextSemanticRole, number>> = {};

  unique.forEach((element) => {
    if (isLineElement(element)) {
      const lineInfo = classifyLineRole(element, shapeInfoMap);
      lineRoleCounts[lineInfo.role] = (lineRoleCounts[lineInfo.role] ?? 0) + 1;
      metadataByElement.set(element, {
        selectors: [`line.${lineInfo.role}`, 'line', '*'],
        textSelectors: ['*'],
        lineRole: lineInfo.role,
      });
      return;
    }

    if (PlaitDrawElement.isText(element)) {
      const textRole = classifyStandaloneTextRole(element);
      textRoleCounts[textRole] = (textRoleCounts[textRole] ?? 0) + 1;
      metadataByElement.set(element, {
        selectors: [`text.${textRole}`, 'text', '*'],
        textSelectors: [`text.${textRole}`, 'text', '*'],
        textRole,
        label: getElementText(element),
      });
      return;
    }

    const info = shapeInfos.find((item) => item.element === element);
    if (!info) {
      metadataByElement.set(element, {
        selectors: ['shape', '*'],
        textSelectors: ['text.body', 'text', '*'],
      });
      return;
    }

    const textRole: BoardTextSemanticRole = info.isModule ? 'title' : 'body';
    textRoleCounts[textRole] = (textRoleCounts[textRole] ?? 0) + 1;

    const selectors: BoardStyleSelector[] = [`node.${info.role}`];
    if (!info.isModule) {
      selectors.push(info.grouped ? 'node.grouped' : 'node.ungrouped');
    }
    selectors.push('shape', '*');

    metadataByElement.set(element, {
      selectors,
      textSelectors: [`text.${textRole}`, 'text', '*'],
      nodeRole: info.role,
      textRole,
      grouped: info.grouped,
      isModule: info.isModule,
      label: info.label,
    });
  });

  return {
    metadataByElement,
    semanticNodeCounts,
    lineRoleCounts,
    textRoleCounts,
    groupedShapeCount,
    ungroupedShapeCount,
    moduleCount: moduleIds.size,
    branchingNodeCount,
    mergeNodeCount,
    layoutBias,
    roleLabelExamples,
  };
}

function flattenBoardElements(elements: PlaitElement[]): PlaitElement[] {
  return elements.flatMap((element) => {
    const childElements = Array.isArray((element as Record<string, unknown>)['children'])
      ? flattenBoardElements((element as Record<string, unknown>)['children'] as PlaitElement[])
      : [];

    return [element, ...childElements];
  });
}

function uniqueElements(elements: PlaitElement[]): PlaitElement[] {
  const seen = new Set<string>();

  return elements.filter((element) => {
    const id = getElementId(element);
    if (!id) {
      return true;
    }

    if (seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

function getElementId(element: PlaitElement): string | null {
  const rawElement = element as Record<string, unknown>;
  return typeof rawElement['id'] === 'string' ? rawElement['id'] : null;
}

function isLineElement(element: PlaitElement) {
  return PlaitDrawElement.isArrowLine(element) || PlaitDrawElement.isVectorLine(element);
}

function isShapeNodeElement(board: PlaitBoard | null, element: PlaitElement) {
  if (board && MindElement.isMindElement(board, element)) {
    return true;
  }

  return (
    PlaitDrawElement.isShapeElement(element)
    && !PlaitDrawElement.isText(element)
    && !isImageElement(element)
  );
}

function getLineEndpointIds(element: PlaitElement): {
  sourceId: string | null;
  targetId: string | null;
} {
  const rawElement = element as Record<string, unknown>;
  const source = rawElement['source'] as Record<string, unknown> | undefined;
  const target = rawElement['target'] as Record<string, unknown> | undefined;

  return {
    sourceId: typeof source?.['boundId'] === 'string'
      ? (source['boundId'] as string)
      : typeof rawElement['sourceId'] === 'string'
      ? (rawElement['sourceId'] as string)
      : null,
    targetId: typeof target?.['boundId'] === 'string'
      ? (target['boundId'] as string)
      : typeof rawElement['targetId'] === 'string'
      ? (rawElement['targetId'] as string)
      : null,
  };
}

function getStrokeColor(rawElement: Record<string, unknown>): string | null {
  if (typeof rawElement['strokeColor'] === 'string' && rawElement['strokeColor']) {
    return rawElement['strokeColor'] as string;
  }

  if (typeof rawElement['stroke'] === 'string' && rawElement['stroke']) {
    return rawElement['stroke'] as string;
  }

  return null;
}

function getFontSize(rawElement: Record<string, unknown>): number | null {
  const textStyle = rawElement['textStyle'] as Record<string, unknown> | undefined;
  const fontSize = textStyle?.['fontSize'];
  return typeof fontSize === 'number' ? fontSize : null;
}

function getElementText(element: PlaitElement): string {
  const rawElement = element as Record<string, unknown>;
  const candidates = [rawElement['text'], rawElement['label'], rawElement['content']];
  const value = candidates.find((item) => typeof item === 'string');
  return typeof value === 'string' ? value.trim() : '';
}

function getElementBounds(element: PlaitElement): ElementBounds | null {
  const rawElement = element as Record<string, unknown>;
  const points = rawElement['points'] as [Point, Point] | undefined;
  if (!Array.isArray(points) || points.length < 2) {
    return null;
  }

  const [start, end] = points;
  if (!Array.isArray(start) || !Array.isArray(end)) {
    return null;
  }

  const x = Math.min(start[0], end[0]);
  const y = Math.min(start[1], end[1]);
  const width = Math.abs(end[0] - start[0]);
  const height = Math.abs(end[1] - start[1]);

  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
    area: width * height,
  };
}

function resolveModuleIds(shapeInfos: ShapeSemanticInfo[]): Set<string> {
  const moduleIds = new Set<string>();

  shapeInfos.forEach((candidate) => {
    const candidateBounds = candidate.bounds;
    if (!candidateBounds) {
      return;
    }

    const containedCount = shapeInfos.filter((other) => {
      if (other.id === candidate.id || !other.bounds) {
        return false;
      }

      return (
        candidateBounds.area > other.bounds.area * 1.35
        && containsBounds(candidateBounds, other.bounds, 4)
      );
    }).length;

    if (containedCount > 0) {
      moduleIds.add(candidate.id);
    }
  });

  return moduleIds;
}

function resolveGroupedIds(shapeInfos: ShapeSemanticInfo[], moduleIds: Set<string>): Set<string> {
  const groupedIds = new Set<string>();
  const moduleShapes = shapeInfos.filter((info) => moduleIds.has(info.id) && info.bounds);

  shapeInfos.forEach((candidate) => {
    if (moduleIds.has(candidate.id) || !candidate.bounds) {
      return;
    }

    const insideModule = moduleShapes.some((moduleInfo) =>
      containsBounds(moduleInfo.bounds!, candidate.bounds!, 4)
    );

    if (insideModule) {
      groupedIds.add(candidate.id);
    }
  });

  return groupedIds;
}

function buildDegreeMap(elements: PlaitElement[]): Map<string, { inDegree: number; outDegree: number }> {
  const degreeMap = new Map<string, { inDegree: number; outDegree: number }>();

  elements.forEach((element) => {
    if (!isLineElement(element)) {
      return;
    }

    const { sourceId, targetId } = getLineEndpointIds(element);
    if (sourceId) {
      const current = degreeMap.get(sourceId) ?? { inDegree: 0, outDegree: 0 };
      current.outDegree += 1;
      degreeMap.set(sourceId, current);
    }
    if (targetId) {
      const current = degreeMap.get(targetId) ?? { inDegree: 0, outDegree: 0 };
      current.inDegree += 1;
      degreeMap.set(targetId, current);
    }
  });

  return degreeMap;
}

function classifyNodeRole(
  info: ShapeSemanticInfo,
  element: PlaitElement
): BoardNodeSemanticRole {
  if (info.isModule) {
    return 'module';
  }

  const label = info.label.toLowerCase();
  const rawElement = element as Record<string, unknown>;
  const shapeName = typeof rawElement['shape'] === 'string' ? rawElement['shape'].toLowerCase() : '';

  if (
    shapeName.includes('diamond')
    || containsKeyword(label, ['判断', '决策', '选择', '是否', 'if ', 'gate', 'route'])
  ) {
    return 'decision';
  }

  if (containsKeyword(label, ['注释', '说明', '备注', '可选', 'optional', 'note', 'comment', 'aux'])) {
    return 'annotation';
  }

  if (
    containsKeyword(label, ['输入', 'input', 'source', 'query', 'prompt', 'dataset', 'data'])
    || (info.inDegree === 0 && info.outDegree > 0)
  ) {
    return 'input';
  }

  if (
    containsKeyword(label, ['输出', 'output', 'result', '结果', 'prediction', '预测', 'score', 'label'])
    || (info.outDegree === 0 && info.inDegree > 0)
  ) {
    return 'output';
  }

  return 'process';
}

function classifyLineRole(
  element: PlaitElement,
  shapeInfoMap: Map<string, ShapeSemanticInfo>
): LineSemanticInfo {
  const id = getElementId(element) || '';
  const { sourceId, targetId } = getLineEndpointIds(element);
  const sourceInfo = sourceId ? shapeInfoMap.get(sourceId) : null;
  const targetInfo = targetId ? shapeInfoMap.get(targetId) : null;

  const role: BoardLineSemanticRole = !sourceInfo
    || !targetInfo
    || sourceInfo.role === 'annotation'
    || targetInfo.role === 'annotation'
    || sourceInfo.role === 'module'
    || targetInfo.role === 'module'
    ? 'secondary'
    : 'main';

  return { element, id, role };
}

function classifyStandaloneTextRole(element: PlaitElement): BoardTextSemanticRole {
  const label = getElementText(element).toLowerCase();
  if (
    containsKeyword(label, ['标题', 'title', 'stage', 'phase', 'module', '步骤', '模块'])
    || label.length <= 18
  ) {
    return 'title';
  }

  return 'body';
}

function resolveLayoutBias(
  elements: PlaitElement[],
  shapeInfoMap: Map<string, ShapeSemanticInfo>
): 'horizontal' | 'vertical' | 'mixed' | 'unknown' {
  let totalDx = 0;
  let totalDy = 0;
  let sampleCount = 0;

  elements.forEach((element) => {
    if (!isLineElement(element)) {
      return;
    }

    const { sourceId, targetId } = getLineEndpointIds(element);
    const sourceInfo = sourceId ? shapeInfoMap.get(sourceId) : null;
    const targetInfo = targetId ? shapeInfoMap.get(targetId) : null;
    if (!sourceInfo?.bounds || !targetInfo?.bounds) {
      return;
    }

    totalDx += Math.abs(sourceInfo.bounds.centerX - targetInfo.bounds.centerX);
    totalDy += Math.abs(sourceInfo.bounds.centerY - targetInfo.bounds.centerY);
    sampleCount++;
  });

  if (sampleCount === 0) {
    return 'unknown';
  }

  if (totalDx > totalDy * 1.25) {
    return 'horizontal';
  }

  if (totalDy > totalDx * 1.25) {
    return 'vertical';
  }

  return 'mixed';
}

function containsBounds(outer: ElementBounds, inner: ElementBounds, padding: number) {
  return (
    inner.x >= outer.x + padding
    && inner.y >= outer.y + padding
    && inner.x + inner.width <= outer.x + outer.width - padding
    && inner.y + inner.height <= outer.y + outer.height - padding
  );
}

function containsKeyword(label: string, keywords: string[]) {
  return keywords.some((keyword) => label.includes(keyword));
}

function isImageElement(element: PlaitElement) {
  return typeof (PlaitDrawElement as { isImage?: (value: unknown) => boolean }).isImage === 'function'
    ? !!(PlaitDrawElement as { isImage?: (value: unknown) => boolean }).isImage?.(element)
    : false;
}
