import { PlaitBoard, PlaitElement } from '@plait/core';
import { MIME_TYPES, VERSIONS } from '../constants';
import { fileOpen, fileSave } from './filesystem';
import { DrawnixExportedData, DrawnixExportedType } from './types';
import { loadFromBlob, normalizeFile } from './blob';
import {
  createBoardSnapshot,
  isValidDrawnixData,
  serializeBoardSnapshot,
} from './snapshot';

export const getDefaultName = () => {
  const time = new Date().getTime();
  return time.toString();
};

export const saveAsJSON = async (
  board: PlaitBoard,
  name: string = getDefaultName()
) => {
  const serialized = serializeAsJSON(board);
  const blob = new Blob([serialized], {
    type: MIME_TYPES.drawnix,
  });

  const fileHandle = await fileSave(blob, {
    name,
    extension: 'drawnix',
    description: 'Drawnix file',
  });
  return { fileHandle };
};

export const openJSONFile = async () => {
  const file = await fileOpen({
    description: 'Drawnix files',
    // ToDo: Be over-permissive until https://bugs.webkit.org/show_bug.cgi?id=34442
    // gets resolved. Else, iOS users cannot open `.drawnix` files.
    // extensions: ["json", "drawnix", "png", "svg"],
  });
  return file;
};

export const parseJSONFile = async (board: PlaitBoard, file: File) => {
  const normalizedFile = await normalizeFile(file);
  const data = await loadFromBlob(board, normalizedFile);
  return {
    data,
    fileName: normalizedFile.name || file.name || '',
  };
};

export const loadFromJSON = async (board: PlaitBoard) => {
  const file = await openJSONFile();
  return parseJSONFile(board, file);
};

export const serializeAsJSON = (board: PlaitBoard): string => {
  const data = createBoardSnapshot(board, {
    exportScope: 'board',
    embeddedIn: 'drawnix',
  });
  return serializeBoardSnapshot(data);
};
