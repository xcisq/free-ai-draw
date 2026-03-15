import { lazy, Suspense } from 'react';
import { Dialog, DialogContent } from '../dialog/dialog';
import MermaidToDrawnix from './mermaid-to-drawnix';
import { DialogType, useDrawnix } from '../../hooks/use-drawnix';
import MarkdownToDrawnix from './markdown-to-drawnix';

const PaperDrawDialog = lazy(
  () => import('../../paperdraw/components/paperdraw-dialog')
);

const LLMMermaidDialog = lazy(
  () => import('../../llm-mermaid/components/llm-mermaid-dialog')
);

export const TTDDialog = ({ container }: { container: HTMLElement | null }) => {
  const { appState, setAppState } = useDrawnix();
  return (
    <>
      <Dialog
        open={appState.openDialogType === DialogType.mermaidToDrawnix}
        onOpenChange={(open) => {
          setAppState({
            ...appState,
            openDialogType: open ? DialogType.mermaidToDrawnix : null,
          });
        }}
      >
        <DialogContent className="Dialog ttd-dialog" container={container}>
          <MermaidToDrawnix></MermaidToDrawnix>
        </DialogContent>
      </Dialog>
      <Dialog
        open={appState.openDialogType === DialogType.markdownToDrawnix}
        onOpenChange={(open) => {
          setAppState({
            ...appState,
            openDialogType: open ? DialogType.markdownToDrawnix : null,
          });
        }}
      >
        <DialogContent className="Dialog ttd-dialog" container={container}>
          <MarkdownToDrawnix></MarkdownToDrawnix>
        </DialogContent>
      </Dialog>
      <Dialog
        open={appState.openDialogType === DialogType.paperdrawToFlowchart}
        onOpenChange={(open) => {
          setAppState({
            ...appState,
            openDialogType: open ? DialogType.paperdrawToFlowchart : null,
          });
        }}
      >
        <DialogContent className="Dialog ttd-dialog" container={container}>
          <Suspense fallback={<div style={{ padding: 16 }}>Loading...</div>}>
            <PaperDrawDialog />
          </Suspense>
        </DialogContent>
      </Dialog>
      <Dialog
        open={appState.openDialogType === DialogType.llmMermaid}
        onOpenChange={(open) => {
          setAppState({
            ...appState,
            openDialogType: open ? DialogType.llmMermaid : null,
          });
        }}
      >
        <DialogContent className="Dialog ttd-dialog llm-mermaid-dialog" container={container}>
          <Suspense fallback={<div style={{ padding: 16 }}>Loading...</div>}>
            <LLMMermaidDialog container={container} />
          </Suspense>
        </DialogContent>
      </Dialog>
    </>
  );
};
