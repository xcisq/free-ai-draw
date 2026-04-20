export interface ArtifactResponse {
  name: string;
  kind: string;
  download_url: string;
}

export interface JobResponse {
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error_message?: string | null;
  artifacts?: ArtifactResponse[];
}

export const normalizeBackendUrl = (value: string) => value.replace(/\/+$/, '');

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });

export const readErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = await response.json();
    const detail =
      typeof payload?.detail === 'string'
        ? payload.detail
        : typeof payload?.message === 'string'
        ? payload.message
        : '';
    return detail || fallback;
  } catch {
    return fallback;
  }
};

export const resolveEditedArtifact = (artifacts: ArtifactResponse[]) => {
  return (
    artifacts.find((artifact) => artifact.kind === 'edited_image') ||
    artifacts.find((artifact) => artifact.name.startsWith('edited.')) ||
    null
  );
};
