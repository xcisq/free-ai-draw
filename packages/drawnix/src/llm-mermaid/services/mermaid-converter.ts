/**
 * Mermaid 转换服务
 * 使用 @plait-board/mermaid-to-drawnix 库转换 Mermaid 代码为 Plait 元素
 */

import type { PlaitElement, Point } from '@plait/core';
import type { MermaidConfig } from '@plait-board/mermaid-to-drawnix/dist';
import type { GraphInfo, GraphNode, GraphEdge, GraphGroup } from '../types';
import { validateMermaidCode as validateCode, extractMermaidCode } from './prompt-templates';

/**
 * 验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Mermaid 转换结果
 */
export interface MermaidConversionResult {
  elements: PlaitElement[];
  mermaidCode: string;
  validation: ValidationResult;
}

/**
 * Mermaid 转换服务类
 */
export class MermaidConverter {
  private mermaidLib: typeof import('@plait-board/mermaid-to-drawnix/dist') | null = null;
  private isLibLoaded = false;

  /**
   * 动态加载 Mermaid 转换库
   */
  private async loadLib(): Promise<typeof import('@plait-board/mermaid-to-drawnix/dist')> {
    if (this.mermaidLib) {
      return this.mermaidLib;
    }

    try {
      this.mermaidLib = await import('@plait-board/mermaid-to-drawnix');
      this.isLibLoaded = true;
      return this.mermaidLib;
    } catch (error) {
      throw new Error(
        `Failed to load mermaid-to-drawnix library: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * 将 Mermaid 代码转换为 Plait 元素
   */
  async convertToElements(mermaidCode: string, config?: MermaidConfig): Promise<PlaitElement[]> {
    const lib = await this.loadLib();

    try {
      const result = await lib.parseMermaidToDrawnix(mermaidCode, config);
      return result.elements || [];
    } catch (error) {
      // 尝试修复引号问题后重试
      const fixedCode = this.fixQuotes(mermaidCode);
      try {
        const result = await lib.parseMermaidToDrawnix(fixedCode, config);
        return result.elements || [];
      } catch {
        throw new Error(
          `Mermaid conversion failed: ${error instanceof Error ? error.message : error}`
        );
      }
    }
  }

  /**
   * 验证 Mermaid 代码
   */
  validateMermaid(mermaidCode: string): ValidationResult {
    return validateCode(mermaidCode);
  }

  /**
   * 直接从 Mermaid 代码中提取图表结构信息
   */
  extractGraphInfoFromCode(mermaidCode: string): GraphInfo {
    const code = extractMermaidCode(mermaidCode);
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const groups = new Map<string, GraphGroup>();
    const groupStack: string[] = [];

    code.split('\n').forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('%%')) {
        return;
      }

      if (line.startsWith('subgraph ')) {
        const group = this.parseGroup(line, groups.size);
        groups.set(group.id, group);
        groupStack.push(group.id);
        return;
      }

      if (line === 'end') {
        groupStack.pop();
        return;
      }

      if (/^(classDef|class|style|linkStyle|click)\b/.test(line)) {
        return;
      }

      const currentGroupId = groupStack[groupStack.length - 1];
      const nodeRefs = this.extractNodeReferences(line);

      nodeRefs.forEach((nodeRef) => {
        this.upsertNode(nodes, nodeRef, currentGroupId, groups);
      });

      if (nodeRefs.length >= 2) {
        nodeRefs.slice(0, -1).forEach((sourceRef, index) => {
          const targetRef = nodeRefs[index + 1];
          if (!sourceRef || !targetRef) {
            return;
          }

          edges.push({
            id: `edge-${sourceRef.id}-${targetRef.id}-${edges.length}`,
            source: sourceRef.id,
            target: targetRef.id,
          });
        });
      }
    });

    const nodeList = Array.from(nodes.values());
    nodeList.forEach((node) => {
      node.inDegree = edges.filter((edge) => edge.target === node.id).length;
      node.outDegree = edges.filter((edge) => edge.source === node.id).length;
    });

    const totalDegree = nodeList.reduce((sum, node) => sum + node.inDegree + node.outDegree, 0);

    return {
      nodes: nodeList,
      edges,
      groups: Array.from(groups.values()),
      depth: this.calculateDepth(nodeList, edges),
      avgDegree: nodeList.length > 0 ? totalDegree / nodeList.length : 0,
      nodeCount: nodeList.length,
    };
  }

  /**
   * 从 Plait 元素中提取图表结构信息
   */
  extractGraphInfo(elements: PlaitElement[]): GraphInfo {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const groups: GraphGroup[] = [];

    // 计算入度和出度
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    const nodeLabels = new Map<string, string>();

    // 遍历元素提取信息
    for (const element of elements) {
      if (this.isNode(element)) {
        const id = this.getElementId(element);
        const label = this.getElementLabel(element);
        nodeLabels.set(id, label);
        inDegree.set(id, 0);
        outDegree.set(id, 0);
        nodes.push({
          id,
          label,
          inDegree: 0,
          outDegree: 0,
          type: this.inferNodeType(element),
        });
      }
    }

    // 提取边和计算度数
    for (const element of elements) {
      if (this.isEdge(element)) {
        const source = this.getEdgeSource(element);
        const target = this.getEdgeTarget(element);

        if (source && target && nodeLabels.has(source) && nodeLabels.has(target)) {
          edges.push({
            id: this.getElementId(element),
            source,
            target,
            label: this.getEdgeLabel(element),
          });

          outDegree.set(source, (outDegree.get(source) || 0) + 1);
          inDegree.set(target, (inDegree.get(target) || 0) + 1);
        }
      }
    }

    // 更新节点的度数
    for (const node of nodes) {
      node.inDegree = inDegree.get(node.id) || 0;
      node.outDegree = outDegree.get(node.id) || 0;
    }

    // 计算图表深度（简单估算）
    const depth = this.calculateDepth(nodes, edges);

    // 计算平均度数
    const totalDegree = nodes.reduce((sum, n) => sum + n.inDegree + n.outDegree, 0);
    const avgDegree = nodes.length > 0 ? totalDegree / nodes.length : 0;

    return {
      nodes,
      edges,
      groups,
      depth,
      avgDegree,
      nodeCount: nodes.length,
    };
  }

  /**
   * 判断元素是否为节点
   */
  private isNode(element: PlaitElement): boolean {
    return !!(element as any).points;
  }

  /**
   * 判断元素是否为边
   */
  private isEdge(element: PlaitElement): boolean {
    return !!(element as any).source && !!(element as any).target;
  }

  /**
   * 获取元素 ID
   */
  private getElementId(element: PlaitElement): string {
    return (element as any).id || (element as any).uuid || 'unknown';
  }

  /**
   * 获取元素标签
   */
  private getElementLabel(element: PlaitElement): string {
    return (element as any).text || (element as any).label || (element as any).content || '';
  }

  /**
   * 获取边的源节点
   */
  private getEdgeSource(element: PlaitElement): string | null {
    return (element as any).source || (element as any).sourceId || null;
  }

  /**
   * 获取边的目标节点
   */
  private getEdgeTarget(element: PlaitElement): string | null {
    return (element as any).target || (element as any).targetId || null;
  }

  /**
   * 获取边标签
   */
  private getEdgeLabel(element: PlaitElement): string | undefined {
    return (element as any).label || (element as any).text;
  }

  /**
   * 推断节点类型
   */
  private inferNodeType(element: PlaitElement): 'input' | 'output' | 'process' | 'state' {
    // 简单推断逻辑
    const label = this.getElementLabel(element).toLowerCase();
    if (label.includes('输入') || label.includes('input')) return 'input';
    if (label.includes('输出') || label.includes('output')) return 'output';
    if (label.includes('状态') || label.includes('state')) return 'state';
    return 'process';
  }

  /**
   * 计算图表深度
   */
  private calculateDepth(nodes: GraphNode[], edges: GraphEdge[]): number {
    if (nodes.length === 0) return 0;

    // 使用 BFS 计算最长路径
    const inDegree = new Map<string, number>();
    for (const node of nodes) {
      inDegree.set(node.id, node.inDegree);
    }

    const queue: string[] = [];
    const depth = new Map<string, number>();

    // 从入度为 0 的节点开始
    for (const node of nodes) {
      if (node.inDegree === 0) {
        queue.push(node.id);
        depth.set(node.id, 1);
      }
    }

    let maxDepth = 1;
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDepth = depth.get(current) || 1;

      for (const edge of edges) {
        if (edge.source === current) {
          const nextDepth = currentDepth + 1;
          const existingDepth = depth.get(edge.target);
          if (!existingDepth || nextDepth > existingDepth) {
            depth.set(edge.target, nextDepth);
            maxDepth = Math.max(maxDepth, nextDepth);
          }
          inDegree.set(edge.target, (inDegree.get(edge.target) || 0) - 1);
          if (inDegree.get(edge.target) === 0) {
            queue.push(edge.target);
          }
        }
      }
    }

    return maxDepth;
  }

  private parseGroup(line: string, order: number): GraphGroup {
    const match = line.match(/^subgraph\s+([A-Za-z0-9_-]+)?(?:\s+\[(.+)\]|\s+"(.+)"|\s+(.+))?$/);
    const id = match?.[1] || `group-${order + 1}`;
    const label = match?.[2] || match?.[3] || match?.[4] || id;

    return {
      id,
      label: label.trim(),
      memberIds: [],
      order,
    };
  }

  private extractNodeReferences(line: string): Array<{
    id: string;
    label: string;
    type: GraphNode['type'];
  }> {
    const normalizedLine = line
      .replace(/\|[^|]*\|/g, '')
      .replace(/-->|---|-.->|==>|==/g, '|');

    return normalizedLine
      .split('|')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => this.parseNodeReference(segment))
      .filter((node): node is { id: string; label: string; type: GraphNode['type'] } => !!node);
  }

  private parseNodeReference(segment: string):
    | {
      id: string;
      label: string;
      type: GraphNode['type'];
    }
    | null {
    const cleanedSegment = segment.replace(/;+$/, '').trim();
    const idMatch = cleanedSegment.match(/^([A-Za-z0-9_-]+)/);

    if (!idMatch) {
      return null;
    }

    const id = idMatch[1];
    const classMatch = cleanedSegment.match(/:::([A-Za-z0-9_-]+)/);
    const label = this.extractNodeLabel(cleanedSegment, id);
    const inferredType = this.inferNodeTypeFromText(label, classMatch?.[1]);

    return {
      id,
      label,
      type: inferredType,
    };
  }

  private extractNodeLabel(segment: string, fallback: string): string {
    const remainder = segment.slice(fallback.length).replace(/:::[A-Za-z0-9_-]+/, '').trim();
    if (!remainder) {
      return fallback;
    }

    const sanitized = remainder
      .replace(/^[\[\(\{<"\s]+/, '')
      .replace(/[\]\)\}>"\s]+$/, '')
      .replace(/^["']|["']$/g, '')
      .trim();

    return sanitized || fallback;
  }

  private inferNodeTypeFromText(
    label: string,
    className?: string
  ): 'input' | 'output' | 'process' | 'state' {
    const lowerText = `${className || ''} ${label}`.toLowerCase();
    if (lowerText.includes('输入') || lowerText.includes('input')) return 'input';
    if (lowerText.includes('输出') || lowerText.includes('output')) return 'output';
    if (lowerText.includes('状态') || lowerText.includes('state')) return 'state';
    return 'process';
  }

  private upsertNode(
    nodes: Map<string, GraphNode>,
    nodeRef: { id: string; label: string; type: GraphNode['type'] },
    currentGroupId: string | undefined,
    groups: Map<string, GraphGroup>
  ) {
    const existingNode = nodes.get(nodeRef.id);

    if (!existingNode) {
      nodes.set(nodeRef.id, {
        id: nodeRef.id,
        label: nodeRef.label,
        inDegree: 0,
        outDegree: 0,
        groupId: currentGroupId,
        type: nodeRef.type,
      });
    } else {
      existingNode.label = existingNode.label || nodeRef.label;
      existingNode.groupId = existingNode.groupId || currentGroupId;
      existingNode.type = existingNode.type || nodeRef.type;
    }

    if (currentGroupId) {
      const group = groups.get(currentGroupId);
      if (group && !group.memberIds.includes(nodeRef.id)) {
        group.memberIds.push(nodeRef.id);
      }
    }
  }

  /**
   * 修复 Mermaid 代码中的引号问题
   */
  private fixQuotes(code: string): string {
    // 将双引号替换为单引号（常见修复策略）
    return code.replace(/"/g, "'");
  }

  /**
   * 检查库是否已加载
   */
  isLibReady(): boolean {
    return this.isLibLoaded;
  }

  /**
   * 检查是否已配置
   */
  isConfigured(): boolean {
    return !!this.mermaidLib;
  }
}

/**
 * 默认 Mermaid 转换服务实例
 */
export const mermaidConverter = new MermaidConverter();
