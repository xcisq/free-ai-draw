import { describe, expect, it } from '@jest/globals';
import {
  clearStyles,
  extractStyles,
  fixMermaidCode,
} from './mermaid-helper';

describe('mermaid-helper', () => {
  it('应该为缺少类型声明的代码补上默认 flowchart', () => {
    const fixed = fixMermaidCode('A[开始] --> B[结束]');
    expect(fixed.startsWith('flowchart LR')).toBe(true);
  });

  it('应该解析 Mermaid 标准 inline classDef 语法', () => {
    const styles = extractStyles(
      'flowchart LR\nA --> B\nclassDef process fill:#fff,stroke:#333,stroke-width:2px'
    );

    expect(styles).toEqual([
      {
        className: 'process',
        styles: {
          fill: '#fff',
          stroke: '#333',
          'stroke-width': '2px',
        },
      },
    ]);
  });

  it('应该清理所有 classDef 样式行', () => {
    const cleaned = clearStyles(
      'flowchart LR\nA --> B\nclassDef process fill:#fff,stroke:#333\nclassDef input fill:#eee'
    );

    expect(cleaned).toBe('flowchart LR\nA --> B');
  });
});
