import { useEffect, useState, type ReactNode } from 'react';
import styles from './docs-page.module.scss';

export type DocsPageProps = {
  onBackToLanding: () => void;
  onEnterBoard: () => void;
};

type SectionId =
  | 'quick-start'
  | 'board-basics'
  | 'ai-tools'
  | 'autodraw'
  | 'text-fidelity'
  | 'export'
  | 'faq';

type SectionNavItem = {
  id: SectionId;
  index: string;
  title: string;
  note: string;
};

type FeatureCard = {
  title: string;
  meta: string;
  body: string;
};

const SECTION_NAV: SectionNavItem[] = [
  {
    id: 'quick-start',
    index: '01',
    title: '快速开始',
    note: '第一次打开怎么走',
  },
  {
    id: 'board-basics',
    index: '02',
    title: '画板基础',
    note: '选择、绘制、编辑',
  },
  {
    id: 'ai-tools',
    index: '03',
    title: 'AI 工具',
    note: '生成结构和改图',
  },
  {
    id: 'autodraw',
    index: '04',
    title: 'AutoDraw',
    note: '从 prompt 到落板',
  },
  {
    id: 'text-fidelity',
    index: '05',
    title: '文字还原',
    note: '字体、字号、位置',
  },
  {
    id: 'export',
    index: '06',
    title: '保存与导出',
    note: 'JSON、SVG、PNG',
  },
  {
    id: 'faq',
    index: '07',
    title: '常见问题',
    note: '排查入口',
  },
];

const BOARD_TOOLS: FeatureCard[] = [
  {
    title: '选择与移动',
    meta: 'V / Hand',
    body: '用选择工具调整图元位置、尺寸和层级；需要浏览大画布时切到手形工具拖动画布。',
  },
  {
    title: '文本、形状、箭头',
    meta: 'T / R / A',
    body: '文本适合论文图注和模块说明，形状承载结构块，箭头负责表达流程方向。',
  },
  {
    title: '画笔、图片、图标库',
    meta: 'P / Cmd+U',
    body: '画笔适合临时标注，图片和图标库适合把外部素材快速放进画板并继续编辑。',
  },
  {
    title: '层级、复制、删除',
    meta: 'Popup toolbar',
    body: '选中图元后可以复制、删除、调整前后层级，避免背景层被普通操作误移。',
  },
];

const AI_TOOLS: FeatureCard[] = [
  {
    title: 'AutoDraw',
    meta: '实验室工作台',
    body: '输入方法描述或上传原图，跑完后把 SVG、文本、箭头和组件导入画板。',
  },
  {
    title: 'Auto-Mermaid',
    meta: '学术生成器',
    body: '先在本地整理结构意图，再一次性生成 Mermaid 候选并插入画板。',
  },
  {
    title: 'Mermaid / Markdown 到 Drawnix',
    meta: '更多工具',
    body: '已有 Mermaid 或 Markdown 内容时，可以直接转成 Drawnix 里的结构化图形。',
  },
  {
    title: 'AI 图片编辑',
    meta: '选中图片后使用',
    body: '对当前选中的图片发起改图任务，成功后原位替换，不会额外追加一张新图。',
  },
];

const AUTODRAW_STEPS = [
  '文本生成：输入方法描述、参考图和模型配置，先生成原始图。',
  '上传原图：已有论文图或草图时，可以跳过文生图，从后续阶段继续处理。',
  '标准解析：继续跑 SAM3、图标提取、去背景和 SVG 重建，适合需要拆组件的图。',
  '直接 SVG 重建：跳过分割，直接让多模态模型重建 final.svg，适合保留整体布局。',
  '本地 bundle.zip：已经拿到资源包时，直接导入前端，不需要重新创建后端任务。',
  '资产室和历史记录：查看 figure.png、组件图、final.svg，必要时下载 ZIP 或从某一步重跑。',
];

const TEXT_CHECKS = [
  '先看源数据：确认 scene.json 或 final.svg 是否带有 fontFamily、fontSize、lineHeight、letterSpacing、layout、anchor、baseline 和 rotation。',
  '再看导入映射：确认字段有没有被兜底覆盖、最小字号钳制或二次缩放。',
  '最后看画板渲染：确认 Drawnix 真正消费了这些文本字段，而不是只把字段写进数据。',
  '如果 native text 保真不足，复杂描边字、emoji 和装饰符号可以考虑走 svg-fragment-text。',
];

function scrollToSection(id: SectionId) {
  const target = document.getElementById(id);
  if (!target || typeof target.scrollIntoView !== 'function') {
    return;
  }
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function DocsPage({
  onBackToLanding,
  onEnterBoard,
}: DocsPageProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('quick-start');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const sections = SECTION_NAV.map((item) =>
      document.getElementById(item.id)
    ).filter((section): section is HTMLElement => Boolean(section));

    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) => right.intersectionRatio - left.intersectionRatio
          )[0];

        if (activeEntry?.target.id) {
          setActiveSection(activeEntry.target.id as SectionId);
        }
      },
      {
        rootMargin: '-18% 0px -64% 0px',
        threshold: [0.16, 0.32, 0.48],
      }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <main className={styles.docsPage}>
      <div className={styles.paperGrid} aria-hidden="true" />

      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <button
            type="button"
            className={styles.backButton}
            onClick={onBackToLanding}
          >
            <span aria-hidden="true">←</span>
            返回首页
          </button>
          <div className={styles.crumb}>
            <span>文档</span>
            <span className={styles.crumbSep}>/</span>
            <strong>XAI Board 使用手册</strong>
          </div>
        </div>
        <div className={styles.topbarRight}>
          <span className={styles.stateChip}>
            <span className={styles.stateDot} />
            新用户指南
          </span>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onEnterBoard}
          >
            进入画板
          </button>
        </div>
      </header>

      <div className={styles.hero}>
        <span className={styles.kicker}>manual · 2026 spring</span>
        <h1>XAI Board 使用手册</h1>
        <p>
          给第一次上手的课题组成员。先学会画板，再用 AutoDraw 把方法描述、
          原始图或 bundle.zip 落到画布里。
        </p>
        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => scrollToSection('quick-start')}
          >
            从快速开始读起
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => scrollToSection('autodraw')}
          >
            直接看 AutoDraw
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        <aside className={styles.toc} aria-label="文档目录">
          <div className={styles.tocTab} aria-hidden="true">
            目录
          </div>
          <div className={styles.tocHead}>
            <span>目录</span>
            <em>sections</em>
          </div>
          <div className={styles.tocList}>
            {SECTION_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.tocItem} ${
                  activeSection === item.id ? styles.tocItemActive : ''
                }`}
                onClick={() => scrollToSection(item.id)}
              >
                <span>{item.index}</span>
                <strong>{item.title}</strong>
                <em>{item.note}</em>
              </button>
            ))}
          </div>
        </aside>

        <article className={styles.content}>
          <ManualSection id="quick-start" index="01" title="快速开始">
            <div className={styles.stepGrid}>
              <StepCard
                index="1"
                title="从首页进入画板"
                body="点击“进入画板”。想先熟悉功能，直接打开空白画布。"
              />
              <StepCard
                index="2"
                title="创建第一组内容"
                body="用文本、形状和箭头搭骨架，再加入图片、图标或手写标注。"
              />
              <StepCard
                index="3"
                title="保存或导出"
                body="保存 JSON 继续编辑，导出 SVG、PNG 或 JPG 用于论文和汇报。"
              />
            </div>
          </ManualSection>

          <ManualSection id="board-basics" index="02" title="画板基础">
            <p>
              先选工具，再在画布上落图元。移动、缩放、复制、删除和属性修改，
              都围绕当前选区完成。
            </p>
            <CardGrid items={BOARD_TOOLS} />
          </ManualSection>

          <ManualSection id="ai-tools" index="03" title="AI 工具">
            <p>
              AI 工具负责把文本、结构和图片转成可编辑内容。生成只是起点，
              后续还要在画板里继续修。
            </p>
            <CardGrid items={AI_TOOLS} />
          </ManualSection>

          <ManualSection
            id="autodraw"
            index="04"
            title="AutoDraw：从方法描述到可编辑画板"
          >
            <figure className={styles.figure}>
              <img
                src="/docs/autodraw-workbench.png"
                alt="AutoDraw 实验室工作台界面截图"
                width="2702"
                height="1536"
                loading="lazy"
              />
              <figcaption>
                AutoDraw 工作台由左侧输入区、中间 Pipeline、落板预览、资产室、
                过程活动和历史记录组成。任务完成后，导入监视器会收边停靠，方便你直接看落板结果。
              </figcaption>
            </figure>
            <div className={styles.callout}>
              <strong>推荐路径</strong>
              <p>
                新用户先用“文本生成”跑一次完整流程。已有原图时再试“上传原图”，
                已经拿到资源包时直接导入 bundle.zip。
              </p>
            </div>
            <ul className={styles.checkList}>
              {AUTODRAW_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </ManualSection>

          <ManualSection
            id="text-fidelity"
            index="05"
            title="文字还原：先看源数据，再看导入，再看渲染"
          >
            <p>
              当前阶段最重要的是 autodraw 到 Drawnix
              画板的文字还原。遇到字号变大、
              字体不对或位置漂移时，不要先叠经验值，先按下面顺序排查。
            </p>
            <ul className={styles.checkList}>
              {TEXT_CHECKS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className={styles.notePanel}>
              <span>scene-import / svg-import fallback</span>
              <p>
                主链路优先读 scene.json。ZIP 里没有 scene.json 时会退回 SVG
                导入，
                两条链路都要保留最小回归验证，尤其是小字号正文、注释和标题。
              </p>
            </div>
          </ManualSection>

          <ManualSection id="export" index="06" title="保存与导出">
            <div className={styles.stepGrid}>
              <StepCard
                index="A"
                title="保存 JSON"
                body="用于继续编辑，保留 Drawnix 图元、视口和主题信息。快捷键是 Cmd/Ctrl + S。"
              />
              <StepCard
                index="B"
                title="导出图片"
                body="导出 SVG、PNG 或 JPG。论文图优先选 SVG，需要贴到文档或幻灯片时再用 PNG。"
              />
              <StepCard
                index="C"
                title="清除画布"
                body="清除前会弹确认框。这个操作会删除当前画布内容，不会删除后端任务历史。"
              />
            </div>
          </ManualSection>

          <ManualSection id="faq" index="07" title="常见问题">
            <div className={styles.faqList}>
              <FaqItem
                question="AutoDraw 后端地址填什么？"
                answer="本地开发默认看当前后端配置。截图里的例子是 127.0.0.1:8001，实际以你启动的后端端口为准。"
              />
              <FaqItem
                question="API Key 要写进代码吗？"
                answer="不要。需要密钥时通过环境变量或界面输入，不提交到仓库。"
              />
              <FaqItem
                question="导入后文字位置不对怎么办？"
                answer="先检查 bundle 里的 scene.json 和 final.svg 是否有字体、字号、文本框、锚点、基线和旋转信息，再判断是导入映射还是画板渲染的问题。"
              />
              <FaqItem
                question="AI 图片编辑提示没有目标图片？"
                answer="回到画板重新选中一张图片后再打开 AI 编辑。这个功能只会替换当前选中的图片。"
              />
            </div>
          </ManualSection>
        </article>
      </div>
    </main>
  );
}

function ManualSection({
  id,
  index,
  title,
  children,
}: {
  id: SectionId;
  index: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.section}>
      <div className={styles.sectionHead}>
        <span>{index}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StepCard({
  index,
  title,
  body,
}: {
  index: string;
  title: string;
  body: string;
}) {
  return (
    <div className={styles.stepCard}>
      <span>{index}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function CardGrid({ items }: { items: FeatureCard[] }) {
  return (
    <div className={styles.cardGrid}>
      {items.map((item) => (
        <div className={styles.featureCard} key={item.title}>
          <span>{item.meta}</span>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </div>
      ))}
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className={styles.faqItem}>
      <h3>{question}</h3>
      <p>{answer}</p>
    </div>
  );
}
