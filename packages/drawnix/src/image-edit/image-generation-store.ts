import { useSyncExternalStore } from 'react';
import type { ImageGenerationTask, ImageGenerationTaskMap } from '../hooks/use-drawnix';

let snapshot: ImageGenerationTaskMap = {};
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

export const syncImageGenerationTasks = (nextTasks: ImageGenerationTaskMap) => {
  snapshot = nextTasks;
  emit();
};

export const resetImageGenerationTasks = () => {
  snapshot = {};
  emit();
};

export const subscribeImageGenerationTasks = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getImageGenerationTasksSnapshot = () => snapshot;

export const useImageGenerationTask = (targetId: string | null): ImageGenerationTask | null => {
  return useSyncExternalStore(subscribeImageGenerationTasks, () => {
    if (!targetId) {
      return null;
    }
    return snapshot[targetId] || null;
  });
};
