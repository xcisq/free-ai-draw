import { evaluatePipelineLayoutFixture } from './evaluate-pipeline-layout-fixture';
import { PIPELINE_LAYOUT_FIXTURES } from './fixtures';
import { serializePipelineLayoutEvaluationResult } from './serialize-pipeline-layout-trace';

describe('serialize-pipeline-layout-trace', () => {
  it('serializes evaluation traces into a stable JSON-friendly structure', async () => {
    const result = await evaluatePipelineLayoutFixture(
      PIPELINE_LAYOUT_FIXTURES[0]
    );

    const serialized = serializePipelineLayoutEvaluationResult(result);

    expect(serialized.fixtureId).toBe(PIPELINE_LAYOUT_FIXTURES[0].id);
    expect(serialized.trace.summary.expectedTemplateId).toBe(
      PIPELINE_LAYOUT_FIXTURES[0].expectation.expectedTemplateId
    );
    expect(serialized.trace.draft.layout.nodes.length).toBeGreaterThan(0);
    expect(serialized.trace.optimized.layout.edges.length).toBeGreaterThan(0);
    expect(serialized.trace.optimized.intent.layoutHints).toEqual(
      [...serialized.trace.optimized.intent.layoutHints].sort()
    );
    expect(() => JSON.stringify(serialized)).not.toThrow();
  });
});
