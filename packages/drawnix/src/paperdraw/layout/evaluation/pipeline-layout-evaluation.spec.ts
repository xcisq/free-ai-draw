import { evaluatePipelineLayoutFixture } from './evaluate-pipeline-layout-fixture';
import {
  PIPELINE_LAYOUT_CORE_FIXTURE_IDS,
  PIPELINE_LAYOUT_FIXTURES,
} from './fixtures';
import type { PipelineLayoutEvaluationResult, PipelineLayoutFixture } from './types';

function expectStructureThresholds(
  fixture: PipelineLayoutFixture,
  result: PipelineLayoutEvaluationResult
) {
  const { expectedStructure } = fixture.expectation;

  expect(result.structure.spineLength).toBeGreaterThanOrEqual(
    expectedStructure.minSpineLength
  );

  if (expectedStructure.minBranchCount !== undefined) {
    expect(result.structure.branchCount).toBeGreaterThanOrEqual(
      expectedStructure.minBranchCount
    );
  }

  if (expectedStructure.minMergeCount !== undefined) {
    expect(result.structure.mergeCount).toBeGreaterThanOrEqual(
      expectedStructure.minMergeCount
    );
  }

  if (expectedStructure.minFeedbackCount !== undefined) {
    expect(result.structure.feedbackCount).toBeGreaterThanOrEqual(
      expectedStructure.minFeedbackCount
    );
  }

  if (expectedStructure.requireInputLeft) {
    expect(result.structure.hasInputLeft).toBe(true);
  }
  if (expectedStructure.requireOutputRight) {
    expect(result.structure.hasOutputRight).toBe(true);
  }
  if (expectedStructure.requireAuxBottom) {
    expect(result.structure.hasAuxBottom).toBe(true);
  }
  if (expectedStructure.requireControlTop) {
    expect(result.structure.hasControlTop).toBe(true);
  }
  if (expectedStructure.requireOuterFeedback) {
    expect(result.structure.hasOuterFeedback).toBe(true);
  }
  if (expectedStructure.requireSeparatedNonSpine) {
    expect(result.structure.hasSeparatedNonSpine).toBe(true);
  }
}

function expectMetricThresholds(
  fixture: PipelineLayoutFixture,
  result: PipelineLayoutEvaluationResult
) {
  const { metricThresholds } = fixture.expectation;

  if (metricThresholds.maxHardConstraintViolations !== undefined) {
    expect(result.metrics.hardConstraintViolations).toBeLessThanOrEqual(
      metricThresholds.maxHardConstraintViolations
    );
  }
  if (metricThresholds.maxNodeCrossings !== undefined) {
    expect(result.metrics.nodeCrossings).toBeLessThanOrEqual(
      metricThresholds.maxNodeCrossings
    );
  }
  if (metricThresholds.maxModuleCrossings !== undefined) {
    expect(result.metrics.moduleCrossings).toBeLessThanOrEqual(
      metricThresholds.maxModuleCrossings
    );
  }
  if (metricThresholds.requireZeroHardViolations) {
    expect(result.metrics.hardConstraintViolations).toBe(0);
  }
  if (metricThresholds.requireZeroNodeCrossings) {
    expect(result.metrics.nodeCrossings).toBe(0);
  }
  if (metricThresholds.requireZeroModuleCrossings) {
    expect(result.metrics.moduleCrossings).toBe(0);
  }
  expect(result.metrics.edgeCrossings).toBeLessThanOrEqual(
    metricThresholds.maxEdgeCrossings
  );
  expect(result.metrics.bendCount).toBeLessThanOrEqual(
    metricThresholds.maxBendCount
  );
  expect(result.metrics.routeLength).toBeLessThanOrEqual(
    metricThresholds.maxRouteLength
  );
}

describe('pipeline-layout-evaluation', () => {
  it('evaluates all 12 fixtures and records stable routing results', async () => {
    const results = await Promise.all(
      PIPELINE_LAYOUT_FIXTURES.map((fixture) =>
        evaluatePipelineLayoutFixture(fixture)
      )
    );

    expect(results).toHaveLength(12);
    expect(
      results.every(
        (result) =>
          Boolean(result.optimizedLayout.templateId) &&
          Boolean(result.optimizedLayout.routingEngine) &&
          result.metrics.routeLength > 0
      )
    ).toBe(true);
  });

  it('meets the aggregate baseline thresholds across the full fixture set', async () => {
    const results = await Promise.all(
      PIPELINE_LAYOUT_FIXTURES.map((fixture) =>
        evaluatePipelineLayoutFixture(fixture)
      )
    );

    const templateMatches = results.filter((result) => result.structure.templateMatched).length;
    const zeroNodeCrossings = results.filter(
      (result) => result.metrics.nodeCrossings === 0
    ).length;
    const limitedModuleCrossings = results.filter(
      (result) => result.metrics.moduleCrossings <= 7
    ).length;
    const zeroEdgeCrossings = results.filter(
      (result) => result.metrics.edgeCrossings === 0
    ).length;
    const nonLinearCategories = results.filter((result) =>
      ['B', 'C', 'F'].includes(result.category)
    );
    const separatedNonLinear = nonLinearCategories.filter(
      (result) => result.structure.hasSeparatedNonSpine
    ).length;

    expect(templateMatches).toBeGreaterThanOrEqual(10);
    expect(zeroNodeCrossings).toBeGreaterThanOrEqual(10);
    expect(limitedModuleCrossings).toBeGreaterThanOrEqual(10);
    expect(zeroEdgeCrossings).toBe(results.length);
    expect(separatedNonLinear).toBe(nonLinearCategories.length);
  });

  it('meets strict thresholds for the 6 core fixtures', async () => {
    const fixtures = PIPELINE_LAYOUT_FIXTURES.filter((fixture) =>
      PIPELINE_LAYOUT_CORE_FIXTURE_IDS.includes(fixture.id)
    );

    for (const fixture of fixtures) {
      const result = await evaluatePipelineLayoutFixture(fixture);
      expect(result.optimizedLayout.routingEngine).toBeDefined();
      expect(result.structure.templateMatched).toBe(true);
      expectStructureThresholds(fixture, result);
      expectMetricThresholds(fixture, result);
    }
  });
});
