import { getSelectedElements, PlaitBoard, toSvgData } from '@plait/core';
import { download, exportBoardToRasterBlob } from './common';
import { fileOpen } from '../data/filesystem';
import { IMAGE_MIME_TYPES } from '../constants';
import { insertImage } from '../data/image';
import { getBackgroundColor, isWhite } from './color';
import { TRANSPARENT } from '../constants/color';

export const saveAsSvg = (board: PlaitBoard) => {
  const selectedElements = getSelectedElements(board);
  const backgroundColor = getBackgroundColor(board);

  return toSvgData(board, {
    fillStyle: isWhite(backgroundColor) ? TRANSPARENT : backgroundColor,
    padding: 20,
    ratio: 4,
    elements: selectedElements.length > 0 ? selectedElements : undefined,
    inlineStyleClassNames: '.plait-text-container',
    styleNames: ['position'],
  }).then((svgData) => {
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const imageName = `drawnix-${new Date().getTime()}.svg`;
    download(blob, imageName);
  });
};

export const saveAsImage = (board: PlaitBoard, isTransparent: boolean) => {
  const selectedElements = getSelectedElements(board);
  const backgroundColor = getBackgroundColor(board) || 'white';
  const format = isTransparent ? 'png' : 'jpeg';
  const ext = isTransparent ? 'png' : 'jpg';

  return exportBoardToRasterBlob(board, {
    elements: selectedElements.length > 0 ? selectedElements : undefined,
    fillStyle: isTransparent ? 'transparent' : backgroundColor,
    format,
  })
    .then((image) => {
      const imageName = `drawnix-${new Date().getTime()}.${ext}`;
      download(image, imageName);
    })
    .catch((error) => {
      console.error('Error exporting image:', error);
    });
};

export const addImage = async (board: PlaitBoard) => {
  const imageFile = await fileOpen({
    description: 'Image',
    extensions: Object.keys(
      IMAGE_MIME_TYPES
    ) as (keyof typeof IMAGE_MIME_TYPES)[],
  });
  insertImage(board, imageFile);
};
