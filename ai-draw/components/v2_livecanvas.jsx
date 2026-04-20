function V2LiveCanvas({ dark }) {
  const bg = dark ? '#0a0b0f' : '#fafaf7';
  const paper = dark ? '#13151c' : '#ffffff';
  const ink = dark ? '#ececec' : '#0d0d0d';
  const sub = dark ? '#8a8f9c' : '#6b6b6b';
  const hair = dark ? '#262832' : '#e8e6df';
  const accent = dark ? '#c4b5fd' : '#6b4cff';
  const sans = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Helvetica Neue",Arial,sans-serif';
  const serif = '"Songti SC","STSong","Noto Serif CJK SC","Times New Roman",serif';

  const canvasRef = React.useRef(null);
  const [activeStage, setActiveStage] = React.useState(0);

  React.useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d');
    let w = c.width = c.offsetWidth * devicePixelRatio;
    let h = c.height = c.offsetHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const points = [];
    const onMove = (e) => { const r = c.getBoundingClientRect(); points.push({ x: e.clientX - r.left, y: e.clientY - r.top, life: 1 }); if (points.length > 80) points.shift(); };
    const onResize = () => { w = c.width = c.offsetWidth * devicePixelRatio; h = c.height = c.offsetHeight * devicePixelRatio; ctx.scale(devicePixelRatio, devicePixelRatio); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('resize', onResize);
    let raf;
    const loop = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1], p1 = points[i];
        const a = p1.life * 0.6;
        ctx.strokeStyle = dark ? `rgba(196,181,253,${a})` : `rgba(107,76,255,${a})`;
        ctx.lineWidth = 1.2 * p1.life; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        p1.life *= 0.965;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('mousemove', onMove); window.removeEventListener('resize', onResize); };
  }, [dark]);

  React.useEffect(() => {
    const t = setInterval(() => setActiveStage((s) => (s + 1) % PIPELINE.length), 1600);
    return () => clearInterval(t);
  }, []);

  const chipBtn = { height: 34, padding: '0 14px', borderRadius: 4, border: `1px solid ${hair}`, background: 'transparent', color: ink, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
  const kbd = { display: 'inline-block', padding: '1px 6px', borderRadius: 2, border: `1px solid ${hair}`, fontSize: 11, fontFamily: 'ui-monospace, monospace', color: sub, marginLeft: 2, marginRight: 2 };

  const Corner = ({ pos, flip = '' }) => {
    const fh = flip.includes('h') ? -1 : 1;
    const fv = flip.includes('v') ? -1 : 1;
    return (
      <svg style={{ position: 'fixed', width: 20, height: 20, color: sub, opacity: 0.35, zIndex: 3, ...pos }} viewBox="0 0 20 20">
        <g transform={`scale(${fh} ${fv}) translate(${fh < 0 ? -20 : 0}, ${fv < 0 ? -20 : 0})`}>
          <path d="M2 2 L12 2 M2 2 L2 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      </svg>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: bg, color: ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} />
      <Corner pos={{ top: 18, left: 18 }} />
      <Corner pos={{ top: 18, right: 18 }} flip="h" />
      <Corner pos={{ bottom: 18, left: 18 }} flip="v" />
      <Corner pos={{ bottom: 18, right: 18 }} flip="hv" />

      <div style={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <XaiMark size={22} color={ink} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>XAI Board</div>
          <Anno style={{ marginLeft: 8 }}>v0.4 · Dawn</Anno>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <button style={chipBtn}>GitHub</button>
          <button style={chipBtn}>文档</button>
          <button style={{ ...chipBtn, background: ink, color: bg, borderColor: ink }}>进入画板 →</button>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1280, margin: '0 auto', padding: '40px 40px 20px', minHeight: '70vh' }}>
        <Anno style={{ display: 'block' }}>// XAI 课题组 · 绘图工作台 · 实时直给</Anno>
        <h1 style={{ margin: '24px 0 0', fontSize: 'clamp(56px, 8vw, 112px)', lineHeight: 0.95, fontWeight: 500, letterSpacing: '-0.035em' }}>
          <span style={{ fontFamily: serif, fontStyle: 'italic' }}>Draw</span> <span style={{ opacity: 0.9 }}>beyond,</span>
          <br />
          <span style={{ fontFamily: serif, fontStyle: 'italic' }}>Rise</span> <span style={{ color: accent }}>above.</span>
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 80, marginTop: 60, alignItems: 'end' }}>
          <div>
            <p style={{ fontSize: 18, lineHeight: 1.7, color: sub, maxWidth: 540, margin: 0 }}>
              白板、思维导图、流程图、手绘——同一块画布。
              <br />
              <span style={{ color: ink }}>AutoDraw</span> 把一段文字变成可编辑的矢量，直接落回画布；SAM3 做实例分割，每一块都可以单独调整。
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 32, alignItems: 'center' }}>
              <button style={{ height: 48, padding: '0 24px', borderRadius: 4, background: ink, color: bg, border: 'none', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 0.2 }}>打开空白画布</button>
              <button style={{ height: 48, padding: '0 20px', borderRadius: 4, background: 'transparent', color: ink, border: `1px solid ${hair}`, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>▶ 看 AutoDraw</button>
            </div>
            <Anno style={{ display: 'block', marginTop: 18 }}>
              快捷键 · <kbd style={kbd}>N</kbd> 新建 · <kbd style={kbd}>A</kbd> AutoDraw · <kbd style={kbd}>M</kbd> Mermaid
            </Anno>
          </div>

          <div style={{ position: 'relative', background: paper, border: `1px solid ${hair}`, borderRadius: 6, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Anno>AutoDraw · live</Anno>
              <div style={{ display: 'flex', gap: 4 }}>
                {['#ff6b6b', '#ffd93d', '#6bcf7f'].map((c, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: 999, background: c, opacity: 0.75 }} />)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PIPELINE.map((p, i) => {
                const on = activeStage === i;
                const done = i < activeStage;
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: on ? (dark ? '#1d1f2a' : '#f4f2ec') : 'transparent', borderLeft: `2px solid ${on ? accent : (done ? ink : hair)}`, transition: 'background .3s, border-color .3s' }}>
                    <span style={{ width: 16, height: 16, borderRadius: 999, border: `1px solid ${on ? accent : (done ? ink : hair)}`, background: done ? ink : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: done ? bg : 'transparent' }}>{done ? '✓' : ''}</span>
                    <span style={{ fontSize: 13, color: ink, fontWeight: on ? 600 : 400, flex: 1 }}>{p.label}</span>
                    <Anno style={{ fontSize: 11 }}>{p.note}</Anno>
                  </div>
                );
              })}
            </div>
            <Anno style={{ display: 'block', marginTop: 12, fontSize: 11 }}>pipeline.run() · {PIPELINE[activeStage].label} ...</Anno>
          </div>
        </div>
      </div>

      <div id="features" style={{ position: 'relative', zIndex: 2, maxWidth: 1280, margin: '0 auto', padding: '100px 40px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 36 }}>
          <div>
            <Anno>§ MODULES</Anno>
            <h2 style={{ margin: '8px 0 0', fontSize: 44, fontWeight: 500, letterSpacing: '-0.02em' }}>
              四种工具 <span style={{ fontFamily: serif, fontStyle: 'italic', color: sub }}>· one canvas</span>
            </h2>
          </div>
          <Anno>点击卡片进入对应工作台 →</Anno>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
          {FEATURES.map((f, i) => <FeatureTile key={f.id} f={f} i={i} ink={ink} sub={sub} paper={paper} hair={hair} accent={accent} serif={serif} dark={dark} />)}
        </div>
      </div>

      <div id="pipeline" style={{ position: 'relative', zIndex: 2, maxWidth: 1280, margin: '0 auto', padding: '100px 40px 60px' }}>
        <Anno>§ AUTODRAW PIPELINE</Anno>
        <h2 style={{ margin: '8px 0 32px', fontSize: 44, fontWeight: 500, letterSpacing: '-0.02em' }}>
          文本 <span style={{ fontFamily: serif, fontStyle: 'italic' }}>in</span>，矢量 <span style={{ fontFamily: serif, fontStyle: 'italic' }}>out</span>
        </h2>
        <div style={{ position: 'relative', background: paper, border: `1px solid ${hair}`, borderRadius: 6, padding: '44px 32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PIPELINE.length}, 1fr)`, gap: 0, position: 'relative' }}>
            {PIPELINE.map((p, idx) => {
              const on = activeStage === idx;
              return (
                <div key={p.id} style={{ textAlign: 'center', position: 'relative' }}>
                  <div style={{ margin: '0 auto', width: 80, height: 80, borderRadius: 6, border: `1.2px solid ${on ? accent : ink}`, background: on ? (dark ? 'rgba(196,181,253,0.08)' : 'rgba(107,76,255,0.06)') : paper, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .3s', transform: on ? 'scale(1.05)' : 'scale(1)' }}>
                    <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 24, color: on ? accent : ink, fontWeight: 500 }}>{String(idx + 1).padStart(2, '0')}</div>
                  </div>
                  <div style={{ marginTop: 14, fontSize: 14, fontWeight: 600, color: on ? accent : ink, transition: 'color .3s' }}>{p.label}</div>
                  <Anno style={{ display: 'block', marginTop: 4 }}>{p.note}</Anno>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 56, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={{ padding: 20, borderTop: `1px solid ${hair}` }}>
              <Anno>INPUT · text</Anno>
              <div style={{ marginTop: 10, fontFamily: serif, fontSize: 15, lineHeight: 1.7, color: ink }}>"一张说明扩散模型从噪声到清晰图像的过程示意图，每一步用箭头连接，字体偏学术报告风格。"</div>
            </div>
            <div style={{ padding: 20, borderTop: `1px solid ${hair}`, position: 'relative' }}>
              <Anno>OUTPUT · drawnix</Anno>
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['noise', 'step_01', 'step_02', 'step_03', 'clean_img', 'arrow_01', 'arrow_02', 'arrow_03', 'label_t'].map((t) => (
                  <span key={t} style={{ padding: '3px 9px', borderRadius: 2, background: dark ? '#1d1f2a' : '#f4f2ec', fontSize: 11, color: ink, fontFamily: 'ui-monospace, monospace' }}>{t}</span>
                ))}
              </div>
              <Anno style={{ display: 'block', marginTop: 14 }}>9 paths · placed on canvas · selectable</Anno>
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1280, margin: '0 auto', padding: '40px 40px 80px' }}>
        <div style={{ padding: '48px 44px', border: `1.5px solid ${ink}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: paper, position: 'relative' }}>
          <div>
            <Anno>// ready when you are</Anno>
            <div style={{ marginTop: 10, fontSize: 36, fontWeight: 500, letterSpacing: '-0.02em' }}>打开画布，<span style={{ fontFamily: serif, fontStyle: 'italic' }}>开始画吧</span>。</div>
            <div style={{ marginTop: 8, color: sub, fontSize: 14 }}>无需登录 · 浏览器本地保存 · 导出 PNG / drawnix.json</div>
          </div>
          <button style={{ height: 56, padding: '0 32px', borderRadius: 0, background: ink, color: bg, border: 'none', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Open Canvas →</button>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, padding: '28px 40px', borderTop: `1px solid ${hair}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: sub }}>
        <Anno>XAI Research Group · based on Drawnix · MIT License · 2026</Anno>
        <Anno>按 ? 查看快捷键</Anno>
      </div>
    </div>
  );
}

function FeatureTile({ f, i, ink, sub, paper, hair, accent, serif, dark }) {
  const ref = React.useRef(null);
  const [prox, setProx] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const d = Math.hypot(e.clientX - cx, e.clientY - cy);
      setProx(Math.max(0, 1 - d / 400));
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative', background: paper, border: `1px solid ${hair}`, padding: '32px 28px 96px', minHeight: 260, cursor: 'pointer', transition: 'transform .3s, box-shadow .3s', transform: `translateY(${-prox * 4}px)`, boxShadow: prox > 0.1 ? `0 ${prox * 20}px ${prox * 50}px ${dark ? 'rgba(0,0,0,0.4)' : 'rgba(15,23,42,0.1)'}` : 'none', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
        <SketchIcon kind={f.id} size={26} color={ink} />
        <Anno>{String(i + 1).padStart(2, '0')} / 04</Anno>
      </div>
      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 36, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{f.zh}</div>
        <div style={{ fontFamily: serif, fontStyle: 'italic', color: sub, fontSize: 14, marginTop: 6 }}>{f.en}</div>
        <p style={{ marginTop: 18, fontSize: 14, lineHeight: 1.7, color: sub, maxWidth: 440 }}>{f.desc}</p>
      </div>
      {f.featured && <div style={{ position: 'absolute', top: 24, right: 72, fontSize: 11, letterSpacing: 1, color: accent, fontFamily: 'ui-monospace, monospace' }}>★ NEW · v0.4</div>}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '18px 28px', borderTop: `1px solid ${hair}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: prox > 0.25 ? ink : 'transparent', color: prox > 0.25 ? paper : ink, transition: 'background .25s, color .25s' }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{f.cta}</span>
        <span style={{ fontSize: 16, transform: `translateX(${prox * 6}px)`, transition: 'transform .2s' }}>→</span>
      </div>
    </div>
  );
}

window.V2LiveCanvas = V2LiveCanvas;
