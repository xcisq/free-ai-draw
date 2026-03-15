import { describe, expect, it } from '@jest/globals';
import {
  applyStyleSchemesToElements,
  extractStyleSchemesFromMermaid,
  serializeStyleScheme,
} from './style-applier';

describe('style-applier', () => {
  it('应该从 Mermaid 代码中提取样式方案', () => {
    const styles = extractStyleSchemesFromMermaid(`flowchart LR
A[输入]:::input --> B[输出]:::output
classDef input fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#ffffff,fontSize:16px,stroke-dasharray:5 3
classDef output fill:#E94B35,stroke:#A33525,stroke-width:2px,color:#ffffff`);

    expect(styles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'input',
          fill: '#4A90E2',
          stroke: '#2E5C8A',
          strokeWidth: 2,
          fontSize: 16,
          strokeDasharray: '5 3',
        }),
        expect.objectContaining({
          nodeId: 'output',
          fill: '#E94B35',
        }),
      ])
    );
  });

  it('应该把样式方案序列化为 classDef', () => {
    expect(
      serializeStyleScheme({
        nodeId: 'process',
        fill: '#ffffff',
        stroke: '#333333',
        strokeWidth: 1,
        color: '#333333',
        fontSize: 14,
        shadow: false,
        shadowBlur: 0,
        strokeDasharray: '6 3',
      })
    ).toContain('classDef process fill:#ffffff,stroke:#333333,stroke-width:1px,color:#333333,fontSize:14px,stroke-dasharray:6 3');
  });

  it('应该把通用样式应用到元素', () => {
    const elements = [
      {
        id: 'node-1',
        fill: '#ffffff',
        strokeColor: '#111111',
        strokeWidth: 1,
        textStyle: {
          color: '#111111',
          fontSize: 12,
        },
      },
    ] as any[];

    const nextElements = applyStyleSchemesToElements(elements as any, [
      {
        nodeId: '*',
        fill: '#f5f7fb',
        stroke: '#22558f',
        strokeWidth: 2,
        color: '#22558f',
        fontSize: 15,
        shadow: false,
        shadowBlur: 0,
      },
    ]);

    expect(nextElements[0]).toEqual(
      expect.objectContaining({
        fill: '#f5f7fb',
        strokeColor: '#22558f',
        strokeWidth: 2,
        textStyle: expect.objectContaining({
          color: '#22558f',
          fontSize: 15,
        }),
      })
    );
  });
});
