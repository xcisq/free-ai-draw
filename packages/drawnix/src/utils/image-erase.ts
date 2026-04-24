import {
  PlaitBoard,
  Point,
  RectangleClient,
  rotateAntiPointsByElement,
  toHostPoint,
  toViewBoxPoint,
} from '@plait/core';
import {
  DrawnixImageElement,
  DrawnixImageEraseMask,
  DrawnixImageEraseStroke,
} from './image-element';

const MAX_COMPOSITED_IMAGE_EDGE = 4096;
const IMAGE_ERASE_CACHE = new Map<string, string>();
const IMAGE_ERASE_PENDING_CACHE = new Map<string, Promise<string>>();

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const getImageRectangle = (element: DrawnixImageElement) => {
  return RectangleClient.getRectangleByPoints(element.points);
};

const loadImageElement = (sourceUrl: string) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Failed to load image for erase mask: ${sourceUrl}`));
    image.src = sourceUrl;
  });
};

const drawEraseStroke = (
  context: CanvasRenderingContext2D,
  stroke: DrawnixImageEraseStroke,
  width: number,
  height: number
) => {
  const radius = stroke.radius * Math.min(width, height);
  if (!Number.isFinite(radius) || radius <= 0 || !stroke.points.length) {
    return;
  }

  const mappedPoints = stroke.points.map(
    ([x, y]) => [x * width, y * height] as Point
  );

  context.save();
  context.globalCompositeOperation = 'destination-out';
  context.fillStyle = '#000';
  context.strokeStyle = '#000';
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = radius * 2;

  if (mappedPoints.length === 1) {
    const [x, y] = mappedPoints[0];
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2, false);
    context.fill();
    context.restore();
    return;
  }

  context.beginPath();
  context.moveTo(mappedPoints[0][0], mappedPoints[0][1]);
  mappedPoints.slice(1).forEach(([x, y]) => {
    context.lineTo(x, y);
  });
  context.stroke();
  context.restore();
};

export const buildImageEraseCacheKey = (
  sourceUrl: string,
  eraseMask?: DrawnixImageEraseMask
) => {
  return `${sourceUrl}::${JSON.stringify(eraseMask || null)}`;
};

export const getImageEraseViewBoxRadius = (
  board: PlaitBoard,
  screenPoint: Point,
  screenRadius = 12
) => {
  const originHostPoint = toHostPoint(board, screenPoint[0], screenPoint[1]);
  const offsetHostPoint: Point = [
    originHostPoint[0] + screenRadius,
    originHostPoint[1],
  ];
  const originViewBoxPoint = toViewBoxPoint(board, originHostPoint);
  const offsetViewBoxPoint = toViewBoxPoint(board, offsetHostPoint);
  return Math.abs(offsetViewBoxPoint[0] - originViewBoxPoint[0]);
};

export const buildImageEraseStroke = (
  board: PlaitBoard,
  element: DrawnixImageElement,
  points: Point[],
  radius: number
): DrawnixImageEraseStroke | null => {
  if (!points.length) {
    return null;
  }

  const rectangle = getImageRectangle(element);
  if (rectangle.width <= 0 || rectangle.height <= 0) {
    return null;
  }

  const minDimension = Math.min(rectangle.width, rectangle.height);
  if (minDimension <= 0) {
    return null;
  }

  const normalizedPoints = points.map((point) => {
    const antiRotatedPoint =
      rotateAntiPointsByElement(board, point, element) || point;

    return [
      clamp((antiRotatedPoint[0] - rectangle.x) / rectangle.width, 0, 1),
      clamp((antiRotatedPoint[1] - rectangle.y) / rectangle.height, 0, 1),
    ] as Point;
  });

  return {
    points: normalizedPoints,
    radius: Math.max(radius / minDimension, 0),
  };
};

export const applyImageEraseMask = async (
  sourceUrl: string,
  eraseMask?: DrawnixImageEraseMask
) => {
  if (!eraseMask?.strokes.length || typeof document === 'undefined') {
    return sourceUrl;
  }

  const cacheKey = buildImageEraseCacheKey(sourceUrl, eraseMask);
  const cachedValue = IMAGE_ERASE_CACHE.get(cacheKey);
  if (cachedValue) {
    return cachedValue;
  }

  const pendingValue = IMAGE_ERASE_PENDING_CACHE.get(cacheKey);
  if (pendingValue) {
    return pendingValue;
  }

  const composePromise = (async () => {
    const image = await loadImageElement(sourceUrl);
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    if (!naturalWidth || !naturalHeight) {
      return sourceUrl;
    }

    const scale = Math.min(
      1,
      MAX_COMPOSITED_IMAGE_EDGE / Math.max(naturalWidth, naturalHeight)
    );
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      return sourceUrl;
    }

    context.drawImage(image, 0, 0, width, height);
    eraseMask.strokes.forEach((stroke) => {
      drawEraseStroke(context, stroke, width, height);
    });

    const maskedUrl = canvas.toDataURL('image/png');
    IMAGE_ERASE_CACHE.set(cacheKey, maskedUrl);
    return maskedUrl;
  })();

  IMAGE_ERASE_PENDING_CACHE.set(cacheKey, composePromise);

  try {
    return await composePromise;
  } finally {
    IMAGE_ERASE_PENDING_CACHE.delete(cacheKey);
  }
};
