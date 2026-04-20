import { useBoard } from '@plait-board/react-board';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DialogType, useDrawnix } from '../../hooks/use-drawnix';
import { Translations, useI18n } from '../../i18n';
import { findImageElementById, getSingleSelectedImageElement } from '../../utils/image-element';
import { normalizeBackendUrl, readErrorMessage } from '../utils';
import './image-edit-dialog.scss';

interface UploadImageResponse {
  upload_id: string;
  stored_path: string;
}

interface CreateJobResponse {
  job_id: string;
}

type ImageEditStatus =
  | 'idle'
  | 'submitting'
  | 'running'
  | 'succeeded'
  | 'failed';

const DEFAULT_BACKEND_URL =
  import.meta.env.VITE_AUTODRAW_BACKEND_URL?.trim() || 'http://127.0.0.1:8001';
const PROVIDER_OPTIONS = [
  'qingyun',
  'bianxie',
  'openrouter',
  'local',
] as const;
const STATUS_LABEL_KEYS: Record<ImageEditStatus, keyof Translations> = {
  idle: 'dialog.imageEdit.status.idle',
  submitting: 'dialog.imageEdit.status.submitting',
  running: 'dialog.imageEdit.status.running',
  succeeded: 'dialog.imageEdit.status.succeeded',
  failed: 'dialog.imageEdit.status.failed',
};

const getFileExtension = (mimeType: string) => {
  if (mimeType.includes('png')) {
    return 'png';
  }
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
    return 'jpg';
  }
  if (mimeType.includes('webp')) {
    return 'webp';
  }
  return 'png';
};

export const ImageEditDialog = () => {
  const board = useBoard();
  const { appState, setAppState } = useDrawnix();
  const { t } = useI18n();
  const [prompt, setPrompt] = useState('');
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [provider, setProvider] = useState<(typeof PROVIDER_OPTIONS)[number]>(
    'qingyun'
  );
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [imageModel, setImageModel] = useState(
    'gemini-3.1-flash-image-preview'
  );
  const [removeBackground, setRemoveBackground] = useState(false);
  const [status, setStatus] = useState<ImageEditStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const isOpen = appState.openDialogType === DialogType.imageEdit;
  const targetElement = useMemo(() => {
    if (appState.imageEditTargetId) {
      return findImageElementById(board, appState.imageEditTargetId);
    }
    return getSingleSelectedImageElement(board);
  }, [appState.imageEditTargetId, board, board.children]);
  const targetId = targetElement?.id || appState.imageEditTargetId || null;
  const activeTask = targetId ? appState.imageGenerationTasks[targetId] : null;

  const effectiveBackendUrl = useMemo(
    () => normalizeBackendUrl(backendUrl || DEFAULT_BACKEND_URL),
    [backendUrl]
  );

  const closeDialog = () => {
    setAppState({
      ...appState,
      imageEditTargetId: null,
      openDialogType: null,
    });
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPrompt('');
      setRemoveBackground(false);
      setStatus('idle');
      setErrorMessage('');
      setJobId(null);
      return;
    }
    if (activeTask) {
      setStatus('running');
      setJobId(activeTask.jobId);
    }
  }, [activeTask, isOpen, targetId]);

  if (!isOpen) {
    return null;
  }

  const submitImageEdit = async () => {
    if (!targetElement || !targetId) {
      setStatus('failed');
      setErrorMessage(t('dialog.imageEdit.error.noTarget'));
      return;
    }
    if (!prompt.trim()) {
      setStatus('failed');
      setErrorMessage(t('dialog.imageEdit.error.noPrompt'));
      return;
    }

    try {
      setStatus('submitting');
      setErrorMessage('');

      const sourceResponse = await fetch(targetElement.url);
      if (!sourceResponse.ok) {
        throw new Error(t('dialog.imageEdit.error.exportFailed'));
      }
      const sourceBlob = await sourceResponse.blob();
      const mimeType = sourceBlob.type || 'image/png';
      const sourceFile = new File(
        [sourceBlob],
        `canvas-image.${getFileExtension(mimeType)}`,
        { type: mimeType }
      );

      const uploadFormData = new FormData();
      uploadFormData.append('file', sourceFile);

      const uploadResponse = await fetch(
        `${effectiveBackendUrl}/api/uploads/image-edit-source`,
        {
          method: 'POST',
          body: uploadFormData,
        }
      );
      if (!uploadResponse.ok) {
        throw new Error(
          await readErrorMessage(
            uploadResponse,
            t('dialog.imageEdit.error.submitFailed')
          )
        );
      }
      const uploadData = (await uploadResponse.json()) as UploadImageResponse;

      const jobResponse = await fetch(`${effectiveBackendUrl}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_type: 'image-edit',
          prompt: prompt.trim(),
          source_image_path: uploadData.stored_path,
          provider,
          api_key: apiKey.trim() || null,
          base_url: baseUrl.trim() || null,
          image_model: imageModel.trim() || null,
          remove_background: removeBackground,
        }),
      });
      if (!jobResponse.ok) {
        throw new Error(
          await readErrorMessage(
            jobResponse,
            t('dialog.imageEdit.error.submitFailed')
          )
        );
      }
      const jobData = (await jobResponse.json()) as CreateJobResponse;
      setStatus('running');
      setJobId(jobData.job_id);
      setAppState({
        ...appState,
        imageGenerationTasks: {
          ...appState.imageGenerationTasks,
          [targetId]: {
            targetId,
            jobId: jobData.job_id,
            backendUrl: effectiveBackendUrl,
            status: 'running',
          },
        },
      });
    } catch (error: any) {
      if (!isMountedRef.current) {
        return;
      }
      setStatus('failed');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t('dialog.imageEdit.error.submitFailed')
      );
    }
  };

  return (
    <div className="image-edit-dialog">
      <div className="image-edit-dialog__header">
        <div>
          <span className="image-edit-dialog__eyebrow">Image Edit</span>
          <h2 className="image-edit-dialog__title">
            {t('dialog.imageEdit.title')}
          </h2>
          <p className="image-edit-dialog__description">
            {t('dialog.imageEdit.description')}
          </p>
        </div>
        <span className="image-edit-dialog__status">
          {t(STATUS_LABEL_KEYS[status])}
        </span>
      </div>

      <div className="image-edit-dialog__content">
        <section className="image-edit-dialog__panel image-edit-dialog__panel--preview">
          <div className="image-edit-dialog__panel-head">
            <h3>{t('dialog.imageEdit.sourceImage')}</h3>
            {jobId && <span className="image-edit-dialog__pill">{jobId}</span>}
          </div>
          {targetElement ? (
            <div className="image-edit-dialog__preview-surface">
              <div
                className="image-edit-dialog__transparent-grid"
                aria-hidden="true"
              ></div>
              <img
                className="image-edit-dialog__preview"
                src={targetElement.url}
                alt={t('dialog.imageEdit.sourceImage')}
              />
            </div>
          ) : (
            <div className="image-edit-dialog__empty">
              {t('dialog.imageEdit.targetMissing')}
            </div>
          )}
        </section>

        <section className="image-edit-dialog__panel">
          <label className="image-edit-dialog__field">
            <span className="image-edit-dialog__label">
              {t('dialog.imageEdit.prompt')}
            </span>
            <textarea
              className="image-edit-dialog__textarea"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={t('dialog.imageEdit.promptPlaceholder')}
              rows={6}
            />
          </label>

          <div className="image-edit-dialog__grid">
            <label className="image-edit-dialog__field">
              <span className="image-edit-dialog__label">
                {t('dialog.imageEdit.backendUrl')}
              </span>
              <input
                className="image-edit-dialog__input"
                value={backendUrl}
                onChange={(event) => setBackendUrl(event.target.value)}
              />
            </label>
            <label className="image-edit-dialog__field">
              <span className="image-edit-dialog__label">
                {t('dialog.imageEdit.provider')}
              </span>
              <select
                className="image-edit-dialog__input"
                value={provider}
                onChange={(event) =>
                  setProvider(event.target.value as (typeof PROVIDER_OPTIONS)[number])
                }
              >
                {PROVIDER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="image-edit-dialog__field">
              <span className="image-edit-dialog__label">
                {t('dialog.imageEdit.apiKey')}
              </span>
              <input
                className="image-edit-dialog__input"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
            <label className="image-edit-dialog__field">
              <span className="image-edit-dialog__label">
                {t('dialog.imageEdit.baseUrl')}
              </span>
              <input
                className="image-edit-dialog__input"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
              />
            </label>
            <label className="image-edit-dialog__field image-edit-dialog__field--full">
              <span className="image-edit-dialog__label">
                {t('dialog.imageEdit.imageModel')}
              </span>
              <input
                className="image-edit-dialog__input"
                value={imageModel}
                onChange={(event) => setImageModel(event.target.value)}
              />
            </label>
          </div>

          <label className="image-edit-dialog__toggle">
            <input
              type="checkbox"
              checked={removeBackground}
              onChange={(event) => setRemoveBackground(event.target.checked)}
            />
            <span className="image-edit-dialog__toggle-copy">
              <span className="image-edit-dialog__label">
                {t('dialog.imageEdit.removeBackground')}
              </span>
              <span className="image-edit-dialog__hint">
                {t('dialog.imageEdit.removeBackgroundHint')}
              </span>
            </span>
          </label>

          {errorMessage && (
            <div className="image-edit-dialog__error">{errorMessage}</div>
          )}

          <div className="image-edit-dialog__actions">
            <button
              type="button"
              className="image-edit-dialog__button image-edit-dialog__button--secondary"
              onClick={closeDialog}
            >
              {t('dialog.imageEdit.close')}
            </button>
            <button
              type="button"
              className="image-edit-dialog__button image-edit-dialog__button--primary"
              disabled={status === 'submitting' || !!activeTask}
              onClick={submitImageEdit}
            >
              {t('dialog.imageEdit.generate')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ImageEditDialog;
