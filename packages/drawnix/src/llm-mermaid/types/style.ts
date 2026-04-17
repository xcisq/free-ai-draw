/**
 * 样式相关类型定义
 */

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

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 错误列表 */
  errors: string[];
  /** 警告列表 */
  warnings: string[];
}
