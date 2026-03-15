/**
 * 样式相关类型定义
 */

/**
 * 样式方案
 */
export interface StyleScheme {
  /** 应用到的节点 ID（'*' 表示全部） */
  nodeId: string;
  /** 填充颜色（CSS 颜色值） */
  fill: string;
  /** 边框颜色 */
  stroke: string;
  /** 边框粗细（px） */
  strokeWidth: number;
  /** 字体颜色 */
  color: string;
  /** 字体大小（px） */
  fontSize: number;
  /** 是否启用阴影 */
  shadow: boolean;
  /** 阴影模糊度 */
  shadowBlur: number;
  /** 字体粗细 */
  fontWeight?: number;
  /** 边框样式（solid, dashed, dotted） */
  strokeDasharray?: string;
}

/**
 * 图表结构信息
 */
export interface GraphInfo {
  /** 节点列表 */
  nodes: GraphNode[];
  /** 边列表 */
  edges: GraphEdge[];
  /** 分组列表 */
  groups: GraphGroup[];
  /** 图表深度 */
  depth: number;
  /** 平均度数 */
  avgDegree: number;
  /** 节点总数 */
  nodeCount: number;
}

/**
 * 图节点
 */
export interface GraphNode {
  /** 节点 ID */
  id: string;
  /** 节点标签 */
  label: string;
  /** 入度 */
  inDegree: number;
  /** 出度 */
  outDegree: number;
  /** 所属分组 ID */
  groupId?: string;
  /** 节点类型 */
  type?: 'input' | 'output' | 'process' | 'state';
}

/**
 * 图边
 */
export interface GraphEdge {
  /** 边 ID */
  id: string;
  /** 源节点 ID */
  source: string;
  /** 目标节点 ID */
  target: string;
  /** 边标签 */
  label?: string;
}

/**
 * 图分组
 */
export interface GraphGroup {
  /** 分组 ID */
  id: string;
  /** 分组标签 */
  label: string;
  /** 成员节点 ID 列表 */
  memberIds: string[];
  /** 分组顺序 */
  order?: number;
}
