import { useEffect, useRef, useState } from 'react';
import { Drawnix, applyFontSchemeToCanvas } from '@drawnix/drawnix';
import { PlaitBoard, PlaitElement, PlaitTheme, Viewport } from '@plait/core';
import localforage from 'localforage';
import styles from './app.module.scss';

type AppValue = {
  children: PlaitElement[];
  viewport?: Viewport;
  theme?: PlaitTheme;
};

type BoardShellProps = {
  onBackToLanding?: () => void;
};

const MAIN_BOARD_CONTENT_KEY = 'main_board_content';
const FONT_SCHEME_KEY = 'drawnix_font_scheme';
const DEFAULT_FONT_SCHEME_ID = 'academic';

const FONT_SCHEMES = [
  {
    id: 'academic',
    label: '学术图表',
    description: '标题偏黑体，正文偏无衬线，注释偏衬线，适合论文图和流程图。',
    fontFamilies: [
      {
        label: '默认无衬线',
        value:
          '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      },
      {
        label: '思源黑体',
        value:
          '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      },
      {
        label: 'Arial',
        value: 'Arial, sans-serif',
      },
      {
        label: '宋体',
        value:
          '"Noto Serif SC", "Songti SC", "STSong", "Times New Roman", serif',
      },
      {
        label: '文楷',
        value:
          '"Kaiti SC", "STKaiti", "Noto Serif SC", "Songti SC", serif',
      },
      {
        label: '等宽',
        value:
          '"Cascadia Code", "JetBrains Mono", "SFMono-Regular", Consolas, "Courier New", monospace',
      },
    ],
    fontRoleFamilies: {
      title:
        '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
      body:
        '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      plain:
        '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      annotation:
        '"Noto Serif SC", "Songti SC", "STSong", "Times New Roman", serif',
      'decorative-symbol':
        '"Kaiti SC", "STKaiti", "Noto Serif SC", "Songti SC", serif',
      emoji:
        '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif',
      code:
        '"Cascadia Code", "JetBrains Mono", "SFMono-Regular", Consolas, "Courier New", monospace',
    },
  },
  {
    id: 'zh-priority',
    label: '中文优先',
    description: '强调中文可读性，适合中文报告、讲义和知识图谱。',
    fontFamilies: [
      {
        label: '苹方',
        value:
          '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      },
      {
        label: '思源黑体',
        value:
          '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      },
      {
        label: 'Arial',
        value: 'Arial, sans-serif',
      },
      {
        label: '文楷',
        value:
          '"Kaiti SC", "STKaiti", "Noto Serif SC", serif',
      },
      {
        label: '宋体',
        value:
          '"Noto Serif SC", "Songti SC", "STSong", serif',
      },
      {
        label: '等宽',
        value:
          '"Sarasa Mono SC", "Cascadia Code", Consolas, "Courier New", monospace',
      },
    ],
    fontRoleFamilies: {
      title:
        '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      body:
        '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      plain:
        '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      annotation:
        '"Noto Serif SC", "Songti SC", "STSong", serif',
      'decorative-symbol':
        '"Kaiti SC", "STKaiti", "Noto Serif SC", serif',
      emoji:
        '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
      code:
        '"Sarasa Mono SC", "Cascadia Code", Consolas, monospace',
    },
  },
  {
    id: 'en-priority',
    label: '英文优先',
    description: '强调英文标题和正文观感，适合英文图表和技术示意图。',
    fontFamilies: [
      {
        label: 'Helvetica',
        value: '"Helvetica Neue", Arial, sans-serif',
      },
      {
        label: 'Arial',
        value: 'Arial, sans-serif',
      },
      {
        label: 'Times',
        value: '"Times New Roman", Times, serif',
      },
      {
        label: 'Georgia',
        value: 'Georgia, serif',
      },
      {
        label: 'Cascadia',
        value:
          '"Cascadia Code", "JetBrains Mono", "SFMono-Regular", Consolas, "Courier New", monospace',
      },
    ],
    fontRoleFamilies: {
      title:
        '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
      body:
        '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
      plain:
        '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
      annotation:
        '"Times New Roman", Georgia, "Songti SC", serif',
      'decorative-symbol':
        '"Helvetica Neue", Arial, sans-serif',
      emoji:
        '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
      code:
        '"Cascadia Code", "JetBrains Mono", "SFMono-Regular", Consolas, "Courier New", monospace',
    },
  },
] as const;

const FONT_ROLE_PREVIEW_ITEMS = [
  { key: 'title', label: '标题', sample: 'Integrated Scientific Diagramming System' },
  { key: 'body', label: '正文', sample: 'User Natural Language Request' },
  { key: 'annotation', label: '注释', sample: '(Human-in-the-loop refinement)' },
] as const;

localforage.config({
  name: 'XAIBoard',
  storeName: 'xai_board_store',
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
});

export function BoardShell({ onBackToLanding }: BoardShellProps) {
  const [value, setValue] = useState<AppValue>({ children: [] });
  const [tutorial, setTutorial] = useState(false);
  const [fontSchemeId, setFontSchemeId] = useState<(typeof FONT_SCHEMES)[number]['id']>(
    'academic'
  );
  const [fontPanelOpen, setFontPanelOpen] = useState(false);
  const boardRef = useRef<PlaitBoard | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const [storedData, storedFontScheme] = await Promise.all([
        localforage.getItem(MAIN_BOARD_CONTENT_KEY),
        localforage.getItem(FONT_SCHEME_KEY),
      ]);
      const normalizedFontScheme =
        typeof storedFontScheme === 'string' &&
        FONT_SCHEMES.some((scheme) => scheme.id === storedFontScheme)
          ? (storedFontScheme as (typeof FONT_SCHEMES)[number]['id'])
          : 'academic';
      setFontSchemeId(normalizedFontScheme);
      const typedStoredData = storedData as AppValue;
      if (typedStoredData) {
        setValue(typedStoredData);
        if (typedStoredData.children && typedStoredData.children.length === 0) {
          setTutorial(true);
        }
        return;
      }
      setTutorial(true);
    };
    loadData();
  }, []);

  const activeFontScheme =
    FONT_SCHEMES.find((scheme) => scheme.id === fontSchemeId) || FONT_SCHEMES[0];

  return (
    <div className={styles.appShell}>
      {onBackToLanding ? (
        <div className={styles.topLeftTools}>
          <button
            type="button"
            className={styles.navButton}
            onClick={onBackToLanding}
            aria-label="返回首页"
          >
            <span className={styles.navButtonArrow} aria-hidden="true">
              ←
            </span>
            <span className={styles.navButtonLabel}>返回首页</span>
          </button>
        </div>
      ) : null}
      <div className={styles.boardContainer}>
        <Drawnix
          value={value.children}
          viewport={value.viewport}
          theme={value.theme}
          fontFamilies={[...activeFontScheme.fontFamilies]}
          fontRoleFamilies={activeFontScheme.fontRoleFamilies}
          onChange={(value) => {
            const newValue = value as AppValue;
            localforage.setItem(MAIN_BOARD_CONTENT_KEY, newValue);
            setValue(newValue);
            if (newValue.children && newValue.children.length > 0) {
              setTutorial(false);
            }
          }}
          tutorial={tutorial}
          afterInit={(board) => {
            boardRef.current = board;
          }}
        ></Drawnix>
      </div>
      <div className={styles.floatingTools}>
        {fontPanelOpen ? (
          <div className={styles.fontPanel}>
            <div className={styles.fontPanelHeader}>
              <div>
                <div className={styles.topBarTitle}>字体方案</div>
                <div className={styles.schemeDescription}>{activeFontScheme.description}</div>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setFontPanelOpen(false)}
              >
                收起
              </button>
            </div>
            <div className={styles.schemeActionRow}>
              <label className={styles.schemeControl}>
                <span className={styles.schemeLabel}>当前方案</span>
                <select
                  className={styles.schemeSelect}
                  value={fontSchemeId}
                  onChange={(event) => {
                    const nextValue = event.target.value as (typeof FONT_SCHEMES)[number]['id'];
                    setFontSchemeId(nextValue);
                    localforage.setItem(FONT_SCHEME_KEY, nextValue);
                  }}
                >
                  {FONT_SCHEMES.map((scheme) => (
                    <option key={scheme.id} value={scheme.id}>
                      {scheme.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={styles.applyButton}
                onClick={() => {
                  if (!boardRef.current) {
                    return;
                  }
                  applyFontSchemeToCanvas(boardRef.current, activeFontScheme.fontRoleFamilies);
                }}
              >
                应用到画布
              </button>
              <button
                type="button"
                className={styles.resetButton}
                disabled={fontSchemeId === DEFAULT_FONT_SCHEME_ID}
                onClick={() => {
                  setFontSchemeId(DEFAULT_FONT_SCHEME_ID);
                  localforage.setItem(FONT_SCHEME_KEY, DEFAULT_FONT_SCHEME_ID);
                }}
              >
                恢复默认
              </button>
            </div>
            <div className={styles.ruleHint}>
              <div className={styles.ruleHintTitle}>当前规则</div>
              <div className={styles.ruleHintText}>
                标题、正文、注释按当前全局角色字体策略导入；描边标题、emoji 和装饰符号优先走保真片段。
              </div>
            </div>
            <div className={styles.rolePreviewList}>
              {FONT_ROLE_PREVIEW_ITEMS.map((item) => (
                <div className={styles.rolePreviewCard} key={item.key}>
                  <div className={styles.rolePreviewLabel}>{item.label}</div>
                  <div
                    className={styles.rolePreviewText}
                    style={{
                      fontFamily:
                        activeFontScheme.fontRoleFamilies[
                          item.key as keyof typeof activeFontScheme.fontRoleFamilies
                        ],
                    }}
                  >
                    {item.sample}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={styles.openButton}
            onClick={() => setFontPanelOpen(true)}
          >
            字体方案
          </button>
        )}
      </div>
    </div>
  );
}

const addDebugLog = (board: PlaitBoard, value: string) => {
  const container = PlaitBoard.getBoardContainer(board).closest(
    '.drawnix'
  ) as HTMLElement;
  let consoleContainer = container.querySelector('.drawnix-console');
  if (!consoleContainer) {
    consoleContainer = document.createElement('div');
    consoleContainer.classList.add('drawnix-console');
    container.append(consoleContainer);
  }
  const div = document.createElement('div');
  div.innerHTML = value;
  consoleContainer.append(div);
};

void addDebugLog;

export default BoardShell;
