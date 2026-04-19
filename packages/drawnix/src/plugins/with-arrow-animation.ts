import { PlaitBoard } from '@plait/core';
import {
  ArrowLineComponent,
  PlaitDrawElement,
} from '@plait/draw';
import type { PlaitPluginElementContext } from '@plait/core';
import type { PlaitArrowLine } from '@plait/draw';

export const DRAWNIX_ARROW_ANIMATION_FLOW = 'flow' as const;

export type DrawnixArrowAnimation = typeof DRAWNIX_ARROW_ANIMATION_FLOW;

export type DrawnixAnimatedArrowLine = PlaitArrowLine & {
  drawnixArrowAnimation?: DrawnixArrowAnimation;
};

const ARROW_ANIMATION_OVERLAY_CLASS = 'drawnix-arrow-line__animation-overlay';
const ARROW_ANIMATION_OVERLAY_PATH_CLASS =
  'drawnix-arrow-line__animation-overlay-path';
const ARROW_ANIMATION_OVERLAY_HEAD_CLASS =
  'drawnix-arrow-line__animation-overlay-head';
const ARROW_ANIMATION_BASE_CLASS = 'drawnix-arrow-line--animated';
const ARROW_ANIMATION_BASE_PATH_CLASS = 'drawnix-arrow-line__base-path';
const ARROW_ANIMATION_BASE_HEAD_CLASS = 'drawnix-arrow-line__base-head';

export const isArrowAnimationEnabled = (
  element?: Partial<DrawnixAnimatedArrowLine> | null
) => {
  return element?.drawnixArrowAnimation === DRAWNIX_ARROW_ANIMATION_FLOW;
};

class DrawnixArrowLineComponent extends ArrowLineComponent {
  override initialize() {
    super.initialize();
    this.syncAnimation();
  }

  override onContextChanged(
    value: PlaitPluginElementContext<PlaitArrowLine, PlaitBoard>,
    previous: PlaitPluginElementContext<PlaitArrowLine, PlaitBoard>
  ) {
    super.onContextChanged(value, previous);
    this.syncAnimation();
  }

  private syncAnimation() {
    const elementGroup = this.getElementG();
    const currentOverlay = elementGroup.querySelector<SVGGElement>(
      `.${ARROW_ANIMATION_OVERLAY_CLASS}`
    );
    currentOverlay?.remove();

    const primaryLineGroup = elementGroup.firstElementChild;
    if (!(primaryLineGroup instanceof SVGGElement)) {
      return;
    }

    primaryLineGroup.classList.remove(ARROW_ANIMATION_BASE_CLASS);
    primaryLineGroup
      .querySelectorAll(`.${ARROW_ANIMATION_BASE_PATH_CLASS}`)
      .forEach((path) => path.classList.remove(ARROW_ANIMATION_BASE_PATH_CLASS));
    primaryLineGroup
      .querySelectorAll(`.${ARROW_ANIMATION_BASE_HEAD_CLASS}`)
      .forEach((path) => path.classList.remove(ARROW_ANIMATION_BASE_HEAD_CLASS));

    if (!isArrowAnimationEnabled(this.element as DrawnixAnimatedArrowLine)) {
      return;
    }

    const overlayGroup = primaryLineGroup.cloneNode(true) as SVGGElement;
    overlayGroup.classList.add(ARROW_ANIMATION_OVERLAY_CLASS);
    const overlayPaths = overlayGroup.querySelectorAll('path');
    overlayPaths.forEach((path, index) => {
      if (index === 0) {
        path.classList.add(ARROW_ANIMATION_OVERLAY_PATH_CLASS);
        return;
      }
      path.classList.add(ARROW_ANIMATION_OVERLAY_HEAD_CLASS);
    });

    const primaryPaths = primaryLineGroup.querySelectorAll('path');
    primaryLineGroup.classList.add(ARROW_ANIMATION_BASE_CLASS);
    primaryPaths.forEach((path, index) => {
      if (index === 0) {
        path.classList.add(ARROW_ANIMATION_BASE_PATH_CLASS);
        return;
      }
      path.classList.add(ARROW_ANIMATION_BASE_HEAD_CLASS);
    });

    const insertBeforeTarget = elementGroup.children[1] ?? null;
    elementGroup.insertBefore(overlayGroup, insertBeforeTarget);
  }
}

export const withArrowAnimation = (board: PlaitBoard) => {
  const { drawElement } = board;

  board.drawElement = (context) => {
    if (PlaitDrawElement.isArrowLine(context.element)) {
      return DrawnixArrowLineComponent;
    }
    return drawElement(context);
  };

  return board;
};
