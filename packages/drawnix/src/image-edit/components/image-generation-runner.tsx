import { useEffect, useRef } from 'react';
import { PlaitBoard } from '@plait/core';
import { useDrawnix } from '../../hooks/use-drawnix';
import { findImageElementById, replaceImageElementUrl } from '../../utils/image-element';
import {
  JobResponse,
  blobToDataUrl,
  readErrorMessage,
  resolveEditedArtifact,
} from '../utils';

const IMAGE_EDIT_POLL_INTERVAL = 1200;

type ImageGenerationRunnerProps = {
  board: PlaitBoard | null;
};

export const ImageGenerationRunner = ({ board }: ImageGenerationRunnerProps) => {
  const { appState, setAppState } = useDrawnix();
  const boardRef = useRef(board);
  const appStateRef = useRef(appState);
  const isPollingRef = useRef(false);

  boardRef.current = board;
  appStateRef.current = appState;

  useEffect(() => {
    if (!board) {
      return;
    }

    let cancelled = false;
    const tick = async () => {
      if (cancelled || isPollingRef.current) {
        return;
      }
      const currentTasks = appStateRef.current.imageGenerationTasks;
      const taskEntries = Object.entries(currentTasks);
      if (!taskEntries.length) {
        return;
      }

      isPollingRef.current = true;
      let nextTasks = currentTasks;
      let hasChanged = false;

      try {
        for (const [targetId, task] of taskEntries) {
          const currentBoard = boardRef.current;
          if (!currentBoard) {
            break;
          }
          try {
            const response = await fetch(
              `${task.backendUrl}/api/jobs/${task.jobId.trim()}`
            );
            if (!response.ok) {
              continue;
            }
            const data = (await response.json()) as JobResponse;
            if (data.status === 'queued' || data.status === 'running') {
              continue;
            }

            if (nextTasks === currentTasks) {
              nextTasks = { ...currentTasks };
            }

            if (data.status === 'failed') {
              delete nextTasks[targetId];
              hasChanged = true;
              continue;
            }

            if (!findImageElementById(currentBoard, targetId)) {
              delete nextTasks[targetId];
              hasChanged = true;
              continue;
            }

            const artifact = resolveEditedArtifact(data.artifacts || []);
            if (!artifact) {
              delete nextTasks[targetId];
              hasChanged = true;
              continue;
            }

            const imageResponse = await fetch(
              `${task.backendUrl}${artifact.download_url}`
            );
            if (!imageResponse.ok) {
              throw new Error(
                await readErrorMessage(imageResponse, '生成结果下载失败')
              );
            }
            const imageBlob = await imageResponse.blob();
            const imageDataUrl = await blobToDataUrl(imageBlob);
            replaceImageElementUrl(currentBoard, targetId, imageDataUrl);
            delete nextTasks[targetId];
            hasChanged = true;
          } catch {
            continue;
          }
        }
      } finally {
        isPollingRef.current = false;
      }

      if (hasChanged && !cancelled) {
        const currentState = appStateRef.current;
        setAppState({
          ...currentState,
          imageGenerationTasks: nextTasks,
        });
      }
    };

    const intervalId = window.setInterval(() => {
      void tick();
    }, IMAGE_EDIT_POLL_INTERVAL);

    void tick();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [board, setAppState]);

  return null;
};
