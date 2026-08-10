// Icon export sheet — every place the Aperture mark needs to live, at the
// right size, on the right surface. This is the spec Claude Code can
// implement against (or generate PNGs from).

const IconExportSheet = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;

  const Section = ({ label, children }) => (
    <div>
      <div style={{
        fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: t.ink60, marginBottom: 14,
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );

  const Item = ({ size, label, bg, ink, accent, radius, ring }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: size, height: size, borderRadius: radius != null ? radius : Math.max(2, size * 0.22),
        background: bg || t.paper,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: ring ? `inset 0 0 0 1px ${t.hairline}` : 'none',
      }}>
        <window.ApertureMark s={size * 0.62} ink={ink} accent={accent} />
      </div>
      <div style={{ fontFamily: t.fontMono, fontSize: 9.5, color: t.ink40 }}>{label}</div>
    </div>
  );

  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.paper, color: t.ink,
      fontFamily: t.fontUI,
      padding: '36px 40px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: 32, overflow: 'auto',
    }}>
      <header>
        <div style={{
          fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: t.ink60, marginBottom: 6,
        }}>Brand · icon export sheet</div>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500, letterSpacing: '-0.03em' }}>Aperture · in every place</h1>
      </header>

      <Section label="Favicon · browser tab">
        <Item size={16} label="16 · favicon" bg={t.paper} ring />
        <Item size={32} label="32 · retina" bg={t.paper} ring />
        <Item size={48} label="48 · Win" bg={t.paper} ring />
      </Section>

      <Section label="Menubar · macOS">
        <Item size={18} label="18 · light bar" bg="rgba(244,243,238,0.92)" ring radius={4} />
        <Item size={18} label="18 · dark bar" bg="rgba(25,25,26,0.92)" ink="#f4f3ee" radius={4} />
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '4px 10px', background: 'rgba(25,25,26,0.92)',
          color: '#f4f3ee', borderRadius: 6,
          fontFamily: t.fontUI, fontSize: 12,
        }}>
          <window.ApertureMark s={14} ink="#f4f3ee" accent={t.accent} />
          <span>Clarity</span>
          <span style={{ opacity: 0.5, fontFamily: t.fontMono, fontSize: 10.5, marginLeft: 6 }}>3 today</span>
        </div>
      </Section>

      <Section label="Dock · macOS · 1024 master, downscaled">
        <Item size={64}  label="64"   bg={t.paper} ring />
        <Item size={96}  label="96"   bg={t.paper} ring />
        <Item size={128} label="128 · dock" bg={t.paper} ring />
        <Item size={160} label="160" bg={t.ink} ink={t.paper} accent={t.accent} />
        <Item size={160} label="160 · accent" bg={t.accent} ink="#fff" accent="#fff" />
      </Section>

      <Section label="Notification · banner glyph">
        <div style={{
          width: 320, padding: 14, borderRadius: 12,
          background: 'rgba(244,243,238,0.96)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
          display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12,
          alignItems: 'flex-start',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: t.paper, boxShadow: `inset 0 0 0 1px ${t.hairline}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <window.ApertureMark s={22} />
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>Clarity</div>
            <div style={{ fontSize: 12, color: t.ink80, marginTop: 2, lineHeight: 1.4 }}>
              Two stale tasks reviewed. Want a 5-minute scan?
            </div>
          </div>
        </div>
      </Section>

      <div style={{
        marginTop: 'auto',
        fontFamily: t.fontMono, fontSize: 11, color: t.ink60, lineHeight: 1.5,
      }}>
        Master vector at 92×92 viewBox. Stroke weights derived from size — never hard-coded — so the mark holds at every scale. Accent dot stays warm-blue across all surfaces; never tinted to the background.
      </div>
    </div>
  );
};

window.IconExportSheet = IconExportSheet;
