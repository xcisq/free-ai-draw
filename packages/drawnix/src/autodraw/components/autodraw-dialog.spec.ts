import {
  buildAutodrawAssetShelfItems,
  buildAssemblyBatches,
  createAutodrawJobHistoryId,
  getAutodrawAssetShelfAssets,
  getAutodrawSpotlightAsset,
  getAutodrawVisibleAssetItems,
  getEffectiveWorkbenchStep,
  getWorkbenchProgressRatio,
  getWorkbenchStepForStatus,
  mergeAutodrawArtifacts,
  orderAutodrawHistoryEntries,
  toAutodrawAssetItems,
  upsertAutodrawHistory,
} from './autodraw-dialog.utils';

describe('autodraw-dialog helpers', () => {
  it('maps backend and frontend status into workbench steps', () => {
    expect(getWorkbenchStepForStatus('idle', null, null)).toBe(0);
    expect(getWorkbenchStepForStatus('running', 1, null)).toBe(0);
    expect(getWorkbenchStepForStatus('running', 2, null)).toBe(1);
    expect(getWorkbenchStepForStatus('running', 3, null)).toBe(2);
    expect(getWorkbenchStepForStatus('running', 5, null)).toBe(3);
    expect(getWorkbenchStepForStatus('cancelling', 3, null)).toBe(2);
    expect(getWorkbenchStepForStatus('importing', 5, null)).toBe(4);
    expect(getWorkbenchStepForStatus('failed', 3, 4)).toBe(3);
    expect(getWorkbenchStepForStatus('cancelled', 3, 4)).toBe(3);
  });

  it('preserves source order when building assembly batches', () => {
    const elements = [
      {
        id: 'image-1',
        type: 'image',
        points: [
          [20, 0],
          [40, 20],
        ],
      },
      {
        id: 'text-1',
        type: 'shape',
        shape: 'text',
        text: [{ text: 'label' }],
        textStyle: { fontSize: 14 },
        points: [
          [40, 10],
          [80, 30],
        ],
      },
      {
        id: 'shape-1',
        type: 'shape',
        shape: 'rectangle',
        points: [
          [0, 0],
          [20, 20],
        ],
      },
      {
        id: 'arrow-1',
        type: 'arrow-line',
        points: [
          [30, 5],
          [60, 35],
        ],
      },
    ] as any[];

    const batches = buildAssemblyBatches(elements as any);

    expect(batches).toHaveLength(4);
    expect(batches.flat().map((element) => element.id)).toEqual([
      'image-1',
      'text-1',
      'shape-1',
      'arrow-1',
    ]);
  });

  it('keeps only visual assets in the asset room and prefers the active stage spotlight', () => {
    const assets = toAutodrawAssetItems(
      [
        {
          name: 'icon_AF01_nobg.png',
          path: 'icons/icon_AF01_nobg.png',
          kind: 'icon',
          size_bytes: 100,
          download_url: '/api/jobs/job-1/artifacts/icons/icon_AF01_nobg.png',
        },
        {
          name: 'final.svg',
          path: 'final.svg',
          kind: 'final_svg',
          size_bytes: 200,
          download_url: '/api/jobs/job-1/artifacts/final.svg',
        },
        {
          name: 'scene.json',
          path: 'scene.json',
          kind: 'scene_json',
          size_bytes: 80,
          download_url: '/api/jobs/job-1/artifacts/scene.json',
        },
        {
          name: 'figure.png',
          path: 'figure.png',
          kind: 'figure',
          size_bytes: 300,
          download_url: '/api/jobs/job-1/artifacts/figure.png',
        },
      ],
      'http://127.0.0.1:8001/'
    );

    expect(assets.map((asset) => asset.name)).toEqual([
      'figure.png',
      'icon_AF01_nobg.png',
      'final.svg',
      'scene.json',
    ]);
    expect(
      getAutodrawVisibleAssetItems(assets).map((asset) => asset.name)
    ).toEqual(['figure.png', 'icon_AF01_nobg.png', 'final.svg']);
    expect(
      getAutodrawAssetShelfAssets(assets).map((asset) => asset.name)
    ).toEqual(['figure.png', 'icon_AF01_nobg.png', 'final.svg']);
    expect(
      getAutodrawSpotlightAsset(assets, {
        preferredStep: 2,
        strictStep: true,
      })?.name
    ).toBe('icon_AF01_nobg.png');
    expect(getAutodrawSpotlightAsset(assets)?.url).toBe(
      'http://127.0.0.1:8001/api/jobs/job-1/artifacts/final.svg'
    );
  });

  it('prefers nobg icon assets in the asset room and removes duplicated icon crops', () => {
    const assets = toAutodrawAssetItems(
      [
        {
          name: 'icon_AF01.png',
          path: 'icons/icon_AF01.png',
          kind: 'icon',
          size_bytes: 90,
          download_url: '/api/jobs/job-1/artifacts/icons/icon_AF01.png',
        },
        {
          name: 'icon_AF01_nobg.png',
          path: 'icons/icon_AF01_nobg.png',
          kind: 'icon',
          size_bytes: 100,
          download_url: '/api/jobs/job-1/artifacts/icons/icon_AF01_nobg.png',
        },
        {
          name: 'icon_AF02_nobg.png',
          path: 'icons/icon_AF02_nobg.png',
          kind: 'icon',
          size_bytes: 110,
          download_url: '/api/jobs/job-1/artifacts/icons/icon_AF02_nobg.png',
        },
        {
          name: 'final.svg',
          path: 'final.svg',
          kind: 'final_svg',
          size_bytes: 200,
          download_url: '/api/jobs/job-1/artifacts/final.svg',
        },
      ],
      'http://127.0.0.1:8001/'
    );

    const shelf = buildAutodrawAssetShelfItems({
      assets,
      activeStep: 2,
      isBusy: false,
      stageLabels: [
        '生成原始图',
        '解析结构',
        '提取图标',
        '重建 SVG',
        '导入画板',
      ],
    });

    expect(shelf.map((item) => item.title)).toEqual([
      'icon_AF01_nobg.png',
      'icon_AF02_nobg.png',
      'final.svg',
    ]);
    expect(
      shelf.map((item) => item.asset?.kind || item.kind)
    ).toEqual(['icon', 'icon', 'final_svg']);
  });

  it('lets logs and artifacts correct the effective workbench step', () => {
    const assets = toAutodrawAssetItems(
      [
        {
          name: 'icon_AF01_nobg.png',
          path: 'icons/icon_AF01_nobg.png',
          kind: 'icon',
          size_bytes: 100,
          download_url: '/api/jobs/job-2/artifacts/icons/icon_AF01_nobg.png',
        },
      ],
      'http://127.0.0.1:8001/'
    );

    expect(
      getEffectiveWorkbenchStep({
        status: 'running',
        currentStage: 1,
        failedStage: null,
        logs: ['步骤三：提取图标并整理资产'],
        assets,
      })
    ).toBe(2);
    expect(
      getEffectiveWorkbenchStep({
        status: 'importing',
        currentStage: 4,
        failedStage: null,
        logs: ['[scene-import] fallback to svg-import'],
        assets,
        hasImportedPreview: true,
      })
    ).toBe(4);
  });

  it('builds a live asset shelf with placeholders before real assets arrive', () => {
    const assets = toAutodrawAssetItems(
      [
        {
          name: 'figure.png',
          path: 'figure.png',
          kind: 'figure',
          size_bytes: 300,
          download_url: '/api/jobs/job-2/artifacts/figure.png',
        },
      ],
      'http://127.0.0.1:8001/'
    );

    const shelf = buildAutodrawAssetShelfItems({
      assets,
      activeStep: 2,
      isBusy: true,
      stageLabels: [
        '生成原始图',
        '解析结构',
        '提取图标',
        '重建 SVG',
        '导入画板',
      ],
    });

    expect(shelf.map((item) => item.title)).toEqual([
      'figure.png',
      'icons/*_nobg.png',
    ]);
    expect(shelf.filter((item) => item.isPlaceholder)).toHaveLength(1);
  });

  it('upserts history entries and keeps the newest item first', () => {
    const entries = upsertAutodrawHistory(
      [
        {
          id: 'job-1',
          type: 'job',
          title: 'job-1',
          subtitle: 'Generated job',
          status: 'running',
          createdAt: '2026-04-16T10:00:00.000Z',
        },
      ],
      {
        id: 'job-1',
        type: 'job',
        title: 'job-1',
        subtitle: 'Generated job',
        status: 'succeeded',
        createdAt: '2026-04-16T11:00:00.000Z',
      }
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe('succeeded');
    expect(entries[0].createdAt).toBe('2026-04-16T11:00:00.000Z');
  });

  it('uses stable job ids for history dedupe and keeps the current run pinned first', () => {
    const dedupedEntries = upsertAutodrawHistory(
      [
        {
          id: createAutodrawJobHistoryId('job-current'),
          type: 'job',
          title: 'job-current',
          subtitle: 'Generated job',
          status: 'running',
          createdAt: '2026-04-18T09:00:00.000Z',
          updatedAt: '2026-04-18T09:00:00.000Z',
          jobId: 'job-current',
        },
        {
          id: 'bundle:bundle.zip:1',
          type: 'bundle',
          title: 'bundle.zip',
          subtitle: 'Local ZIP',
          status: 'local',
          createdAt: '2026-04-18T08:00:00.000Z',
          updatedAt: '2026-04-18T08:00:00.000Z',
        },
      ],
      {
        id: 'job:job-current:legacy',
        type: 'job',
        title: 'job-current',
        subtitle: 'Generated job',
        status: 'succeeded',
        createdAt: '2026-04-18T09:00:00.000Z',
        updatedAt: '2026-04-18T11:00:00.000Z',
        jobId: 'job-current',
      }
    );

    expect(
      dedupedEntries.filter((entry) => entry.jobId === 'job-current')
    ).toHaveLength(1);
    expect(dedupedEntries[0]).toEqual(
      expect.objectContaining({
        id: createAutodrawJobHistoryId('job-current'),
        status: 'succeeded',
        updatedAt: '2026-04-18T11:00:00.000Z',
      })
    );

    const orderedEntries = orderAutodrawHistoryEntries(
      [
        ...dedupedEntries,
        {
          id: createAutodrawJobHistoryId('job-older'),
          type: 'job',
          title: 'job-older',
          subtitle: 'Generated job',
          status: 'succeeded',
          createdAt: '2026-04-18T10:00:00.000Z',
          updatedAt: '2026-04-18T10:00:00.000Z',
          jobId: 'job-older',
        },
      ],
      'job-current',
      12
    );

    expect(orderedEntries.map((entry) => entry.id)).toEqual([
      createAutodrawJobHistoryId('job-current'),
      createAutodrawJobHistoryId('job-older'),
      'bundle:bundle.zip:1',
    ]);
  });

  it('merges probed artifacts without duplicating persisted ones', () => {
    const merged = mergeAutodrawArtifacts(
      [
        {
          name: 'figure.png',
          path: 'figure.png',
          kind: 'figure',
          size_bytes: 120,
          download_url: '/api/jobs/job-3/artifacts/figure.png',
        },
      ],
      [
        {
          name: 'figure.png',
          path: 'figure.png',
          kind: 'figure',
          size_bytes: 0,
          download_url: '/api/jobs/job-3/artifacts/figure.png',
        },
        {
          name: 'samed.png',
          path: 'samed.png',
          kind: 'samed',
          size_bytes: 0,
          download_url: '/api/jobs/job-3/artifacts/samed.png',
        },
      ]
    );

    expect(merged).toHaveLength(2);
    expect(
      merged.find((artifact) => artifact.path === 'figure.png')?.size_bytes
    ).toBe(120);
  });

  it('computes a smoother workbench progress ratio for busy states', () => {
    expect(getWorkbenchProgressRatio('idle', null, null)).toBe(0.04);
    expect(getWorkbenchProgressRatio('queued', 1, null)).toBe(0.12);
    expect(getWorkbenchProgressRatio('running', 3, null)).toBeGreaterThan(0.5);
    expect(getWorkbenchProgressRatio('importing', 5, null)).toBe(0.96);
    expect(getWorkbenchProgressRatio('succeeded', 5, null)).toBe(1);
  });
});
