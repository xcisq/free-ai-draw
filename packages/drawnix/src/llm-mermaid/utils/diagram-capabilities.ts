import type {
  MermaidDiagramType,
  MermaidPreviewMode,
  MermaidStyleMode,
} from '../types';

type DiagramDeclaration =
  | 'flowchart'
  | 'graph'
  | 'sequenceDiagram'
  | 'classDiagram'
  | 'stateDiagram'
  | 'stateDiagram-v2'
  | 'erDiagram'
  | 'journey'
  | 'gantt'
  | 'pie'
  | 'gitGraph'
  | 'requirementDiagram'
  | 'mindmap'
  | 'timeline'
  | 'quadrantChart'
  | 'xychart'
  | 'xychart-beta'
  | 'sankey'
  | 'sankey-beta'
  | 'C4Context'
  | 'C4Container'
  | 'C4Component'
  | 'C4Dynamic'
  | 'C4Deployment'
  | 'block'
  | 'block-beta'
  | 'packet'
  | 'packet-beta'
  | 'kanban'
  | 'architecture'
  | 'architecture-beta'
  | 'zenuml';

export interface MermaidDiagramCapability {
  type: MermaidDiagramType;
  label: string;
  declarations: DiagramDeclaration[];
  previewMode: MermaidPreviewMode;
  nativeEditable: boolean;
  flowchartLike?: boolean;
  promptKeywords: string[];
}

export const MERMAID_DIAGRAM_CAPABILITIES: MermaidDiagramCapability[] = [
  {
    type: 'flowchart',
    label: '流程图 / Flowchart',
    declarations: ['flowchart', 'graph'],
    previewMode: 'native-editable',
    nativeEditable: true,
    flowchartLike: true,
    promptKeywords: ['flowchart', 'graph', '流程图', '框架图', 'pipeline'],
  },
  {
    type: 'sequenceDiagram',
    label: '时序图 / Sequence',
    declarations: ['sequenceDiagram'],
    previewMode: 'native-editable',
    nativeEditable: true,
    promptKeywords: ['sequenceDiagram', 'sequence', '时序图', '序列图'],
  },
  {
    type: 'classDiagram',
    label: '类图 / Class',
    declarations: ['classDiagram'],
    previewMode: 'native-editable',
    nativeEditable: true,
    promptKeywords: ['classDiagram', 'class diagram', '类图'],
  },
  {
    type: 'stateDiagram',
    label: '状态图 / State',
    declarations: ['stateDiagram', 'stateDiagram-v2'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    flowchartLike: true,
    promptKeywords: ['stateDiagram', 'state', '状态图'],
  },
  {
    type: 'erDiagram',
    label: 'ER 图 / Entity Relationship',
    declarations: ['erDiagram'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    promptKeywords: ['erDiagram', 'er diagram', 'ER图', '实体关系'],
  },
  {
    type: 'journey',
    label: '用户旅程 / Journey',
    declarations: ['journey'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    promptKeywords: ['journey', '用户旅程', '旅程图'],
  },
  {
    type: 'gantt',
    label: '甘特图 / Gantt',
    declarations: ['gantt'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    promptKeywords: ['gantt', '甘特图'],
  },
  {
    type: 'pie',
    label: '饼图 / Pie',
    declarations: ['pie'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    promptKeywords: ['pie', '饼图'],
  },
  {
    type: 'gitGraph',
    label: 'Git Graph',
    declarations: ['gitGraph'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    promptKeywords: ['gitGraph', 'git graph'],
  },
  {
    type: 'requirementDiagram',
    label: '需求图 / Requirement',
    declarations: ['requirementDiagram'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    promptKeywords: ['requirementDiagram', '需求图'],
  },
  {
    type: 'mindmap',
    label: '思维导图 / Mindmap',
    declarations: ['mindmap'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    promptKeywords: ['mindmap', 'mind map', '思维导图'],
  },
  {
    type: 'timeline',
    label: '时间线 / Timeline',
    declarations: ['timeline'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    promptKeywords: ['timeline', '时间线'],
  },
  {
    type: 'quadrantChart',
    label: '象限图 / Quadrant',
    declarations: ['quadrantChart'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    promptKeywords: ['quadrantChart', 'quadrant', '象限图', '四象限'],
  },
  {
    type: 'xychart',
    label: 'XY 图 / Chart',
    declarations: ['xychart', 'xychart-beta'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    promptKeywords: ['xychart', 'xy chart', '折线图', '柱状图', '图表'],
  },
  {
    type: 'sankey',
    label: '桑基图 / Sankey',
    declarations: ['sankey', 'sankey-beta'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    promptKeywords: ['sankey', '桑基图'],
  },
  {
    type: 'c4',
    label: 'C4 架构图',
    declarations: ['C4Context', 'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    promptKeywords: ['c4', 'C4', '系统上下文图', '容器图', '组件图'],
  },
  {
    type: 'block',
    label: '块图 / Block',
    declarations: ['block', 'block-beta'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    promptKeywords: ['block', 'block-beta', '块图', '方块图'],
  },
  {
    type: 'packet',
    label: 'Packet',
    declarations: ['packet', 'packet-beta'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    promptKeywords: ['packet', 'packet-beta'],
  },
  {
    type: 'kanban',
    label: '看板 / Kanban',
    declarations: ['kanban'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    promptKeywords: ['kanban', '看板'],
  },
  {
    type: 'architecture',
    label: '架构图 / Architecture',
    declarations: ['architecture', 'architecture-beta'],
    previewMode: 'svg-fallback',
    nativeEditable: false,
    promptKeywords: ['architecture', 'architecture-beta', '架构图'],
  },
];

const DECLARATION_TO_TYPE = new Map<string, MermaidDiagramType>();
for (const capability of MERMAID_DIAGRAM_CAPABILITIES) {
  capability.declarations.forEach((declaration) => {
    DECLARATION_TO_TYPE.set(declaration.toLowerCase(), capability.type);
  });
}

const DECLARATION_PATTERN = new RegExp(
  `^(${Array.from(DECLARATION_TO_TYPE.keys())
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join('|')})\\b`,
  'i'
);

export function getDiagramCapability(type: MermaidDiagramType | undefined) {
  if (!type || type === 'auto' || type === 'other') {
    return null;
  }

  return MERMAID_DIAGRAM_CAPABILITIES.find((capability) => capability.type === type) || null;
}

export function getDiagramTypeLabel(type: MermaidDiagramType | undefined) {
  if (!type || type === 'auto') {
    return '自动判断';
  }

  if (type === 'other') {
    return '其他 Mermaid 类型';
  }

  return getDiagramCapability(type)?.label || type;
}

export function getStyleModeLabel(mode: MermaidStyleMode | undefined) {
  switch (mode) {
    case 'minimal':
      return '极简纯净';
    case 'semantic':
      return '语义配色';
    case 'grouped':
      return '分组信息图';
    case 'showcase':
      return '展示增强';
    case 'auto':
    default:
      return '自动';
  }
}

export function resolveDiagramTypeFromIntent(
  sourceText: string,
  requestedType: MermaidDiagramType | undefined = 'auto'
) {
  if (requestedType && requestedType !== 'auto') {
    return requestedType;
  }

  const normalizedText = sourceText.toLowerCase();

  for (const capability of MERMAID_DIAGRAM_CAPABILITIES) {
    if (
      capability.promptKeywords.some((keyword) =>
        normalizedText.includes(keyword.toLowerCase())
      )
    ) {
      return capability.type;
    }
  }

  return 'flowchart';
}

export function detectDiagramTypeFromCode(code: string): MermaidDiagramType | null {
  const declaration = findDiagramDeclaration(code);
  if (!declaration) {
    return null;
  }

  return DECLARATION_TO_TYPE.get(declaration.toLowerCase()) || 'other';
}

export function findDiagramDeclaration(code: string): string | null {
  const normalizedCode = code.replace(/\r\n?/g, '\n').trim();
  if (!normalizedCode) {
    return null;
  }

  const lines = normalizedCode.split('\n');
  let insideFrontmatter = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (!insideFrontmatter && line === '---') {
      insideFrontmatter = true;
      continue;
    }

    if (insideFrontmatter) {
      if (line === '---') {
        insideFrontmatter = false;
      }
      continue;
    }

    if (/^%%\{.*\}%%$/.test(line) || /^%%/.test(line)) {
      continue;
    }

    const match = line.match(DECLARATION_PATTERN);
    if (match?.[1]) {
      return match[1];
    }

    break;
  }

  return null;
}

export function getPreviewModeForDiagramType(
  type: MermaidDiagramType | null | undefined
): MermaidPreviewMode {
  if (!type) {
    return 'native-editable';
  }

  return getDiagramCapability(type)?.previewMode || 'svg-fallback';
}

export function getPreviewModeLabel(mode: MermaidPreviewMode) {
  return mode === 'native-editable' ? '原生可编辑' : 'SVG 高保真';
}

export function isFlowchartLikeDiagram(type: MermaidDiagramType | null | undefined) {
  if (!type) {
    return true;
  }

  return Boolean(getDiagramCapability(type)?.flowchartLike);
}

export function getPreferredDeclarationForType(type: MermaidDiagramType | undefined) {
  return getDiagramCapability(type)?.declarations[0] || null;
}

export function buildDiagramTypePromptText(type: MermaidDiagramType | undefined) {
  if (!type || type === 'auto') {
    return '未显式指定，请根据用户原文自动判断最合适的 Mermaid 图类型。';
  }

  if (type === 'other') {
    return '用户会在原文里显式写出 Mermaid 图类型，请优先遵从原文中的类型声明。';
  }

  const declaration = getPreferredDeclarationForType(type);
  return `优先生成 ${declaration} 类型，除非用户原文已经明确要求其他 Mermaid 类型。`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
