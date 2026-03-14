import { useMemo } from 'react';
import type { AnalysisResult, ExtractionResult } from '../types/analyzer';
import { buildPaperDrawDebugViewModel } from '../debug/build-paperdraw-debug-view-model';

interface PaperDrawDebugPanelProps {
  extraction: ExtractionResult | null;
  analysis: AnalysisResult | null;
}

export const PaperDrawDebugPanel = ({
  extraction,
  analysis,
}: PaperDrawDebugPanelProps) => {
  const viewModel = useMemo(
    () => buildPaperDrawDebugViewModel(extraction, analysis),
    [analysis, extraction]
  );

  if (!viewModel) {
    return null;
  }

  return (
    <details className="paperdraw-debug-panel">
      <summary className="paperdraw-debug-summary">
        <span>开发态调试视图</span>
        <span className="paperdraw-debug-summary-meta">
          {analysis ? 'extraction / analysis / intent' : 'extraction'}
        </span>
      </summary>

      <div className="paperdraw-debug-grid">
        {viewModel.extraction ? (
          <section className="paperdraw-debug-card">
            <h4>Extraction</h4>
            <p>
              实体 {viewModel.extraction.entityCount} / 关系 {viewModel.extraction.relationCount} /
              模块 {viewModel.extraction.moduleCount}
            </p>
            <p>主干长度 {viewModel.extraction.spineLength}</p>
            <div className="paperdraw-debug-chip-list">
              {viewModel.extraction.entityRoles.map((item) => (
                <span key={`extraction-entity-${item.role}`} className="paperdraw-debug-chip">
                  {item.role}: {item.count}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {viewModel.analysis ? (
          <section className="paperdraw-debug-card">
            <h4>Analysis</h4>
            <p>
              实体 {viewModel.analysis.entityCount} / 关系 {viewModel.analysis.relationCount} /
              模块 {viewModel.analysis.moduleCount}
            </p>
            <p>
              主干长度 {viewModel.analysis.spineLength} / warnings {viewModel.analysis.warningCount}
            </p>
            <div className="paperdraw-debug-chip-list">
              {viewModel.analysis.moduleRoles.map((item) => (
                <span key={`analysis-module-${item.role}`} className="paperdraw-debug-chip">
                  {item.role}: {item.count}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {viewModel.intent ? (
          <section className="paperdraw-debug-card">
            <h4>Intent</h4>
            <p>主干: {viewModel.intent.dominantSpine.join(' -> ') || '无'}</p>
            <p>
              分支 {viewModel.intent.branchRoots.length} / 汇聚 {viewModel.intent.mergeNodes.length} /
              反馈 {viewModel.intent.feedbackEdges.length}
            </p>
            <div className="paperdraw-debug-chip-list">
              {viewModel.intent.layoutHints.map((hint) => (
                <span key={hint} className="paperdraw-debug-chip">
                  {hint}
                </span>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {viewModel.template ? (
        <section className="paperdraw-debug-card">
          <h4>Template</h4>
          <p>Root: {viewModel.template.rootTemplateId}</p>
          <div className="paperdraw-debug-chip-list">
            {viewModel.template.localTemplateIds.map((templateId) => (
              <span key={templateId} className="paperdraw-debug-chip">
                {templateId}
              </span>
            ))}
          </div>
          <div className="paperdraw-debug-metric-list">
            {viewModel.template.featureHighlights.map((feature) => (
              <span key={feature.key} className="paperdraw-debug-metric">
                {feature.label}: {Number.isInteger(feature.value) ? feature.value : feature.value.toFixed(2)}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <div className="paperdraw-debug-grid">
        <section className="paperdraw-debug-card">
          <h4>实体角色变化</h4>
          {viewModel.entityRoleChanges.length ? (
            <ul className="paperdraw-debug-list">
              {viewModel.entityRoleChanges.map((item) => (
                <li key={`entity-${item.id}`}>
                  {item.label}: {item.before} {'->'} {item.after}
                </li>
              ))}
            </ul>
          ) : (
            <p className="paperdraw-debug-empty">暂无变化</p>
          )}
        </section>

        <section className="paperdraw-debug-card">
          <h4>关系角色变化</h4>
          {viewModel.relationRoleChanges.length ? (
            <ul className="paperdraw-debug-list">
              {viewModel.relationRoleChanges.map((item) => (
                <li key={`relation-${item.id}`}>
                  {item.label}: {item.before} {'->'} {item.after}
                </li>
              ))}
            </ul>
          ) : (
            <p className="paperdraw-debug-empty">暂无变化</p>
          )}
        </section>

        <section className="paperdraw-debug-card">
          <h4>模块角色变化</h4>
          {viewModel.moduleRoleChanges.length ? (
            <ul className="paperdraw-debug-list">
              {viewModel.moduleRoleChanges.map((item) => (
                <li key={`module-${item.id}-${item.label}`}>
                  {item.label}: {item.before} {'->'} {item.after}
                </li>
              ))}
            </ul>
          ) : (
            <p className="paperdraw-debug-empty">暂无变化</p>
          )}
        </section>
      </div>
    </details>
  );
};
