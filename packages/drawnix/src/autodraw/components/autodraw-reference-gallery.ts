type DirectoryPermissionMode = 'read' | 'readwrite';

type ReferenceDirectoryEntry = {
  kind: 'file' | 'directory';
  name: string;
  getFile?: () => Promise<File>;
};

export type AutodrawReferenceDirectoryHandle = {
  name?: string;
  values: () => AsyncIterable<ReferenceDirectoryEntry>;
  queryPermission?: (descriptor?: {
    mode?: DirectoryPermissionMode;
  }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: {
    mode?: DirectoryPermissionMode;
  }) => Promise<PermissionState>;
};

export interface AutodrawReferenceGalleryItemFile {
  id: string;
  name: string;
  file: File;
}

const REFERENCE_GALLERY_DB_NAME = 'drawnix-autodraw-reference-gallery';
const REFERENCE_GALLERY_STORE_NAME = 'handles';
const REFERENCE_GALLERY_DIRECTORY_KEY = 'reference-directory';
const REFERENCE_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

const normalizeReferenceName = (fileName: string) => {
  return fileName.replace(/\.[^.]+$/, '').trim() || 'style';
};

const isSupportedReferenceFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  if (
    REFERENCE_IMAGE_EXTENSIONS.some((extension) =>
      lowerName.endsWith(extension)
    )
  ) {
    return true;
  }
  return file.type.startsWith('image/');
};

const openReferenceGalleryDb = () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(REFERENCE_GALLERY_DB_NAME, 1);
    request.onerror = () =>
      reject(request.error || new Error('open db failed'));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(REFERENCE_GALLERY_STORE_NAME)) {
        database.createObjectStore(REFERENCE_GALLERY_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
};

const runReferenceGalleryTransaction = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
) => {
  const database = await openReferenceGalleryDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(
      REFERENCE_GALLERY_STORE_NAME,
      mode
    );
    const store = transaction.objectStore(REFERENCE_GALLERY_STORE_NAME);
    const request = run(store);

    request.onerror = () =>
      reject(request.error || new Error('idb request failed'));
    request.onsuccess = () => resolve(request.result);

    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('idb transaction failed'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('idb transaction aborted'));
    };
  });
};

export const isAutodrawReferenceGallerySupported = () => {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return false;
  }
  return (
    typeof (
      window as Window & {
        showDirectoryPicker?: () => Promise<AutodrawReferenceDirectoryHandle>;
      }
    ).showDirectoryPicker === 'function'
  );
};

export const saveStoredAutodrawReferenceDirectory = async (
  handle: AutodrawReferenceDirectoryHandle
) => {
  await runReferenceGalleryTransaction('readwrite', (store) =>
    store.put(handle, REFERENCE_GALLERY_DIRECTORY_KEY)
  );
};

export const loadStoredAutodrawReferenceDirectory = async () => {
  return runReferenceGalleryTransaction<
    AutodrawReferenceDirectoryHandle | undefined
  >('readonly', (store) => store.get(REFERENCE_GALLERY_DIRECTORY_KEY));
};

export const clearStoredAutodrawReferenceDirectory = async () => {
  await runReferenceGalleryTransaction('readwrite', (store) =>
    store.delete(REFERENCE_GALLERY_DIRECTORY_KEY)
  );
};

export const requestAutodrawReferenceDirectory = async () => {
  const picker = (
    window as Window & {
      showDirectoryPicker?: () => Promise<AutodrawReferenceDirectoryHandle>;
    }
  ).showDirectoryPicker;
  if (!picker) {
    throw new Error('showDirectoryPicker unavailable');
  }
  return picker();
};

export const ensureAutodrawReferenceDirectoryPermission = async (
  handle: AutodrawReferenceDirectoryHandle,
  mode: DirectoryPermissionMode = 'read'
) => {
  if (!handle.queryPermission) {
    return true;
  }
  const currentPermission = await handle.queryPermission({ mode });
  if (currentPermission === 'granted') {
    return true;
  }
  if (!handle.requestPermission) {
    return false;
  }
  const nextPermission = await handle.requestPermission({ mode });
  return nextPermission === 'granted';
};

export const readAutodrawReferenceGallery = async (
  handle: AutodrawReferenceDirectoryHandle
) => {
  const items: AutodrawReferenceGalleryItemFile[] = [];

  for await (const entry of handle.values()) {
    if (entry.kind !== 'file' || typeof entry.getFile !== 'function') {
      continue;
    }
    const file = await entry.getFile();
    if (!isSupportedReferenceFile(file)) {
      continue;
    }
    items.push({
      id: file.name,
      name: normalizeReferenceName(file.name),
      file,
    });
  }

  items.sort((left, right) =>
    left.name.localeCompare(right.name, 'zh-Hans-CN')
  );
  return items;
};
