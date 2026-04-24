import { lazy, Suspense } from 'react';
import { Dialog, DialogContent } from '../dialog/dialog';
import MermaidToDrawnix from './mermaid-to-drawnix';
import { DialogType, useDrawnix } from '../../hooks/use-drawnix';
import MarkdownToDrawnix from './markdown-to-drawnix';
import ImageEditDialog from '../../image-edit/components/image-edit-dialog';

const LLMMermaidDialog = lazy(
  () => import('../../llm-mermaid/components/llm-mermaid-dialog')
);
const AutodrawDialog = lazy(
  () => import('../../autodraw/components/autodraw-dialog')
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
        open={appState.openDialogType === DialogType.autodraw}
        onOpenChange={(open) => {
          setAppState({
            ...appState,
            openDialogType: open ? DialogType.autodraw : null,
          });
        }}
      >
        <DialogContent
          className="Dialog ttd-dialog autodraw-dialog-modal"
          container={container}
        >
          <Suspense fallback={<div style={{ padding: 16 }}>Loading...</div>}>
            <AutodrawDialog />
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
        <DialogContent
          className="Dialog ttd-dialog llm-mermaid-dialog"
          container={container}
        >
          <Suspense fallback={<div style={{ padding: 16 }}>Loading...</div>}>
            <LLMMermaidDialog container={container} />
          </Suspense>
        </DialogContent>
      </Dialog>
      <Dialog
        open={appState.openDialogType === DialogType.imageEdit}
        onOpenChange={(open) => {
          setAppState({
            ...appState,
            imageEditTargetId: open ? appState.imageEditTargetId : null,
            openDialogType: open ? DialogType.imageEdit : null,
          });
        }}
      >
        <DialogContent
          className="Dialog ttd-dialog image-edit-dialog-modal"
          container={container}
        >
          <ImageEditDialog />
        </DialogContent>
      </Dialog>
    </>
  );
};
