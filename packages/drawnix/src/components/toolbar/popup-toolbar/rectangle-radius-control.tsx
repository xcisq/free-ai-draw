import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MERGING, PlaitBoard, PlaitHistoryBoard } from '@plait/core';
import { setRectangleCornerRadius } from '../../../transforms/property';
import {
  FontSizeStepperDownIcon,
  FontSizeStepperUpIcon,
  RoundRectangleIcon,
} from '../../icons';
import { Island } from '../../island';
import { Popover, PopoverContent, PopoverTrigger } from '../../popover/popover';
import { SizeSlider } from '../../size-slider';

export type PopupRectangleRadiusControlProps = {
  board: PlaitBoard;
  currentRadius?: number;
  maxRadius: number;
  title: string;
};

const clampRadius = (value: number, maxRadius: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(maxRadius, 0), Math.max(0, value));
};

export const PopupRectangleRadiusControl: React.FC<
  PopupRectangleRadiusControlProps
> = ({ board, currentRadius, maxRadius, title }) => {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const normalizedMax = useMemo(() => {
    return Number.isFinite(maxRadius) && maxRadius > 0 ? maxRadius : 0;
  }, [maxRadius]);
  const normalizedCurrent = useMemo(() => {
    const base =
      typeof currentRadius === 'number' && Number.isFinite(currentRadius)
        ? currentRadius
        : 0;
    return clampRadius(base, normalizedMax);
  }, [currentRadius, normalizedMax]);
  const [draft, setDraft] = useState(String(normalizedCurrent));

  useEffect(() => {
    setDraft(String(normalizedCurrent));
  }, [normalizedCurrent]);

  const apply = (value: string) => {
    if (!value.trim()) {
      setDraft(String(normalizedCurrent));
      return;
    }
    const next = Number(value);
    if (!Number.isFinite(next)) {
      setDraft(String(normalizedCurrent));
      return;
    }
    const clamped = clampRadius(next, normalizedMax);
    const nextValue = String(clamped);
    setDraft(nextValue);
    setRectangleCornerRadius(board, clamped);
  };

  const getBaseValue = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) {
      return clampRadius(parsed, normalizedMax);
    }
    return normalizedCurrent;
  };

  const stepBy = (delta: number) => {
    const next = clampRadius(getBaseValue() + delta, normalizedMax);
    const value = String(next);
    setDraft(value);
    setRectangleCornerRadius(board, next);
  };

  const container = PlaitBoard.getBoardContainer(board);

  return (
    <Popover
      sideOffset={12}
      open={open}
      onOpenChange={setOpen}
      placement={'top'}
    >
      <PopoverTrigger asChild>
        <div
          className="popup-rectangle-radius"
          title={title}
          aria-label={title}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
        >
          <span className="popup-rectangle-radius__icon" aria-hidden="true">
            {RoundRectangleIcon}
          </span>
          <input
            ref={inputRef}
            className="popup-rectangle-radius__input"
            type="number"
            inputMode="numeric"
            min={0}
            max={normalizedMax}
            step={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => apply(event.target.value)}
            onPointerUp={(event) => {
              event.stopPropagation();
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                apply(draft);
              }
            }}
          />
          <div className="popup-rectangle-radius__stepper" aria-hidden="false">
            <button
              type="button"
              className="popup-rectangle-radius__stepper-button"
              aria-label={`${title} +`}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
                setOpen(true);
                stepBy(1);
                inputRef.current?.focus();
              }}
            >
              <FontSizeStepperUpIcon
                className="popup-rectangle-radius__stepper-icon"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              className="popup-rectangle-radius__stepper-button"
              aria-label={`${title} -`}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
                setOpen(true);
                stepBy(-1);
                inputRef.current?.focus();
              }}
            >
              <FontSizeStepperDownIcon
                className="popup-rectangle-radius__stepper-icon"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent
        container={container}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
        }}
      >
        <Island padding={4} className="popup-rectangle-radius-panel">
          <div className="popup-rectangle-radius-panel__header">
            <span className="popup-rectangle-radius-panel__title">{title}</span>
            <span className="popup-rectangle-radius-panel__value">
              {draft || '0'}
            </span>
          </div>
          <SizeSlider
            min={0}
            max={Math.max(1, normalizedMax)}
            step={1}
            defaultValue={normalizedCurrent}
            disabled={normalizedMax <= 0}
            title={title}
            onChange={(value) => {
              const next = clampRadius(value, normalizedMax);
              setDraft(String(next));
              setRectangleCornerRadius(board, next);
            }}
            beforeStart={() => {
              MERGING.set(board, true);
              PlaitHistoryBoard.setSplittingOnce(board, true);
            }}
            afterEnd={() => {
              MERGING.set(board, false);
            }}
          />
        </Island>
      </PopoverContent>
    </Popover>
  );
};
