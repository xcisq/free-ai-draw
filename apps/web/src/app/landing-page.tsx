import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

type LandingPageProps = {
  onEnterBoard: () => void;
  onOpenDocs: () => void;
};

type LandingCanvasProps = {
  dark: boolean;
  onEnterBoard: () => void;
  onOpenDocs: () => void;
};

type Feature = {
  id: 'freedraw' | 'autodraw' | 'mermaid' | 'gallery';
  zh: string;
  en: string;
  desc: string;
  meta: string;
  cta: string;
  featured?: boolean;
};

type PipelineStep = {
  id: string;
  label: string;
  note: string;
};

type GalleryItem = {
  id: string;
  title: string;
  subtitle: string;
  note: string;
  src: string;
};

type SketchArrowProps = {
  d: string;
  style?: CSSProperties;
  label?: string;
  labelX?: number | string;
  labelY?: number | string;
  labelTextStyle?: CSSProperties;
};

const FEATURES: Feature[] = [
  {
    id: 'freedraw',
    zh: '自由画板',
    en: 'Free Draw',
    desc: '手绘、涂鸦、手写笔记。无限画布，流畅手感。',
    meta: '手绘 · 涂鸦 · 手写',
    cta: '开始画',
  },
  {
    id: 'autodraw',
    zh: 'AutoDraw',
    en: 'AI 图生图 · 垫图',
    desc: '文本 → 图片 → SAM3 分割 → 去背景 → SVG → 落盘。一键进入画布。',
    meta: 'AI Pipeline',
    cta: '运行 Pipeline',
    featured: true,
  },
  {
    id: 'mermaid',
    zh: 'Mermaid 思维导图',
    en: 'Mind Map & Mermaid',
    desc: 'Markdown / Mermaid 语法一键生成结构化图形。',
    meta: '导图 · 流程图',
    cta: '写语法',
  },
  {
    id: 'gallery',
    zh: '模板库',
    en: 'Templates & Gallery',
    desc: '课题组示例画廊与可复用模板，从空白到成稿少走弯路。',
    meta: '示例 · 模板',
    cta: '浏览画廊',
  },
];

const PIPELINE: PipelineStep[] = [
  { id: 'text', label: '文本输入', note: '课题摘要 / prompt' },
  { id: 't2i', label: '文生图', note: '扩散模型' },
  { id: 'sam', label: 'SAM3 分割', note: '实例掩码' },
  { id: 'matting', label: '去背景', note: 'alpha 抠图' },
  { id: 'svg', label: '矢量化', note: '路径化为 SVG' },
  { id: 'board', label: '导入画板', note: '可编辑图元' },
];

const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: '20260425_174014_b592ffa4',
    title: 'AI Model-Assisted Labeling',
    subtitle: 'Project Goal · Boost Human Accuracy',
    note: 'autodraw jobs · 2026-04-25 · final.svg',
    src: '/autodraw-gallery/ai-model-assisted-labeling.svg',
  },
  {
    id: '20260426_043654_f4f0311b',
    title: 'Video + Live Cards Logic',
    subtitle: 'Three Card Types · Strong / Weak Judge',
    note: 'autodraw jobs · 2026-04-26 · final.svg',
    src: '/autodraw-gallery/video-live-cards-logic.svg',
  },
  {
    id: '20260417_020059_4401350f',
    title: '交互可视化重构框架',
    subtitle: 'Extract · Store · Migrate · Edit',
    note: 'autodraw jobs · 2026-04-17 · final.svg',
    src: '/autodraw-gallery/interactive-reconstruction-framework.svg',
  },
  {
    id: '20260416_125215_adb3238b',
    title: '交互形式化与解耦流程',
    subtitle: 'Interaction Formalization & Decoupling',
    note: 'autodraw jobs · 2026-04-16 · final.svg',
    src: '/autodraw-gallery/interactive-reconstruction-stage-1.svg',
  },
];

function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (!target) {
    return;
  }
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function handleFeatureAction(
  featureId: Feature['id'],
  onEnterBoard: () => void
) {
  if (featureId === 'gallery') {
    scrollToSection('gallery');
    return;
  }
  if (featureId === 'autodraw') {
    scrollToSection('pipeline');
    return;
  }
  onEnterBoard();
}

export default function LandingPage({
  onEnterBoard,
  onOpenDocs,
}: LandingPageProps) {
  return (
    <>
      <V1Sketchbook
        dark={false}
        onEnterBoard={onEnterBoard}
        onOpenDocs={onOpenDocs}
      />
      <style>{`
        html {
          scroll-behavior: smooth;
        }
        @keyframes xai-sketch-draw {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </>
  );
}

function V1Sketchbook({ dark, onEnterBoard, onOpenDocs }: LandingCanvasProps) {
  const bg = dark ? '#0f1115' : '#f7f8fb';
  const paper = dark ? '#161923' : '#ffffff';
  const ink = dark ? '#e7e9ee' : '#111827';
  const sub = dark ? '#8e95a4' : '#667085';
  const mute = dark ? '#4b5260' : '#d0d5dd';
  const hair = dark ? '#242834' : '#e4e7ec';
  const accent = dark ? '#9ca3ff' : '#2563eb';
  const sans =
    '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Helvetica Neue",Arial,sans-serif';
  const serif =
    '"Songti SC","STSong","Noto Serif CJK SC","Times New Roman",serif';
  const [hover, setHover] = useState<Feature['id'] | null>(null);
  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null);

  useEffect(() => {
    if (!previewItem) {
      return undefined;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewItem(null);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [previewItem]);

  const linkStyle: CSSProperties = {
    color: ink,
    textDecoration: 'none',
    opacity: 0.72,
  };
  const ghostBtn: CSSProperties = {
    height: 34,
    padding: '0 14px',
    borderRadius: 999,
    border: `1px solid ${mute}`,
    background: paper,
    color: ink,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
  const primaryBtn: CSSProperties = {
    height: 34,
    padding: '0 16px',
    borderRadius: 999,
    background: dark ? paper : '#111827',
    color: dark ? '#111827' : '#ffffff',
    border: 'none',
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 500,
    fontFamily: 'inherit',
  };
  const kbd: CSSProperties = {
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: 4,
    border: `1px solid ${hair}`,
    fontSize: 11,
    fontFamily: 'ui-monospace, monospace',
    color: sub,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: bg,
        color: ink,
        fontFamily: sans,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: `linear-gradient(${hair} 1px, transparent 1px), linear-gradient(90deg, ${hair} 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          opacity: dark ? 0.18 : 0.35,
          maskImage:
            'radial-gradient(ellipse at 50% 30%, black 30%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at 50% 30%, black 30%, transparent 75%)',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 32px',
          borderBottom: `1px solid ${hair}`,
          background: dark ? 'rgba(15,17,21,0.7)' : 'rgba(247,248,251,0.7)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <XaiMark size={22} color={ink} />
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.3 }}>
            XAI Board
          </div>
          <Anno style={{ marginLeft: 10 }}>XAI 课题组 · 绘图工作台</Anno>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 13,
            color: sub,
          }}
        >
          <a style={linkStyle} href="#features">
            功能
          </a>
          <a style={linkStyle} href="#pipeline">
            AutoDraw
          </a>
          <a style={linkStyle} href="#gallery">
            画廊
          </a>
          <button type="button" style={ghostBtn} onClick={onOpenDocs}>
            使用手册
          </button>
          <button
            type="button"
            style={ghostBtn}
            onClick={() => scrollToSection('features')}
          >
            查看功能
          </button>
          <button type="button" style={primaryBtn} onClick={onEnterBoard}>
            进入画板 →
          </button>
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1160,
          margin: '0 auto',
          padding: '80px 32px 40px',
        }}
      >
        <Anno style={{ fontSize: 13 }}>xcl · 2026 Spring</Anno>
        <h1
          style={{
            margin: '18px 0 0',
            fontSize: 'clamp(48px, 6.2vw, 84px)',
            lineHeight: 1.02,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: ink,
          }}
        >
          把想法
          <span
            style={{
              position: 'relative',
              display: 'inline-block',
              margin: '0 10px',
            }}
          >
            <span
              style={{
                fontFamily: serif,
                fontStyle: 'italic',
                fontWeight: 500,
              }}
            >
              画出来
            </span>
            <svg
              style={{
                position: 'absolute',
                left: -6,
                right: -6,
                bottom: -10,
                width: 'calc(100% + 12px)',
                height: 18,
              }}
              viewBox="0 0 220 18"
              preserveAspectRatio="none"
            >
              <path
                d="M2 12 C 40 4, 80 16, 120 8 S 200 14, 218 6"
                fill="none"
                stroke={accent}
                strokeWidth="2.2"
                strokeLinecap="round"
                style={{
                  strokeDasharray: 400,
                  strokeDashoffset: 400,
                  animation:
                    'xai-sketch-draw 1.4s cubic-bezier(.4,.2,.2,1) .4s forwards',
                }}
              />
            </svg>
          </span>
          <br />
          再让 AI 把它
          <span
            style={{
              fontFamily: serif,
              fontStyle: 'italic',
              fontWeight: 500,
              color: accent,
              marginLeft: 10,
            }}
          >
            落到画布上
          </span>
          。
        </h1>
        <p
          style={{
            marginTop: 28,
            maxWidth: 640,
            fontSize: 17,
            lineHeight: 1.65,
            color: sub,
          }}
        >
          XAI Board
          是课题组的日常绘图工作台。白板、思维导图、流程图、手绘，全部一体化。
          <br />
          新内置的 <b style={{ color: ink }}>AutoDraw</b>{' '}
          让你从一段文本直接产出可编辑的矢量图元。
          <br />
          <Anno>文本 → 扩散 → SAM3 → 抠图 → SVG → 画布</Anno>
        </p>
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 36,
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            style={{
              ...primaryBtn,
              height: 46,
              padding: '0 22px',
              fontSize: 15,
            }}
            onClick={onEnterBoard}
          >
            打开空白画布 →
          </button>
          <button
            type="button"
            style={{ ...ghostBtn, height: 46, padding: '0 22px', fontSize: 14 }}
            onClick={onOpenDocs}
          >
            阅读手册
          </button>
          <button
            type="button"
            style={{ ...ghostBtn, height: 46, padding: '0 22px', fontSize: 14 }}
            onClick={() => scrollToSection('pipeline')}
          >
            ▶ 看 AutoDraw
          </button>
          <Anno style={{ marginLeft: 6 }}>
            或按 <kbd style={kbd}>N</kbd> 新建
          </Anno>
        </div>
        <SketchArrow
          style={{ top: 48, right: 48, width: 180, height: 80, color: sub }}
          d="M 170 10 C 150 20, 110 28, 60 60 L 40 72 M 46 62 L 40 72 L 50 72"
          label="AutoDraw 在这里 →"
        />
        <SketchArrow
          style={{ bottom: -30, left: 80, width: 160, height: 60, color: sub }}
          d="M 20 40 C 40 20, 80 8, 140 14 M 134 8 L 142 14 L 134 20"
          label="四大模块 ↓"
          labelX={30}
          labelY={54}
        />
      </div>

      <div
        id="features"
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1160,
          margin: '0 auto',
          padding: '60px 32px 40px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 32,
          }}
        >
          <div>
            <Anno>01 · Modules</Anno>
            <h2
              style={{
                margin: '6px 0 0',
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}
            >
              四种工作方式，
              <span
                style={{ fontFamily: serif, fontStyle: 'italic', color: sub }}
              >
                同一块画布
              </span>
            </h2>
          </div>
          <Anno>hover 查看示例 →</Anno>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gap: 16,
          }}
        >
          {FEATURES.map((feature, index) => {
            const span = feature.featured
              ? 6
              : index === 0
              ? 6
              : index === 2
              ? 5
              : 7;
            const isHover = hover === feature.id;
            return (
              <button
                key={feature.id}
                type="button"
                onMouseEnter={() => setHover(feature.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => handleFeatureAction(feature.id, onEnterBoard)}
                style={{
                  gridColumn: `span ${span}`,
                  background: paper,
                  border: `1px solid ${isHover ? ink : hair}`,
                  borderRadius: 14,
                  padding: feature.featured
                    ? '28px 28px 24px'
                    : '22px 22px 20px',
                  minHeight: feature.featured ? 280 : 200,
                  position: 'relative',
                  cursor: 'pointer',
                  transition:
                    'border-color .25s, transform .25s, box-shadow .25s',
                  transform: isHover ? 'translateY(-3px)' : 'translateY(0)',
                  boxShadow: isHover
                    ? dark
                      ? '0 18px 50px rgba(0,0,0,0.4)'
                      : '0 18px 50px rgba(15,23,42,0.10)'
                    : 'none',
                  overflow: 'hidden',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      color: ink,
                    }}
                  >
                    <SketchIcon kind={feature.id} size={22} color={ink} />
                    <Anno>
                      {String(index + 1).padStart(2, '0')} / {feature.meta}
                    </Anno>
                  </div>
                  {feature.featured ? (
                    <Anno style={{ color: accent }}>★ NEW</Anno>
                  ) : null}
                </div>
                <div style={{ marginTop: feature.featured ? 18 : 14 }}>
                  <div
                    style={{
                      fontSize: feature.featured ? 28 : 22,
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {feature.zh}
                  </div>
                  <div
                    style={{
                      fontFamily: serif,
                      fontStyle: 'italic',
                      color: sub,
                      fontSize: 13,
                      marginTop: 4,
                    }}
                  >
                    {feature.en}
                  </div>
                  <p
                    style={{
                      marginTop: 14,
                      fontSize: 14,
                      lineHeight: 1.65,
                      color: sub,
                      maxWidth: 480,
                    }}
                  >
                    {feature.desc}
                  </p>
                </div>
                {feature.featured ? (
                  <div
                    style={{
                      marginTop: 22,
                      padding: '14px 16px',
                      border: `1px dashed ${mute}`,
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                      fontSize: 12,
                      color: sub,
                    }}
                  >
                    {PIPELINE.map((step, stepIndex) => (
                      <FragmentWithArrow
                        key={step.id}
                        isLast={stepIndex === PIPELINE.length - 1}
                        color={sub}
                      >
                        <span style={{ color: ink, fontWeight: 500 }}>
                          {step.label}
                        </span>
                      </FragmentWithArrow>
                    ))}
                  </div>
                ) : null}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 20,
                    right: 22,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    color: isHover ? accent : sub,
                    transition: 'color .2s, transform .2s',
                    transform: isHover ? 'translateX(4px)' : 'translateX(0)',
                  }}
                >
                  {feature.cta}
                  <SketchIcon
                    kind="arrow"
                    size={18}
                    color={isHover ? accent : sub}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div
        id="pipeline"
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1160,
          margin: '0 auto',
          padding: '80px 32px 40px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 40,
          }}
        >
          <div>
            <Anno>02 · AutoDraw Pipeline</Anno>
            <h2
              style={{
                margin: '6px 0 0',
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}
            >
              从一段
              <span style={{ fontFamily: serif, fontStyle: 'italic' }}>
                总结文本
              </span>
              ，到一组可编辑
              <span style={{ fontFamily: serif, fontStyle: 'italic' }}>
                矢量图元
              </span>
            </h2>
          </div>
          <button type="button" style={ghostBtn} onClick={onEnterBoard}>
            打开画板 ↗
          </button>
        </div>
        <div
          style={{
            position: 'relative',
            background: paper,
            border: `1px solid ${hair}`,
            borderRadius: 14,
            padding: '48px 32px 56px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${PIPELINE.length}, 1fr)`,
              gap: 0,
              alignItems: 'start',
            }}
          >
            {PIPELINE.map((step, index) => (
              <div
                key={step.id}
                style={{
                  position: 'relative',
                  textAlign: 'center',
                  padding: '0 8px',
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    margin: '0 auto',
                    borderRadius: 12,
                    border: `1.2px solid ${ink}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: serif,
                    fontStyle: 'italic',
                    color: ink,
                    fontSize: 17,
                    background: paper,
                    position: 'relative',
                    zIndex: 2,
                  }}
                >
                  {index + 1}
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    color: ink,
                  }}
                >
                  {step.label}
                </div>
                <Anno style={{ display: 'block', marginTop: 4 }}>
                  {step.note}
                </Anno>
                {index < PIPELINE.length - 1 ? (
                  <svg
                    style={{
                      position: 'absolute',
                      top: 18,
                      left: '75%',
                      width: '50%',
                      height: 20,
                      color: sub,
                    }}
                    viewBox="0 0 100 20"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M2 10 C 25 4, 55 16, 92 10 M86 6 L94 10 L86 14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.1"
                      strokeLinecap="round"
                      opacity="0.55"
                    />
                  </svg>
                ) : null}
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 56,
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: 24,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                border: `1px dashed ${mute}`,
                borderRadius: 10,
                padding: 18,
                background: dark ? '#12141c' : '#fafbfd',
              }}
            >
              <Anno>input.txt</Anno>
              <div
                style={{
                  marginTop: 8,
                  fontFamily: serif,
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: ink,
                }}
              >
                "一只戴着眼镜的科研柴犬，正在白板前讲解 transformer
                注意力机制，画风简洁、线条干净。"
              </div>
            </div>
            <div style={{ color: sub, fontSize: 20 }}>⟶</div>
            <div
              style={{
                position: 'relative',
                border: `1px dashed ${mute}`,
                borderRadius: 10,
                padding: 18,
                background: dark ? '#12141c' : '#fafbfd',
                minHeight: 130,
              }}
            >
              <Anno>output · drawnix_scene.svg</Anno>
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginTop: 12,
                  flexWrap: 'wrap',
                }}
              >
                {['head', 'glasses', 'board', 'arrow', 'text'].map((token) => (
                  <div
                    key={token}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      border: `1px solid ${hair}`,
                      fontSize: 11,
                      color: ink,
                      fontFamily: serif,
                      fontStyle: 'italic',
                    }}
                  >
                    {'<'}path id="{token}" /{'>'}
                  </div>
                ))}
              </div>
              <Anno style={{ display: 'block', marginTop: 12 }}>
                5 paths · 已置入画布 · 可编辑
              </Anno>
            </div>
          </div>
          <SketchArrow
            style={{
              bottom: 24,
              right: 32,
              width: 180,
              height: 48,
              color: sub,
            }}
            d="M 10 36 C 40 24, 90 12, 170 14 M164 8 L172 14 L164 20"
            label="每一步都可以回看 / 重跑"
            labelX={16}
            labelY={48}
          />
        </div>
      </div>

      <div
        id="gallery"
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1160,
          margin: '0 auto',
          padding: '60px 32px 40px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 24,
          }}
        >
          <div>
            <Anno>03 · Gallery</Anno>
            <h2
              style={{
                margin: '6px 0 0',
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}
            >
              课题组最近画的
              <span style={{ fontFamily: serif, fontStyle: 'italic' }}>
                一些图
              </span>
            </h2>
          </div>
          <Anno>来自 autodraw jobs · 4 张 final.svg</Anno>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 14,
          }}
        >
          {GALLERY_ITEMS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`放大预览：${item.title}`}
              aria-haspopup="dialog"
              onClick={() => setPreviewItem(item)}
              style={{
                width: '100%',
                background: paper,
                border: `1px solid ${hair}`,
                borderRadius: 12,
                padding: 14,
                position: 'relative',
                overflow: 'hidden',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <div
                style={{
                  aspectRatio: '4 / 3',
                  borderRadius: 8,
                  border: `1px solid ${hair}`,
                  background: dark ? '#12141c' : '#f8fafc',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 10,
                }}
              >
                <img
                  src={item.src}
                  alt={item.title}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    objectFit: 'contain',
                    background: '#ffffff',
                  }}
                />
              </div>
              <Anno style={{ display: 'block', marginTop: 12 }}>
                sample_{String(index + 1).padStart(2, '0')}.svg
              </Anno>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 15,
                  fontWeight: 500,
                  color: ink,
                }}
              >
                {item.title}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: sub,
                }}
              >
                {item.subtitle}
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <Anno style={{ opacity: 0.72 }}>{item.note}</Anno>
                <Anno style={{ color: accent, opacity: 0.9 }}>
                  点击放大预览 ↗
                </Anno>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          marginTop: 60,
          padding: '32px',
          borderTop: `1px solid ${hair}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: 1160,
          marginInline: 'auto',
          fontSize: 13,
          color: sub,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <XaiMark size={16} color={sub} />
          <Anno>XAI Research Group · based on Drawnix · MIT</Anno>
        </div>
        <Anno>Draw Beyond, Rise Above.</Anno>
      </div>

      {previewItem ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={previewItem.title}
          onClick={() => setPreviewItem(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 30,
            background: dark ? 'rgba(15,17,21,0.82)' : 'rgba(15,23,42,0.48)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(1280px, 100%)',
              maxHeight: '100%',
              background: paper,
              border: `1px solid ${hair}`,
              borderRadius: 18,
              boxShadow: dark
                ? '0 24px 80px rgba(0,0,0,0.45)'
                : '0 24px 80px rgba(15,23,42,0.18)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                padding: '22px 24px 18px',
                borderBottom: `1px solid ${hair}`,
              }}
            >
              <div>
                <Anno>Preview · final.svg</Anno>
                <h3
                  style={{
                    margin: '8px 0 0',
                    fontSize: 24,
                    lineHeight: 1.2,
                    color: ink,
                  }}
                >
                  {previewItem.title}
                </h3>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: sub,
                  }}
                >
                  {previewItem.subtitle}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <a
                  href={previewItem.src}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    ...ghostBtn,
                    height: 38,
                    lineHeight: '36px',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  打开原图
                </a>
                <button
                  type="button"
                  aria-label="关闭预览"
                  style={{ ...primaryBtn, height: 38, padding: '0 18px' }}
                  onClick={() => setPreviewItem(null)}
                >
                  关闭
                </button>
              </div>
            </div>
            <div
              style={{
                padding: 24,
                background: dark ? '#12141c' : '#f8fafc',
                maxHeight: 'calc(100vh - 180px)',
                overflow: 'auto',
              }}
            >
              <img
                src={previewItem.src}
                alt={previewItem.title}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  background: '#ffffff',
                  borderRadius: 12,
                  border: `1px solid ${hair}`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FragmentWithArrow({
  children,
  isLast,
  color,
}: {
  children: ReactNode;
  isLast: boolean;
  color: string;
}) {
  return (
    <>
      {children}
      {isLast ? null : <span style={{ opacity: 0.5, color }}>→</span>}
    </>
  );
}

function SketchArrow({
  d,
  style,
  label,
  labelX = 6,
  labelY = -4,
  labelTextStyle,
}: SketchArrowProps) {
  return (
    <svg
      style={{
        position: 'absolute',
        overflow: 'visible',
        pointerEvents: 'none',
        ...style,
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      {label ? (
        <text
          x={labelX}
          y={labelY}
          fill="currentColor"
          opacity="0.6"
          style={{
            fontFamily: '"Songti SC","STSong",serif',
            fontStyle: 'italic',
            fontSize: 11,
            ...labelTextStyle,
          }}
        >
          {label}
        </text>
      ) : null}
    </svg>
  );
}

function XaiMark({
  size = 32,
  color = 'currentColor',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 800 800"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(0,800) scale(0.1,-0.1)" fill={color}>
        <path d="M2460 5913 c0 -5 397 -405 883 -891 l882 -882 57 57 58 58 -741 745 -740 745 438 5 438 5 3 83 3 82 -641 0 c-352 0 -640 -3 -640 -7z" />
        <path d="M4142 5853 c-35 -38 -151 -157 -260 -265 l-197 -198 55 -55 c30 -30 59 -55 65 -55 6 0 113 106 239 235 l228 235 211 0 212 0 -200 -202 c-110 -112 -274 -278 -365 -370 l-165 -168 60 -60 60 -61 83 88 c46 48 190 196 320 328 211 214 465 476 561 578 l35 37 -440 0 -440 0 -62 -67z" />
        <path d="M5215 3728 c-32 -17 -55 -51 -55 -81 -1 -93 98 -140 161 -78 48 49 38 125 -21 156 -34 18 -57 19 -85 3z" />
        <path d="M3374 3431 c-11 -5 -32 -24 -46 -42 -46 -62 -349 -414 -358 -417 -5 -2 -90 93 -190 210 -101 117 -191 221 -202 231 -32 27 -92 23 -117 -9 -40 -50 -31 -70 102 -226 67 -80 156 -185 198 -234 41 -49 79 -95 83 -101 6 -11 -106 -150 -341 -420 -46 -54 -63 -81 -63 -102 0 -43 9 -60 42 -77 58 -30 75 -17 245 184 185 218 233 272 242 272 3 -1 92 -102 196 -225 157 -186 196 -227 227 -236 31 -10 41 -9 63 5 30 20 47 58 40 89 -3 12 -98 129 -211 261 l-204 239 45 53 c25 30 66 80 93 112 26 31 49 59 53 62 3 3 53 63 112 133 88 105 107 134 107 161 0 54 -65 98 -116 77z" />
        <path d="M4153 3416 c-135 -31 -268 -128 -338 -248 -105 -178 -112 -441 -18 -638 144 -300 540 -393 810 -189 l53 40 0 -31 c0 -47 26 -99 55 -110 41 -15 54 -12 86 19 l29 29 0 542 0 541 -25 24 c-24 25 -65 32 -100 19 -22 -9 -45 -57 -45 -94 0 -16 -2 -30 -4 -30 -2 0 -33 20 -70 45 -37 24 -97 54 -134 66 -86 27 -217 33 -299 15z m264 -178 c58 -21 143 -92 179 -149 86 -138 87 -365 1 -512 -32 -53 -101 -118 -159 -148 -59 -31 -204 -39 -276 -15 -103 35 -200 132 -236 238 -37 110 -41 192 -14 313 50 231 281 356 505 273z" />
        <path d="M5205 3395 l-25 -24 0 -540 c0 -297 3 -547 6 -556 8 -19 55 -45 84 -45 11 0 32 11 45 25 l25 24 0 548 c0 301 -4 553 -8 559 -26 39 -93 44 -127 9z" />
      </g>
    </svg>
  );
}

function Anno({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: '"Songti SC","STSong",serif',
        fontStyle: 'italic',
        fontSize: 12,
        opacity: 0.58,
        letterSpacing: 0.2,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function SketchIcon({
  kind,
  size = 28,
  color = 'currentColor',
}: {
  kind: Feature['id'] | 'arrow';
  size?: number;
  color?: string;
}) {
  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (kind === 'freedraw') {
    return (
      <svg width={size} height={size} viewBox="0 0 28 28">
        <path
          {...common}
          d="M4 20 C 7 18, 9 14, 12 13 S 17 15, 19 12 S 22 6, 24 5"
        />
        <path {...common} d="M20 8 l3 -3 l1 1 l-3 3 z" />
      </svg>
    );
  }

  if (kind === 'autodraw') {
    return (
      <svg width={size} height={size} viewBox="0 0 28 28">
        <path {...common} d="M5 9 h8 M5 13 h5 M5 17 h7" />
        <path {...common} d="M16 6 l7 7 l-7 7 z" />
        <circle {...common} cx="19.5" cy="13" r="1.2" />
      </svg>
    );
  }

  if (kind === 'mermaid') {
    return (
      <svg width={size} height={size} viewBox="0 0 28 28">
        <rect {...common} x="4" y="5" width="7" height="5" rx="1" />
        <rect {...common} x="17" y="5" width="7" height="5" rx="1" />
        <rect {...common} x="10.5" y="18" width="7" height="5" rx="1" />
        <path
          {...common}
          d="M7.5 10 v4 c0 1 .5 1.5 1.5 1.5 h5 M20.5 10 v4 c0 1 -.5 1.5 -1.5 1.5 h-5"
        />
      </svg>
    );
  }

  if (kind === 'gallery') {
    return (
      <svg width={size} height={size} viewBox="0 0 28 28">
        <rect {...common} x="4" y="5" width="9" height="9" rx="1" />
        <rect {...common} x="15" y="5" width="9" height="9" rx="1" />
        <rect {...common} x="4" y="16" width="9" height="7" rx="1" />
        <rect {...common} x="15" y="16" width="9" height="7" rx="1" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 28 28">
      <path {...common} d="M5 14 h16 M17 9 l5 5 l-5 5" />
    </svg>
  );
}
