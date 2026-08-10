// Logo explorations — 5 directions, all rooted in "clarity = focused attention".
// Each card is a small artboard: mark, wordmark lockup, concept note.

const LogoCard = ({ name, concept, children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.paper, color: t.ink,
      fontFamily: t.fontUI,
      display: 'grid',
      gridTemplateRows: '1fr auto auto',
      padding: 28,
      boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: t.paperSubtle, borderRadius: t.r10,
        minHeight: 0,
      }}>{children}</div>

      <div style={{ marginTop: 18, fontSize: 14, fontWeight: 500 }}>{name}</div>
      <div style={{ marginTop: 4, fontFamily: t.fontMono, fontSize: 11, color: t.ink60, lineHeight: 1.45 }}>{concept}</div>
    </div>
  );
};

// 01 — Pure wordmark. The "i" dot is the accent — the one thing in focus today.
const Logo01 = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
      <span style={{ fontFamily: t.fontUI, fontSize: 80, fontWeight: 500, letterSpacing: '-0.045em', color: t.ink }}>clar</span>
      <span style={{ fontFamily: t.fontUI, fontSize: 80, fontWeight: 500, letterSpacing: '-0.045em', color: t.ink, position: 'relative' }}>
        <span style={{ visibility: 'hidden' }}>i</span>
        {/* custom dotted i: stem + accent dot */}
        <span style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          bottom: 0, top: '32%', width: 6, background: t.ink, borderRadius: 1,
        }}></span>
        <span style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          top: '8%', width: 12, height: 12, background: t.accent, borderRadius: '50%',
        }}></span>
      </span>
      <span style={{ fontFamily: t.fontUI, fontSize: 80, fontWeight: 500, letterSpacing: '-0.045em', color: t.ink }}>ty</span>
    </div>
  );
};

// 02 — Aperture / concentric rings forming a C. Calm, precise, focus metaphor.
const Logo02 = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <svg width="92" height="92" viewBox="0 0 92 92" fill="none" aria-hidden="true">
        {/* Outer ring open at right (C-shape) */}
        <path d="M46 8 A38 38 0 1 0 78 65" stroke={t.ink} strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <path d="M46 22 A24 24 0 1 0 66 58" stroke={t.ink} strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <circle cx="46" cy="46" r="6" fill={t.accent} />
      </svg>
      <div style={{ fontFamily: t.fontUI, fontSize: 28, fontWeight: 500, letterSpacing: '-0.04em', color: t.ink }}>clarity</div>
    </div>
  );
};

// 03 — Focal dot. A thin circle holding a single filled dot — the task in focus.
const Logo03 = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <svg width="86" height="86" viewBox="0 0 86 86" fill="none" aria-hidden="true">
        <circle cx="43" cy="43" r="40" stroke={t.ink} strokeWidth="2.4" fill="none" />
        <circle cx="43" cy="43" r="9" fill={t.accent} />
      </svg>
      <div style={{ fontFamily: t.fontUI, fontSize: 28, fontWeight: 500, letterSpacing: '-0.04em', color: t.ink }}>clarity</div>
    </div>
  );
};

// 04 — Lens / vesica. Two arcs overlap to form a lens — clarity through optics.
const Logo04 = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <svg width="100" height="86" viewBox="0 0 100 86" fill="none" aria-hidden="true">
        <path d="M14 43 A40 40 0 0 1 86 43 A40 40 0 0 1 14 43 Z" stroke={t.ink} strokeWidth="2.4" fill={t.paper} />
        <path d="M14 43 A40 40 0 0 1 86 43" stroke={t.ink} strokeWidth="2.4" fill="none" />
        <circle cx="50" cy="43" r="5" fill={t.accent} />
      </svg>
      <div style={{ fontFamily: t.fontUI, fontSize: 28, fontWeight: 500, letterSpacing: '-0.04em', color: t.ink }}>clarity</div>
    </div>
  );
};

// 05 — Reduced list. Three rules, the top one highlighted. Task-list essence.
const Logo05 = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <svg width="92" height="68" viewBox="0 0 92 68" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="6" fill={t.accent} />
        <line x1="24" y1="10" x2="86" y2="10" stroke={t.ink} strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="10" cy="34" r="5" stroke={t.ink} strokeWidth="2" fill="none" />
        <line x1="24" y1="34" x2="74" y2="34" stroke={t.ink} strokeWidth="2.4" strokeLinecap="round" opacity="0.45" />
        <circle cx="10" cy="58" r="5" stroke={t.ink} strokeWidth="2" fill="none" />
        <line x1="24" y1="58" x2="62" y2="58" stroke={t.ink} strokeWidth="2.4" strokeLinecap="round" opacity="0.25" />
      </svg>
      <div style={{ fontFamily: t.fontUI, fontSize: 28, fontWeight: 500, letterSpacing: '-0.04em', color: t.ink }}>clarity</div>
    </div>
  );
};

// Aperture mark — single source of truth. Stroke + accent dot scale together.
// `s` = svg size in px. Strokes are derived so the mark holds at 14 → 128px.
const ApertureMark = ({ s = 64, ink, accent, bg }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const inkColor = ink || t.ink;
  const accentColor = accent || t.accent;
  const stroke1 = Math.max(1.5, s * 0.038);
  const stroke2 = Math.max(1.2, s * 0.032);
  const dot = Math.max(2, s * 0.08);
  return (
    <svg width={s} height={s} viewBox="0 0 92 92" fill="none" aria-hidden="true" style={{ background: bg || 'transparent', borderRadius: bg ? s * 0.22 : 0 }}>
      <path d="M46 8 A38 38 0 1 0 78 65" stroke={inkColor} strokeWidth={stroke1 * (92 / s)} strokeLinecap="round" fill="none" />
      <path d="M46 22 A24 24 0 1 0 66 58" stroke={inkColor} strokeWidth={stroke2 * (92 / s)} strokeLinecap="round" fill="none" />
      <circle cx="46" cy="46" r={dot * (92 / s) / 2 * 1.6} fill={accentColor} />
    </svg>
  );
};

// Lockup card — full study of the Aperture mark in real contexts.
const LogoLockups = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.paper, color: t.ink,
      fontFamily: t.fontUI,
      padding: 32, boxSizing: 'border-box',
      display: 'grid', gridTemplateRows: 'auto auto auto 1fr auto', gap: 22,
    }}>
      <div style={{
        fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: t.ink60,
      }}>02 · Aperture · lockup study</div>

      {/* Size study — same mark across scales */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22 }}>
        <SizeBlock label="14"><ApertureMark s={14} /></SizeBlock>
        <SizeBlock label="20"><ApertureMark s={20} /></SizeBlock>
        <SizeBlock label="32"><ApertureMark s={32} /></SizeBlock>
        <SizeBlock label="48"><ApertureMark s={48} /></SizeBlock>
        <SizeBlock label="80"><ApertureMark s={80} /></SizeBlock>
      </div>

      {/* App-icon tiles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <IconTile bg={t.paper} border>
          <ApertureMark s={56} />
        </IconTile>
        <IconTile bg={t.ink}>
          <ApertureMark s={56} ink={t.paper} accent={t.accent} />
        </IconTile>
        <IconTile bg={t.accent}>
          <ApertureMark s={56} ink="#fff" accent="#fff" />
        </IconTile>
        <div style={{ flex: 1 }} />
        {/* Menubar glyph mock */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 10px',
          background: 'rgba(25,25,26,0.92)', borderRadius: 6,
          fontFamily: t.fontUI, fontSize: 12, color: '#f4f3ee',
        }}>
          <ApertureMark s={14} ink="#f4f3ee" accent={t.accent} />
          <span>3</span>
        </div>
      </div>

      {/* Horizontal lockup */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '20px 22px',
        background: t.paperSubtle, borderRadius: t.r10,
      }}>
        <ApertureMark s={36} />
        <div style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.04em' }}>clarity</div>
        <div style={{ flex: 1 }} />
        <span style={{
          fontFamily: t.fontMono, fontSize: 10.5, letterSpacing: '0.10em',
          textTransform: 'uppercase', color: t.ink60,
        }}>Primary lockup</span>
      </div>

      <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink60, lineHeight: 1.45 }}>
        Two arcs and a focal dot. The opening at the C reads as both an aperture (focus) and a C (Clarity). Stroke weights scale with size so the mark stays balanced from 14px menubar to 1024px app icon.
      </div>
    </div>
  );
};

const SizeBlock = ({ label, children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', height: 80, justifyContent: 'center' }}>{children}</div>
      <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.ink40 }}>{label}</div>
    </div>
  );
};

const IconTile = ({ bg, border, children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: 88, height: 88, borderRadius: 22,
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: border ? `inset 0 0 0 1px ${t.hairline}` : 'none',
    }}>{children}</div>
  );
};

window.ApertureMark = ApertureMark;

window.LogoCard = LogoCard;
window.Logo01 = Logo01;
window.Logo02 = Logo02;
window.Logo03 = Logo03;
window.Logo04 = Logo04;
window.Logo05 = Logo05;
window.LogoLockups = LogoLockups;
