import { PlaitBoard, PlaitElement } from '@plait/core';

type AssemblyCandidate = {
  type?: string;
  shape?: string;
  text?: unknown;
  textStyle?: unknown;
};

export type BoardAssemblyProgress = {
  active: boolean;
  phase: 'idle' | 'preparing' | 'assembling';
  fileName: string;
  totalBatches: number;
  completedBatches: number;
  insertedCount: number;
};

export const initialBoardAssemblyProgress: BoardAssemblyProgress = {
  active: false,
  phase: 'idle',
  fileName: '',
  totalBatches: 0,
  completedBatches: 0,
  insertedCount: 0,
};

const BOARD_ASSEMBLY_LEAD_IN_DELAY =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'test' ? 0 : 160;
const BOARD_ASSEMBLY_ENTER_BASE_DURATION = 280;

const wait = (duration: number) =>
  new Promise<void>((resolve) => {
    const effectiveDuration =
      typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
        ? Math.min(duration, 12)
        : duration;
    window.setTimeout(() => resolve(), effectiveDuration);
  });

const cloneElements = <T extends PlaitElement>(elements: T[]) =>
  JSON.parse(JSON.stringify(elements)) as T[];

export const buildBoardImportBatches = <T extends AssemblyCandidate>(
  elements: T[]
) => {
  if (!elements.length) {
    return [];
  }

  const chunkSize =
    elements.length <= 8
      ? 1
      : elements.length <= 24
        ? 4
        : elements.length <= 60
          ? 8
          : Math.min(24, Math.max(10, Math.ceil(elements.length / 6)));

  const batches: T[][] = [];
  for (let index = 0; index < elements.length; index += chunkSize) {
    const nextBatch = elements.slice(index, index + chunkSize);
    if (nextBatch.length) {
      batches.push(nextBatch);
    }
  }
  return batches;
};

export const getAssemblyBatchDelay = (
  batch: PlaitElement[],
  index: number,
  totalBatches: number
) => {
  const hasText = batch.some((element) => {
    const candidate = element as AssemblyCandidate;
    return (
      candidate.shape === 'text' ||
      Boolean(candidate.text && candidate.textStyle)
    );
  });
  const hasArrow = batch.some(
    (element) => (element as { type?: string }).type === 'arrow-line'
  );
  const hasImage = batch.some(
    (element) => (element as { type?: string }).type === 'image'
  );

  let delay = 120;
  if (hasText) {
    delay = 160;
  } else if (hasArrow) {
    delay = 130;
  } else if (hasImage) {
    delay = 140;
  }

  delay += Math.min(70, Math.max(0, batch.length - 1) * 12);

  if (index === 0) {
    delay += 40;
  }
  if (index === totalBatches - 2) {
    delay += 28;
  }

  return delay;
};

const getAssemblyBatchEnterProfile = (batch: PlaitElement[]) => {
  const hasText = batch.some((element) => {
    const candidate = element as AssemblyCandidate;
    return (
      candidate.shape === 'text' ||
      Boolean(candidate.text && candidate.textStyle)
    );
  });
  const hasArrow = batch.some(
    (element) => (element as { type?: string }).type === 'arrow-line'
  );
  const hasImage = batch.some(
    (element) => (element as { type?: string }).type === 'image'
  );

  if (hasText) {
    return {
      translateY: 10,
      scale: 0.994,
      duration: BOARD_ASSEMBLY_ENTER_BASE_DURATION,
      stagger: 18,
    };
  }

  if (hasArrow) {
    return {
      translateY: 12,
      scale: 0.99,
      duration: BOARD_ASSEMBLY_ENTER_BASE_DURATION + 18,
      stagger: 18,
    };
  }

  if (hasImage) {
    return {
      translateY: 14,
      scale: 0.988,
      duration: BOARD_ASSEMBLY_ENTER_BASE_DURATION + 26,
      stagger: 20,
    };
  }

  return {
    translateY: 16,
    scale: 0.984,
    duration: BOARD_ASSEMBLY_ENTER_BASE_DURATION + 34,
    stagger: 22,
  };
};

export const playBoardBatchEnterAnimation = (
  batchElements: PlaitElement[],
  batchIndex: number
) => {
  if (
    typeof window === 'undefined' ||
    typeof window.requestAnimationFrame !== 'function' ||
    typeof PlaitElement.getElementG !== 'function'
  ) {
    return;
  }

  const resolveTargets = () =>
    batchElements.flatMap((element) => {
      try {
        const target = PlaitElement.getElementG(element);
        return target ? [target] : [];
      } catch {
        return [];
      }
    });

  const profile = getAssemblyBatchEnterProfile(batchElements);
  const initialTranslateY =
    batchIndex === 0 ? profile.translateY + 4 : profile.translateY;

  const startAnimation = (targets: SVGGElement[]) => {
    targets.forEach((target) => {
      target.style.transition = 'none';
      target.style.opacity = '0';
      target.style.transformBox = 'fill-box';
      target.style.transformOrigin = 'center';
      target.style.transform = `translateY(${initialTranslateY}px) scale(${profile.scale})`;
      target.style.willChange = 'transform, opacity';
    });

    window.requestAnimationFrame(() => {
      targets.forEach((target, index) => {
        const enterDelay = index * profile.stagger;
        window.setTimeout(() => {
          target.style.transition = [
            `transform ${profile.duration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
            `opacity ${Math.max(
              180,
              profile.duration - 24
            )}ms cubic-bezier(0.2, 0, 0, 1)`,
          ].join(', ');
          target.style.opacity = '1';
          target.style.transform = 'translateY(0) scale(1)';
        }, enterDelay);

        window.setTimeout(() => {
          target.style.willChange = '';
        }, enterDelay + profile.duration + 60);
      });
    });
  };

  const immediateTargets = resolveTargets();
  if (immediateTargets.length) {
    startAnimation(immediateTargets);
    return;
  }

  window.requestAnimationFrame(() => {
    const deferredTargets = resolveTargets();
    if (deferredTargets.length) {
      startAnimation(deferredTargets);
    }
  });
};

export const loadBoardElementsWithAssembly = async ({
  board,
  parentG,
  listRender,
  elements,
  fileName,
  onProgress,
}: {
  board: PlaitBoard;
  parentG: SVGGElement;
  listRender: {
    update: (
      elements: PlaitElement[],
      context: {
        board: PlaitBoard;
        parent: PlaitBoard;
        parentG: SVGGElement;
      }
    ) => void;
  };
  elements: PlaitElement[];
  fileName: string;
  onProgress?: (progress: BoardAssemblyProgress) => void;
}) => {
  const render = (value: PlaitElement[]) => {
    listRender.update(value, {
      board,
      parent: board,
      parentG,
    });
  };
  const publish = (progress: BoardAssemblyProgress) => {
    onProgress?.(progress);
  };

  if (!elements.length) {
    board.children = [];
    render(board.children);
    publish({
      ...initialBoardAssemblyProgress,
      fileName,
    });
    return;
  }

  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const batches = buildBoardImportBatches(elements);

  board.children = [];
  render(board.children);

  if (reducedMotion || elements.length <= 2 || batches.length <= 1) {
    const clonedElements = cloneElements(elements);
    board.children = clonedElements;
    render(board.children);
    publish({
      active: false,
      phase: 'assembling',
      fileName,
      totalBatches: 1,
      completedBatches: 1,
      insertedCount: clonedElements.length,
    });
    return;
  }

  publish({
    active: true,
    phase: 'assembling',
    fileName,
    totalBatches: batches.length,
    completedBatches: 0,
    insertedCount: 0,
  });

  await wait(BOARD_ASSEMBLY_LEAD_IN_DELAY);

  const appendedElements: PlaitElement[] = [];
  for (let index = 0; index < batches.length; index += 1) {
    const clonedBatch = cloneElements(batches[index] as PlaitElement[]);
    appendedElements.push(...clonedBatch);
    board.children = [...appendedElements];
    render(board.children);
    playBoardBatchEnterAnimation(clonedBatch, index);
    publish({
      active: index < batches.length - 1,
      phase: 'assembling',
      fileName,
      totalBatches: batches.length,
      completedBatches: index + 1,
      insertedCount: appendedElements.length,
    });

    if (index < batches.length - 1) {
      await wait(getAssemblyBatchDelay(clonedBatch, index, batches.length));
    }
  }
};
