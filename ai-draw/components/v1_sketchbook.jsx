function V1Sketchbook({ dark }) {
  const bg = dark ? '#0f1115' : '#f7f8fb';
  const paper = dark ? '#161923' : '#ffffff';
  const ink = dark ? '#e7e9ee' : '#111827';
  const sub = dark ? '#8e95a4' : '#667085';
  const mute = dark ? '#4b5260' : '#d0d5dd';
  const hair = dark ? '#242834' : '#e4e7ec';
  const accent = dark ? '#9ca3ff' : '#2563eb';
  const sans = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Helvetica Neue",Arial,sans-serif';
  const serif = '"Songti SC","STSong","Noto Serif CJK SC","Times New Roman",serif';
  const [hover, setHover] = React.useState(null);

  const linkStyle = { color: ink, textDecoration: 'none', opacity: 0.7 };
  const ghostBtn = { height: 34, padding: '0 14px', borderRadius: 999, border: `1px solid ${mute}`, background: paper, color: ink, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
  const primaryBtn = { height: 34, padding: '0 16px', borderRadius: 999, background: dark ? paper : '#111827', color: dark ? '#111827' : '#ffffff', border: 'none', fontSize: 13, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' };
  const kbd = { display: 'inline-block', padding: '1px 6px', borderRadius: 4, border: `1px solid ${hair}`, fontSize: 11, fontFamily: 'ui-monospace, monospace', color: sub };

  return (
    <div style={{ minHeight: '100vh', background: bg, color: ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `linear-gradient(${hair} 1px, transparent 1px), linear-gradient(90deg, ${hair} 1px, transparent 1px)`, backgroundSize: '48px 48px', opacity: dark ? 0.18 : 0.35, maskImage: 'radial-gradient(ellipse at 50% 30%, black 30%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 30%, black 30%, transparent 75%)' }} />

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', borderBottom: `1px solid ${hair}`, background: dark ? 'rgba(15,17,21,0.7)' : 'rgba(247,248,251,0.7)', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <XaiMark size={22} color={ink} />
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.3 }}>XAI Board</div>
          <Anno style={{ marginLeft: 10 }}>XAI 课题组 · 绘图工作台</Anno>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: sub }}>
          <a style={linkStyle} href="#features">功能</a>
          <a style={linkStyle} href="#pipeline">AutoDraw</a>
          <a style={linkStyle} href="#gallery">画廊</a>
          <a style={linkStyle} href="#docs">文档</a>
          <button style={ghostBtn}>登录</button>
          <button style={primaryBtn}>进入画板 →</button>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1160, margin: '0 auto', padding: '80px 32px 40px' }}>
        <Anno style={{ fontSize: 13 }}>v0.4 · Dawn (破晓) · 2026 Spring</Anno>
        <h1 style={{ margin: '18px 0 0', fontSize: 'clamp(48px, 6.2vw, 84px)', lineHeight: 1.02, fontWeight: 600, letterSpacing: '-0.02em', color: ink }}>
          把想法
          <span style={{ position: 'relative', display: 'inline-block', margin: '0 10px' }}>
            <span style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 500 }}>画出来</span>
            <svg className="sketch-underline" style={{ position: 'absolute', left: -6, right: -6, bottom: -10, width: 'calc(100% + 12px)', height: 18 }} viewBox="0 0 220 18" preserveAspectRatio="none">
              <path d="M2 12 C 40 4, 80 16, 120 8 S 200 14, 218 6" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </span>
          <br />
          再让 AI 把它
          <span style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 500, color: accent, marginLeft: 10 }}>落到画布上</span>
          。
        </h1>
        <p style={{ marginTop: 28, maxWidth: 640, fontSize: 17, lineHeight: 1.65, color: sub }}>
          XAI Board 是课题组的日常绘图工作台。白板、思维导图、流程图、手绘，全部一体化。
          <br />
          新内置的 <b style={{ color: ink }}>AutoDraw</b> 让你从一段文本直接产出可编辑的矢量图元——
          <Anno>文本 → 扩散 → SAM3 → 抠图 → SVG → 画布</Anno>。
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 36, alignItems: 'center' }}>
          <button style={{ ...primaryBtn, height: 46, padding: '0 22px', fontSize: 15 }}>打开空白画布 →</button>
          <button style={{ ...ghostBtn, height: 46, padding: '0 22px', fontSize: 14 }}>▶ 看 90 秒演示</button>
          <Anno style={{ marginLeft: 6 }}>或按 <kbd style={kbd}>N</kbd> 新建</Anno>
        </div>
        <SketchArrow style={{ top: 48, right: 48, width: 180, height: 80, color: sub }} d="M 170 10 C 150 20, 110 28, 60 60 L 40 72 M 46 62 L 40 72 L 50 72" label="AutoDraw 在这里 →" />
        <SketchArrow style={{ bottom: -30, left: 80, width: 160, height: 60, color: sub }} d="M 20 40 C 40 20, 80 8, 140 14 M 134 8 L 142 14 L 134 20" label="四大模块 ↓" labelStyle={{ x: '30', y: '54' }} />
      </div>

      <div id="features" style={{ position: 'relative', zIndex: 2, maxWidth: 1160, margin: '0 auto', padding: '60px 32px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <Anno>01 · Modules</Anno>
            <h2 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em' }}>
              四种工作方式，<span style={{ fontFamily: serif, fontStyle: 'italic', color: sub }}>同一块画布</span>
            </h2>
          </div>
          <Anno>hover 查看示例 →</Anno>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
          {FEATURES.map((f, i) => {
            const span = f.featured ? 6 : (i === 0 ? 6 : (i === 2 ? 5 : 7));
            const isHover = hover === f.id;
            return (
              <div key={f.id} onMouseEnter={() => setHover(f.id)} onMouseLeave={() => setHover(null)} style={{ gridColumn: `span ${span}`, background: paper, border: `1px solid ${isHover ? ink : hair}`, borderRadius: 14, padding: f.featured ? '28px 28px 24px' : '22px 22px 20px', minHeight: f.featured ? 280 : 200, position: 'relative', cursor: 'pointer', transition: 'border-color .25s, transform .25s, box-shadow .25s', transform: isHover ? 'translateY(-3px)' : 'translateY(0)', boxShadow: isHover ? (dark ? '0 18px 50px rgba(0,0,0,0.4)' : '0 18px 50px rgba(15,23,42,0.10)') : 'none', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: ink }}>
                    <SketchIcon kind={f.id} size={22} color={ink} />
                    <Anno>{String(i + 1).padStart(2, '0')} / {f.meta}</Anno>
                  </div>
                  {f.featured && <Anno style={{ color: accent }}>★ NEW</Anno>}
                </div>
                <div style={{ marginTop: f.featured ? 18 : 14 }}>
                  <div style={{ fontSize: f.featured ? 28 : 22, fontWeight: 600, letterSpacing: '-0.01em' }}>{f.zh}</div>
                  <div style={{ fontFamily: serif, fontStyle: 'italic', color: sub, fontSize: 13, marginTop: 4 }}>{f.en}</div>
                  <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.65, color: sub, maxWidth: 480 }}>{f.desc}</p>
                </div>
                {f.featured && (
                  <div style={{ marginTop: 22, padding: '14px 16px', border: `1px dashed ${mute}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12, color: sub }}>
                    {PIPELINE.map((p, idx) => (
                      <React.Fragment key={p.id}>
                        <span style={{ color: ink, fontWeight: 500 }}>{p.label}</span>
                        {idx < PIPELINE.length - 1 && <span style={{ opacity: 0.5 }}>→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 20, right: 22, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: isHover ? accent : sub, transition: 'color .2s, transform .2s', transform: isHover ? 'translateX(4px)' : 'translateX(0)' }}>
                  {f.cta}
                  <SketchIcon kind="arrow" size={18} color={isHover ? accent : sub} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div id="pipeline" style={{ position: 'relative', zIndex: 2, maxWidth: 1160, margin: '0 auto', padding: '80px 32px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 40 }}>
          <div>
            <Anno>02 · AutoDraw Pipeline</Anno>
            <h2 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em' }}>
              从一段<span style={{ fontFamily: serif, fontStyle: 'italic' }}>总结文本</span>，到一组可编辑<span style={{ fontFamily: serif, fontStyle: 'italic' }}>矢量图元</span>
            </h2>
          </div>
          <button style={ghostBtn}>查看示例输出 ↗</button>
        </div>
        <div style={{ position: 'relative', background: paper, border: `1px solid ${hair}`, borderRadius: 14, padding: '48px 32px 56px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PIPELINE.length}, 1fr)`, gap: 0, alignItems: 'start' }}>
            {PIPELINE.map((p, idx) => (
              <div key={p.id} style={{ position: 'relative', textAlign: 'center', padding: '0 8px' }}>
                <div style={{ width: 52, height: 52, margin: '0 auto', borderRadius: 12, border: `1.2px solid ${ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontStyle: 'italic', color: ink, fontSize: 17, background: paper, position: 'relative', zIndex: 2 }}>{idx + 1}</div>
                <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: ink }}>{p.label}</div>
                <Anno style={{ display: 'block', marginTop: 4 }}>{p.note}</Anno>
                {idx < PIPELINE.length - 1 && (
                  <svg style={{ position: 'absolute', top: 18, left: '75%', width: '50%', height: 20, color: sub }} viewBox="0 0 100 20" preserveAspectRatio="none">
                    <path d="M2 10 C 25 4, 55 16, 92 10 M86 6 L94 10 L86 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.55" />
                  </svg>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 56, display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 24, alignItems: 'center' }}>
            <div style={{ border: `1px dashed ${mute}`, borderRadius: 10, padding: 18, background: dark ? '#12141c' : '#fafbfd' }}>
              <Anno>input.txt</Anno>
              <div style={{ marginTop: 8, fontFamily: serif, fontSize: 14, lineHeight: 1.65, color: ink }}>"一只戴着眼镜的科研柴犬，正在白板前讲解 transformer 注意力机制，画风简洁、线条干净，可爱但不幼稚。"</div>
            </div>
            <div style={{ color: sub, fontSize: 20 }}>⟶</div>
            <div style={{ position: 'relative', border: `1px dashed ${mute}`, borderRadius: 10, padding: 18, background: dark ? '#12141c' : '#fafbfd', minHeight: 130 }}>
              <Anno>output · drawnix_scene.svg</Anno>
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                {['head', 'glasses', 'board', 'arrow', 'text'].map((t) => (
                  <div key={t} style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${hair}`, fontSize: 11, color: ink, fontFamily: serif, fontStyle: 'italic' }}>‹path id="{t}" /›</div>
                ))}
              </div>
              <Anno style={{ display: 'block', marginTop: 12 }}>5 paths · 已置入画布 · 可编辑</Anno>
            </div>
          </div>
          <SketchArrow style={{ bottom: 24, right: 32, width: 180, height: 48, color: sub }} d="M 10 36 C 40 24, 90 12, 170 14 M164 8 L172 14 L164 20" label="每一步都可以回看 / 重跑" labelStyle={{ x: '16', y: '48' }} />
        </div>
      </div>

      <div id="gallery" style={{ position: 'relative', zIndex: 2, maxWidth: 1160, margin: '0 auto', padding: '60px 32px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <Anno>03 · Gallery</Anno>
            <h2 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em' }}>
              课题组最近画的<span style={{ fontFamily: serif, fontStyle: 'italic' }}>一些东西</span>
            </h2>
          </div>
          <Anno>共 248 张 · 本周 +12</Anno>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {['Transformer 注意力', '扩散模型流程', '实验配置树', '消融实验表格'].map((t, i) => (
            <div key={t} style={{ aspectRatio: '4/3', background: paper, border: `1px solid ${hair}`, borderRadius: 12, padding: 14, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 10, borderRadius: 8, background: `repeating-linear-gradient(${45 + i * 30}deg, ${hair} 0, ${hair} 1px, transparent 1px, transparent 10px)`, opacity: 0.6 }} />
              <Anno style={{ position: 'relative' }}>sample_{String(i + 1).padStart(2, '0')}.drawnix</Anno>
              <div style={{ position: 'absolute', bottom: 12, left: 14, right: 14, fontSize: 13, color: ink, fontWeight: 500 }}>{t}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, marginTop: 60, padding: '32px', borderTop: `1px solid ${hair}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1160, margin: '60px auto 0', fontSize: 13, color: sub }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <XaiMark size={16} color={sub} />
          <Anno>XAI Research Group · based on Drawnix · MIT</Anno>
        </div>
        <Anno>Draw Beyond, Rise Above.</Anno>
      </div>

      <style>{`.sketch-underline path { stroke-dasharray: 400; stroke-dashoffset: 400; animation: draw 1.4s cubic-bezier(.4,.2,.2,1) .4s forwards; } @keyframes draw { to { stroke-dashoffset: 0; } }`}</style>
    </div>
  );
}
window.V1Sketchbook = V1Sketchbook;
