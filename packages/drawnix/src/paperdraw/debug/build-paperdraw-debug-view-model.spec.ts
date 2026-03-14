import type { AnalysisResult, ExtractionResult } from '../types/analyzer';
import { buildPaperDrawDebugViewModel } from './build-paperdraw-debug-view-model';

describe('buildPaperDrawDebugViewModel', () => {
  it('builds stage summaries, role changes and template hints from extraction and analysis', () => {
    const extraction: ExtractionResult = {
      entities: [
        { id: 'n1', label: 'Input Image', roleCandidate: 'media' },
        { id: 'n2', label: 'Main Encoder' },
        { id: 'n3', label: 'Control Prompt', roleCandidate: 'parameter' },
        { id: 'n4', label: 'Aux Decoder', roleCandidate: 'decoder' },
        { id: 'n5', label: 'Output State', roleCandidate: 'output' },
      ],
      relations: [
        { id: 'r1', type: 'sequential', source: 'n1', target: 'n2' },
        { id: 'r2', type: 'annotative', source: 'n3', target: 'n2' },
        { id: 'r3', type: 'sequential', source: 'n2', target: 'n4' },
        { id: 'r4', type: 'sequential', source: 'n2', target: 'n5' },
      ],
      modules: [
        { id: 'm1', label: 'Input', entityIds: ['n1'], order: 1 },
        {
          id: 'm2',
          label: 'Control Main',
          entityIds: ['n2', 'n3'],
          order: 2,
          roleCandidate: 'control_stage',
        },
        {
          id: 'm3',
          label: 'Main Aux',
          entityIds: ['n4', 'n5'],
          order: 3,
          roleCandidate: 'auxiliary_stage',
        },
      ],
      spineCandidate: ['n1', 'n2', 'n5'],
    };

    const analysis: AnalysisResult = {
      entities: [...extraction.entities],
      relations: [
        { id: 'r1', type: 'sequential', source: 'n1', target: 'n2', roleCandidate: 'main' },
        { id: 'r2', type: 'annotative', source: 'n3', target: 'n2', roleCandidate: 'control' },
        { id: 'r3', type: 'sequential', source: 'n2', target: 'n4', roleCandidate: 'auxiliary' },
        { id: 'r4', type: 'sequential', source: 'n2', target: 'n5', roleCandidate: 'main' },
      ],
      weights: {
        n1: 0.9,
        n2: 0.88,
        n3: 0.74,
        n4: 0.66,
        n5: 0.9,
      },
      modules: [
        { id: 'm1', label: 'Input', entityIds: ['n1'], order: 1, roleCandidate: 'input_stage' },
        { id: 'm2', label: 'Control Main', entityIds: ['n2', 'n3'], order: 2, roleCandidate: 'core_stage' },
        { id: 'm3', label: 'Main Aux', entityIds: ['n4', 'n5'], order: 3, roleCandidate: 'core_stage' },
      ],
      spineCandidate: ['n1', 'n2', 'n5'],
      warnings: ['本地 QA 已确认主干候选'],
    };

    const viewModel = buildPaperDrawDebugViewModel(extraction, analysis);

    expect(viewModel).not.toBeNull();
    expect(viewModel?.extraction?.entityCount).toBe(5);
    expect(viewModel?.analysis?.warningCount).toBe(1);
    expect(viewModel?.intent?.dominantSpine).toEqual(['n1', 'n2', 'n5']);
    expect(viewModel?.template).not.toBeNull();
    expect(viewModel?.template?.localTemplateIds).toEqual(
      expect.arrayContaining(['control-over-main', 'aux-under-main'])
    );
    expect(viewModel?.template?.featureHighlights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'topControlCount' }),
        expect.objectContaining({ key: 'bottomAuxCount' }),
      ])
    );
    expect(viewModel?.relationRoleChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'r2',
          before: '未标注',
          after: 'control',
        }),
      ])
    );
    expect(viewModel?.moduleRoleChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Control Main',
          before: 'control_stage',
          after: 'core_stage',
        }),
        expect.objectContaining({
          label: 'Main Aux',
          before: 'auxiliary_stage',
          after: 'core_stage',
        }),
      ])
    );
  });

  it('returns extraction-only summaries before analysis is ready', () => {
    const extraction: ExtractionResult = {
      entities: [{ id: 'e1', label: 'Input' }],
      relations: [],
      modules: [],
    };

    const viewModel = buildPaperDrawDebugViewModel(extraction, null);

    expect(viewModel?.extraction?.entityCount).toBe(1);
    expect(viewModel?.analysis).toBeNull();
    expect(viewModel?.intent).toBeNull();
    expect(viewModel?.template).toBeNull();
  });
});
