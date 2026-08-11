// Brand foundations card — type pairing, palette, reasoning notes.

const BrandCard = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.paper, color: t.ink,
      fontFamily: t.fontUI,
      padding: '40px 44px',
      display: 'grid',
      gridTemplateColumns: '1.1fr 1fr',
      gap: 40,
      boxSizing: 'border-box',
    }}>
      {/* Left: type */}
      <div>
        <div style={{
          fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: t.ink60, marginBottom: 24,
        }}>Foundations · Type</div>

        <div style={{ fontSize: 96, fontWeight: 500, letterSpacing: '-0.04em', lineHeight: 0.95, marginBottom: 4 }}>
          clarity
        </div>
        <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.ink40, marginBottom: 36 }}>
          Geist · 500 · −4% tracking
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <TypeRow size={32} weight={400} label="Geist · 32 / 400">A clear mind makes room for what matters.</TypeRow>
          <TypeRow size={20} weight={500} label="Geist · 20 / 500">Today, Tuesday 12 May</TypeRow>
          <TypeRow size={15} weight={400} label="Geist · 15 / 400">Body copy and task titles. The medium of the app.</TypeRow>
          <TypeRow size={12} weight={500} label="Geist Mono · 12 / 500" mono uppercase tracking="0.10em">ON-DEVICE · 4 STALE · 2H FOCUS</TypeRow>
        </div>
      </div>

      {/* Right: color + system notes */}
      <div>
        <div style={{
          fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: t.ink60, marginBottom: 24,
        }}>Foundations · Color</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 28 }}>
          <Swatch name="paper"  hex="#FAFAF7" bg={t.paper}        ink={t.ink} />
          <Swatch name="ink"    hex="#19191A" bg={t.ink}          ink={t.paper} />
          <Swatch name="accent" hex="oklch(.48 .13 258)" bg={t.accent} ink="#fff" />
          <Swatch name="muted"  hex="#EEEDE7" bg={t.paperMuted}   ink={t.ink} />
        </div>

        <div style={{
          fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: t.ink60, marginBottom: 14,
        }}>System notes</div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10, fontSize: 13.5, color: t.ink80, lineHeight: 1.5 }}>
          <li>· Type does the work. Chrome is invisible.</li>
          <li>· Accent is rationed — focus state, AI surfaces, today.</li>
          <li>· Everything sits on warm paper, never pure white.</li>
          <li>· Mono is reserved for system signals — local, time, count.</li>
          <li>· No icons where a label suffices.</li>
        </ul>
      </div>
    </div>
  );
};

const TypeRow = ({ size, weight, label, children, mono, uppercase, tracking }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'baseline', gap: 16 }}>
      <div style={{
        fontFamily: mono ? t.fontMono : t.fontUI,
        fontSize: size, fontWeight: weight,
        textTransform: uppercase ? 'uppercase' : 'none',
        letterSpacing: tracking || (size > 40 ? '-0.03em' : '-0.01em'),
        color: t.ink, lineHeight: 1.2,
      }}>{children}</div>
      <div style={{ fontFamily: t.fontMono, fontSize: 10.5, color: t.ink40, whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  );
};

const Swatch = ({ name, hex, bg, ink }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      background: bg, color: ink,
      borderRadius: t.r10,
      padding: '18px 16px',
      height: 92,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      border: bg === t.paper ? `1px solid ${t.hairline}` : 'none',
      boxSizing: 'border-box',
    }}>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{name}</div>
      <div style={{ fontFamily: t.fontMono, fontSize: 10.5, opacity: 0.7 }}>{hex}</div>
    </div>
  );
};

window.BrandCard = BrandCard;
