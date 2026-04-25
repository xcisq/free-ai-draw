import { useBoard } from '@plait-board/react-board';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { DialogType, useDrawnix } from '../../hooks/use-drawnix';
import { Translations, useI18n } from '../../i18n';
import {
  findImageElementById,
  getSingleSelectedImageElement,
} from '../../utils/image-element';
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

const readDefaultBackendUrl = () => {
  const envValue = import.meta.env.VITE_AUTODRAW_BACKEND_URL?.trim();
  if (envValue) {
    return envValue;
  }
  return 'http://127.0.0.1:8001';
};

const DEFAULT_BACKEND_URL = readDefaultBackendUrl();
const PROVIDER_OPTIONS = ['qingyun', 'bianxie', 'openrouter', 'local'] as const;
const STATUS_LABEL_KEYS: Record<ImageEditStatus, keyof Translations> = {
  idle: 'dialog.imageEdit.status.idle',
  submitting: 'dialog.imageEdit.status.submitting',
  running: 'dialog.imageEdit.status.running',
  succeeded: 'dialog.imageEdit.status.succeeded',
  failed: 'dialog.imageEdit.status.failed',
};

const STATUS_TONE_CLASS: Record<ImageEditStatus, string> = {
  idle: 'is-idle',
  submitting: 'is-busy',
  running: 'is-busy',
  succeeded: 'is-ready',
  failed: 'is-error',
};

const STATUS_NOTE: Record<ImageEditStatus, string> = {
  idle: '还没有发起模型调用，当前只在本地整理你的编辑指令。',
  submitting: '正在上传原图并创建任务，请保持当前工作台打开。',
  running: '图片编辑任务已经提交，完成后会原位替换画板里的图片。',
  succeeded: '任务已完成，结果会同步回画板里的原图位置。',
  failed: '这次编辑没有成功，建议检查提示词、路由和后端配置。',
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

const summarizePrompt = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return '还没有填写编辑提示词，模型暂时不知道要改什么。';
  }
  if (normalized.length <= 68) {
    return normalized;
  }
  return `${normalized.slice(0, 68)}…`;
};

const buildAssistNotes = ({
  hasTarget,
  prompt,
  provider,
  apiKey,
  removeBackground,
}: {
  hasTarget: boolean;
  prompt: string;
  provider: (typeof PROVIDER_OPTIONS)[number];
  apiKey: string;
  removeBackground: boolean;
}) => {
  const notes: string[] = [];

  if (!hasTarget) {
    notes.push('请先在画板里重新选中目标图片，再发起改图任务。');
  }
  if (!prompt.trim()) {
    notes.push('补一条明确指令，例如“保留主体轮廓，把背景换成浅色论文插图风格”。');
  } else if (prompt.trim().length > 180) {
    notes.push('提示词偏长，建议压缩成“主体 + 动作 + 风格”三段式，模型会更稳定。');
  }
  if (provider !== 'local' && !apiKey.trim()) {
    notes.push('如果后端没有预置密钥，请在这里填写 API Key，避免提交后才失败。');
  }
  if (removeBackground) {
    notes.push('已开启去背景，适合白底或杂色底图；若原图本就透明，可以关闭减少额外处理。');
  }

  if (notes.length === 0) {
    notes.push('当前信息已经足够，可以直接把这次 one-shot 改图机会交给模型。');
  }

  return notes;
};

const FieldLabel = ({
  index,
  label,
  hint,
}: {
  index: string;
  label: string;
  hint?: string;
}) => {
  return (
    <div className="image-edit-field-label">
      <span className="lbl">
        <span className="n">{index}</span>
        {label}
      </span>
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
};

const Pill = ({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'subtle';
}) => {
  return (
    <span className={`image-edit-pill ${tone === 'subtle' ? 'is-subtle' : ''}`}>
      {children}
    </span>
  );
};

export const ImageEditDialog = () => {
  const board = useBoard();
  const { appState, setAppState } = useDrawnix();
  const { t } = useI18n();
  const [prompt, setPrompt] = useState('');
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [provider, setProvider] =
    useState<(typeof PROVIDER_OPTIONS)[number]>('qingyun');
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

  const closeDialog = useCallback(() => {
    setAppState({
      ...appState,
      imageEditTargetId: null,
      openDialogType: null,
    });
  }, [appState, setAppState]);

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

  const submitImageEdit = useCallback(async () => {
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
    } catch (error: unknown) {
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
  }, [
    activeTask,
    apiKey,
    appState,
    baseUrl,
    effectiveBackendUrl,
    imageModel,
    prompt,
    provider,
    removeBackground,
    setAppState,
    t,
    targetElement,
    targetId,
  ]);

  const handlePromptKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        void submitImageEdit();
      }
    },
    [submitImageEdit]
  );

  const statusLabel = t(STATUS_LABEL_KEYS[status]);
  const isBusy = status === 'submitting' || !!activeTask;
  const summaryLines = useMemo(
    () => [
      targetElement
        ? '会基于当前选中的图片发起一次 one-shot 改图任务。'
        : '当前没有检测到可编辑图片，提交前需要回到画板重新选中目标。',
      `指令摘要：${summarizePrompt(prompt)}`,
      `执行路由：${provider} · ${
        imageModel.trim() || '使用后端默认图片模型'
      }`,
      removeBackground
        ? '结果回写：成功后会替换原图，并在结果图上追加一次去背景。'
        : '结果回写：成功后会直接替换画板里的原图，不追加去背景处理。',
    ],
    [imageModel, prompt, provider, removeBackground, targetElement]
  );
  const assistNotes = useMemo(
    () =>
      buildAssistNotes({
        hasTarget: !!targetElement,
        prompt,
        provider,
        apiKey,
        removeBackground,
      }),
    [apiKey, prompt, provider, removeBackground, targetElement]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="image-edit-dialog">
      <div className="image-edit-paper" />

      <header className="image-edit-topbar">
        <div className="image-edit-topbar__left">
          <button
            className="image-edit-back-btn"
            onClick={closeDialog}
            type="button"
          >
            <svg viewBox="0 0 14 14" aria-hidden="true">
              <path d="M9 3L5 7L9 11" />
            </svg>
            返回画板
          </button>

          <div className="image-edit-crumb">
            <span>工具</span>
            <span className="image-edit-crumb__sep">/</span>
            <span className="image-edit-crumb__current">
              Image Edit · 图片编辑工作台
            </span>
          </div>
        </div>

        <div className="image-edit-topbar__right">
          <span
            className={`image-edit-chip image-edit-chip--state ${
              STATUS_TONE_CLASS[status]
            }`}
          >
            <span className="image-edit-chip__dot" />
            {statusLabel}
          </span>
          <button
            className="image-edit-close-btn"
            onClick={closeDialog}
            type="button"
          >
            {t('dialog.close')}
          </button>
        </div>
      </header>

      <div className="image-edit-page-shell">
        <div className="image-edit-page-kicker">
          <span className="image-edit-page-kicker__dot" />
          IMAGE EDIT · 03
        </div>
        <h1 className="image-edit-page-title">
          当前图片 <span className="it">编辑工作台</span>
        </h1>
        <p className="image-edit-page-desc">{t('dialog.imageEdit.description')}</p>

        <div className="image-edit-layout">
          <section className="image-edit-column image-edit-column--left">
            <div className="image-edit-card image-edit-card--preview">
              <span className="image-edit-help-chip">// 画板选区中的原图预览</span>

              <div className="image-edit-card-head">
                <div>
                  <h3>
                    {t('dialog.imageEdit.sourceImage')}
                    <span className="it">· source</span>
                  </h3>
                  <p className="sub">
                    成功后会直接替换当前画板中的这张图片，不新增副本。
                  </p>
                </div>
                {jobId ? <Pill>{jobId}</Pill> : null}
              </div>

              {targetElement ? (
                <div className="image-edit-preview-window">
                  <div
                    className="image-edit-preview-grid"
                    aria-hidden="true"
                  ></div>
                  <img
                    className="image-edit-preview-window__image"
                    src={targetElement.url}
                    alt={t('dialog.imageEdit.sourceImage')}
                  />
                </div>
              ) : (
                <div className="image-edit-empty-state">
                  {t('dialog.imageEdit.targetMissing')}
                </div>
              )}
            </div>

            <div className="image-edit-card">
              <span className="image-edit-help-chip">// 只做本地检查，不调用模型</span>

              <h3>
                提交前摘要 <span className="it">· pre-flight</span>
              </h3>
              <p className="sub">
                在真正提交之前，先确认这次 one-shot 改图会如何执行。
              </p>

              <div className="image-edit-summary">
                <ul>
                  {summaryLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>

              <div className="image-edit-note">
                <span className="tag">本地提示</span>
                <p>{assistNotes[0]}</p>
              </div>

              {assistNotes.length > 1 ? (
                <div className="image-edit-note-list">
                  {assistNotes.slice(1).map((note) => (
                    <div key={note} className="image-edit-note-list__item">
                      {note}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section className="image-edit-column image-edit-column--right">
            <div className="image-edit-card image-edit-card--form">
              <span className="image-edit-help-chip">// one-shot image edit</span>

              <div className="image-edit-card-head image-edit-card-head--result">
                <div>
                  <h3>
                    编辑指令与运行配置 <span className="it">· composer</span>
                  </h3>
                  <p className="sub">
                    前面整理清楚，后面只发起一次模型请求，不做自动二次修复。
                  </p>
                </div>
                <span
                  className={`image-edit-state-chip ${
                    STATUS_TONE_CLASS[status]
                  }`}
                >
                  <span className="dot" />
                  {statusLabel}
                </span>
              </div>

              <div className="image-edit-field">
                <FieldLabel
                  index="01"
                  label={t('dialog.imageEdit.prompt')}
                  hint="Cmd / Ctrl + Enter 可直接提交"
                />
                <textarea
                  className="image-edit-textarea"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={handlePromptKeyDown}
                  placeholder={t('dialog.imageEdit.promptPlaceholder')}
                  rows={7}
                />
              </div>

              <div className="image-edit-grid">
                <label className="image-edit-field">
                  <FieldLabel
                    index="02"
                    label={t('dialog.imageEdit.backendUrl')}
                    hint="默认读取本地配置"
                  />
                  <input
                    className="image-edit-input"
                    value={backendUrl}
                    onChange={(event) => setBackendUrl(event.target.value)}
                  />
                </label>

                <label className="image-edit-field">
                  <FieldLabel
                    index="03"
                    label={t('dialog.imageEdit.provider')}
                    hint="决定走哪条编辑路由"
                  />
                  <select
                    className="image-edit-input"
                    value={provider}
                    onChange={(event) =>
                      setProvider(
                        event.target.value as (typeof PROVIDER_OPTIONS)[number]
                      )
                    }
                  >
                    {PROVIDER_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="image-edit-field">
                  <FieldLabel
                    index="04"
                    label={t('dialog.imageEdit.apiKey')}
                    hint="可选 · 后端未预置时填写"
                  />
                  <input
                    className="image-edit-input"
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                </label>

                <label className="image-edit-field">
                  <FieldLabel
                    index="05"
                    label={t('dialog.imageEdit.baseUrl')}
                    hint="可选 · 自定义兼容地址"
                  />
                  <input
                    className="image-edit-input"
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                  />
                </label>

                <label className="image-edit-field image-edit-field--full">
                  <FieldLabel
                    index="06"
                    label={t('dialog.imageEdit.imageModel')}
                    hint="默认使用图片编辑模型"
                  />
                  <input
                    className="image-edit-input"
                    value={imageModel}
                    onChange={(event) => setImageModel(event.target.value)}
                  />
                </label>
              </div>

              <label className="image-edit-toggle">
                <input
                  type="checkbox"
                  checked={removeBackground}
                  onChange={(event) =>
                    setRemoveBackground(event.target.checked)
                  }
                />
                <span className="image-edit-toggle__copy">
                  <span className="image-edit-toggle__title">
                    {t('dialog.imageEdit.removeBackground')}
                  </span>
                  <span className="image-edit-toggle__hint">
                    {t('dialog.imageEdit.removeBackgroundHint')}
                  </span>
                </span>
              </label>

              <div className="image-edit-runtime-row">
                <Pill tone="subtle">{provider}</Pill>
                <Pill tone="subtle">
                  {removeBackground ? '带去背景后处理' : '直接回写原图'}
                </Pill>
                <Pill tone="subtle">{imageModel.trim() || 'default model'}</Pill>
              </div>

              {errorMessage ? (
                <div className="image-edit-error">{errorMessage}</div>
              ) : null}

              <div className="image-edit-actions">
                <div className="image-edit-actions__hint">
                  {STATUS_NOTE[status]}
                </div>

                <div className="image-edit-btn-row">
                  <button
                    type="button"
                    className="image-edit-btn image-edit-btn--secondary"
                    onClick={closeDialog}
                  >
                    {t('dialog.imageEdit.close')}
                  </button>
                  <button
                    type="button"
                    className="image-edit-btn image-edit-btn--primary"
                    disabled={isBusy}
                    onClick={() => void submitImageEdit()}
                  >
                    {t('dialog.imageEdit.generate')}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ImageEditDialog;
