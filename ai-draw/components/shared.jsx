const FEATURES = [
  { id: 'freedraw', zh: '自由画板', en: 'Free Draw', desc: '手绘、涂鸦、手写笔记。无限画布，流畅手感。', meta: '手绘 · 涂鸦 · 手写', cta: '开始画' },
  { id: 'autodraw', zh: 'AutoDraw', en: 'AI 图生图 · 垫图', desc: '文本 → 图片 → SAM3 分割 → 去背景 → SVG → 落盘。一键进入画布。', meta: 'AI Pipeline', cta: '运行 Pipeline', featured: true },
  { id: 'mermaid', zh: 'Mermaid 思维导图', en: 'Mind Map & Mermaid', desc: 'Markdown / Mermaid 语法一键生成结构化图形。', meta: '导图 · 流程图', cta: '写语法' },
  { id: 'gallery', zh: '模板库', en: 'Templates & Gallery', desc: '课题组示例画廊与可复用模板，从空白到成稿少走弯路。', meta: '示例 · 模板', cta: '浏览画廊' },
];
const PIPELINE = [
  { id: 'text', label: '文本输入', note: '课题摘要 / prompt' },
  { id: 't2i', label: '文生图', note: '扩散模型' },
  { id: 'sam', label: 'SAM3 分割', note: '实例掩码' },
  { id: 'matting', label: '去背景', note: 'alpha 抠图' },
  { id: 'svg', label: '矢量化', note: '路径化为 SVG' },
  { id: 'board', label: '导入画板', note: '可编辑图元' },
];

function SketchArrow({ d, style, label, labelStyle }) {
  return (
    <svg style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none', ...style }} xmlns="http://www.w3.org/2000/svg">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      {label && <text x="6" y="-4" fill="currentColor" opacity="0.6" style={{ fontFamily: '"Songti SC","STSong",serif', fontStyle: 'italic', fontSize: 11, ...labelStyle }}>{label}</text>}
    </svg>
  );
}

function XaiMark({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(0,800) scale(0.1,-0.1)" fill={color}>
        <path d="M2460 5913 c0 -5 397 -405 883 -891 l882 -882 57 57 58 58 -741 745 -740 745 438 5 438 5 3 83 3 82 -641 0 c-352 0 -640 -3 -640 -7z"/>
        <path d="M4142 5853 c-35 -38 -151 -157 -260 -265 l-197 -198 55 -55 c30 -30 59 -55 65 -55 6 0 113 106 239 235 l228 235 211 0 212 0 -200 -202 c-110 -112 -274 -278 -365 -370 l-165 -168 60 -60 60 -61 83 88 c46 48 190 196 320 328 211 214 465 476 561 578 l35 37 -440 0 -440 0 -62 -67z"/>
        <path d="M5215 3728 c-32 -17 -55 -51 -55 -81 -1 -93 98 -140 161 -78 48 49 38 125 -21 156 -34 18 -57 19 -85 3z"/>
        <path d="M3374 3431 c-11 -5 -32 -24 -46 -42 -46 -62 -349 -414 -358 -417 -5 -2 -90 93 -190 210 -101 117 -191 221 -202 231 -32 27 -92 23 -117 -9 -40 -50 -31 -70 102 -226 67 -80 156 -185 198 -234 41 -49 79 -95 83 -101 6 -11 -106 -150 -341 -420 -46 -54 -63 -81 -63 -102 0 -43 9 -60 42 -77 58 -30 75 -17 245 184 185 218 233 272 242 272 3 -1 92 -102 196 -225 157 -186 196 -227 227 -236 31 -10 41 -9 63 5 30 20 47 58 40 89 -3 12 -98 129 -211 261 l-204 239 45 53 c25 30 66 80 93 112 26 31 49 59 53 62 3 3 53 63 112 133 88 105 107 134 107 161 0 54 -65 98 -116 77z"/>
        <path d="M4153 3416 c-135 -31 -268 -128 -338 -248 -105 -178 -112 -441 -18 -638 144 -300 540 -393 810 -189 l53 40 0 -31 c0 -47 26 -99 55 -110 41 -15 54 -12 86 19 l29 29 0 542 0 541 -25 24 c-24 25 -65 32 -100 19 -22 -9 -45 -57 -45 -94 0 -16 -2 -30 -4 -30 -2 0 -33 20 -70 45 -37 24 -97 54 -134 66 -86 27 -217 33 -299 15z m264 -178 c58 -21 143 -92 179 -149 86 -138 87 -365 1 -512 -32 -53 -101 -118 -159 -148 -59 -31 -204 -39 -276 -15 -103 35 -200 132 -236 238 -37 110 -41 192 -14 313 50 231 281 356 505 273z"/>
        <path d="M5205 3395 l-25 -24 0 -540 c0 -297 3 -547 6 -556 8 -19 55 -45 84 -45 11 0 32 11 45 25 l25 24 0 548 c0 301 -4 553 -8 559 -26 39 -93 44 -127 9z"/>
      </g>
    </svg>
  );
}

function Anno({ children, style }) {
  return <span style={{ fontFamily: '"Songti SC","STSong",serif', fontStyle: 'italic', fontSize: 12, opacity: 0.58, letterSpacing: 0.2, ...style }}>{children}</span>;
}

function SketchIcon({ kind, size = 28, color = 'currentColor' }) {
  const c = { fill: 'none', stroke: color, strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (kind === 'freedraw') return <svg width={size} height={size} viewBox="0 0 28 28"><path {...c} d="M4 20 C 7 18, 9 14, 12 13 S 17 15, 19 12 S 22 6, 24 5"/><path {...c} d="M20 8 l3 -3 l1 1 l-3 3 z"/></svg>;
  if (kind === 'autodraw') return <svg width={size} height={size} viewBox="0 0 28 28"><path {...c} d="M5 9 h8 M5 13 h5 M5 17 h7"/><path {...c} d="M16 6 l7 7 l-7 7 z"/><circle {...c} cx="19.5" cy="13" r="1.2"/></svg>;
  if (kind === 'mermaid') return <svg width={size} height={size} viewBox="0 0 28 28"><rect {...c} x="4" y="5" width="7" height="5" rx="1"/><rect {...c} x="17" y="5" width="7" height="5" rx="1"/><rect {...c} x="10.5" y="18" width="7" height="5" rx="1"/><path {...c} d="M7.5 10 v4 c0 1 .5 1.5 1.5 1.5 h5 M20.5 10 v4 c0 1 -.5 1.5 -1.5 1.5 h-5"/></svg>;
  if (kind === 'gallery') return <svg width={size} height={size} viewBox="0 0 28 28"><rect {...c} x="4" y="5" width="9" height="9" rx="1"/><rect {...c} x="15" y="5" width="9" height="9" rx="1"/><rect {...c} x="4" y="16" width="9" height="7" rx="1"/><rect {...c} x="15" y="16" width="9" height="7" rx="1"/></svg>;
  if (kind === 'arrow') return <svg width={size} height={size} viewBox="0 0 28 28"><path {...c} d="M5 14 h16 M17 9 l5 5 l-5 5"/></svg>;
  return null;
}

Object.assign(window, { FEATURES, PIPELINE, SketchArrow, XaiMark, Anno, SketchIcon });
