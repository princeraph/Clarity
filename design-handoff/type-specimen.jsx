// type-specimen.jsx — Typography specimen for Clarity design system.
// Shows every text style in use: display, heading, body, label, mono variants.
// A reference card for both design QA and engineering handoff.

const TypeSpecimen = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: '100%', height: '100%', background: t.paper, color: t.ink,
      fontFamily: t.fontUI, overflow: 'auto', padding: '48px 64px', boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink60, marginBottom: 8 }}>Clarity · Design System</div>
          <h1 style={{ margin: 0, fontSize: 44, fontWeight: 500, letterSpacing: '-0.04em', color: t.ink }}>Typography</h1>
          <div style={{ marginTop: 12, fontSize: 15, color: t.ink60 }}>Geist (UI) + Geist Mono · Calm, legible, minimal.</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          {/* Left — UI type scale */}
          <div style={{ borderRight: `1px solid ${t.hairline}`, paddingRight: 48, paddingBottom: 40 }}>
            <SpecLabel t={t}>UI — Geist</SpecLabel>

            <SpecRow t={t} name="Display" spec="44px · 500 · −0.04em">
              <span style={{ fontFamily: t.fontUI, fontSize: 44, fontWeight: 500, letterSpacing: '-0.04em', color: t.ink, lineHeight: 1 }}>clarity</span>
            </SpecRow>

            <SpecRow t={t} name="Title 1" spec="38px · 500 · −0.035em">
              <span style={{ fontFamily: t.fontUI, fontSize: 38, fontWeight: 500, letterSpacing: '-0.035em', color: t.ink, lineHeight: 1 }}>Good morning.</span>
            </SpecRow>

            <SpecRow t={t} name="Title 2" spec="30px · 500 · −0.03em">
              <span style={{ fontFamily: t.fontUI, fontSize: 30, fontWeight: 500, letterSpacing: '-0.03em', color: t.ink, lineHeight: 1.1 }}>Settings</span>
            </SpecRow>

            <SpecRow t={t} name="Heading" spec="22px · 500 · −0.025em">
              <span style={{ fontFamily: t.fontUI, fontSize: 22, fontWeight: 500, letterSpacing: '-0.025em', color: t.ink, lineHeight: 1.2 }}>On-device intelligence</span>
            </SpecRow>

            <SpecRow t={t} name="Subheading" spec="15px · 600 · −0.02em">
              <span style={{ fontFamily: t.fontUI, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: t.ink }}>Clarity (work)</span>
            </SpecRow>

            <SpecRow t={t} name="Body" spec="14.5px · 400 · −0.005em">
              <span style={{ fontFamily: t.fontUI, fontSize: 14.5, fontWeight: 400, letterSpacing: '-0.005em', color: t.ink, lineHeight: 1.5 }}>Draft Clarity onboarding flow</span>
            </SpecRow>

            <SpecRow t={t} name="Body small" spec="13.5px · 400 · 0em">
              <span style={{ fontFamily: t.fontUI, fontSize: 13.5, fontWeight: 400, color: t.ink, lineHeight: 1.5 }}>Settings navigation item</span>
            </SpecRow>

            <SpecRow t={t} name="Caption" spec="12.5px · 400 · ink60">
              <span style={{ fontFamily: t.fontUI, fontSize: 12.5, fontWeight: 400, color: t.ink60, lineHeight: 1.5 }}>Supplementary description text</span>
            </SpecRow>

            <SpecRow t={t} name="Caption small" spec="11.5px · 400 · ink80">
              <span style={{ fontFamily: t.fontUI, fontSize: 11.5, fontWeight: 400, color: t.ink80 }}>Clarity AI · running locally</span>
            </SpecRow>
          </div>

          {/* Right — Mono type scale */}
          <div style={{ paddingLeft: 48, paddingBottom: 40 }}>
            <SpecLabel t={t}>Mono — Geist Mono</SpecLabel>

            <SpecRow t={t} name="Timestamp" spec="28px · 500 · −0.02em">
              <span style={{ fontFamily: t.fontMono, fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', color: t.ink, lineHeight: 1 }}>01:37:13</span>
            </SpecRow>

            <SpecRow t={t} name="Count badge" spec="16px · 500 · 0em">
              <span style={{ fontFamily: t.fontMono, fontSize: 16, fontWeight: 500, color: t.ink }}>7 · today</span>
            </SpecRow>

            <SpecRow t={t} name="Nav count" spec="11px · 400 · ink60">
              <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink60 }}>23</span>
            </SpecRow>

            <SpecRow t={t} name="Meta / time" spec="11px · 400 · ink40">
              <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink40 }}>2h · today</span>
            </SpecRow>

            <SpecRow t={t} name="Label (uppercase)" spec="10.5px · 400 · 0.10em · UPPERCASE">
              <span style={{ fontFamily: t.fontMono, fontSize: 10.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.ink60 }}>On-device</span>
            </SpecRow>

            <SpecRow t={t} name="Eyebrow" spec="11px · 400 · 0.12em · UPPERCASE · ink60">
              <span style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink60 }}>Tuesday · 12 May</span>
            </SpecRow>

            <SpecRow t={t} name="Tag / badge" spec="10px · 400 · 0.08em · UPPERCASE">
              <span style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.accentInk, background: t.accentSoft, padding: '3px 7px', borderRadius: 3 }}>Focus</span>
            </SpecRow>

            <SpecRow t={t} name="Kbd chip" spec="10–10.5px · paperMuted bg">
              <div style={{ display: 'flex', gap: 4 }}>
                {['Ctrl','K'].map(k => (
                  <span key={k} style={{ fontFamily: t.fontMono, fontSize: 10.5, color: t.ink60, padding: '2px 7px', background: t.paperMuted, borderRadius: 4, border: `1px solid ${t.hairline}`, boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>{k}</span>
                ))}
              </div>
            </SpecRow>

            <SpecRow t={t} name="Parse label" spec="9.5px · ink40 · 0.08em">
              <span style={{ fontFamily: t.fontMono, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.ink40 }}>when</span>
            </SpecRow>
          </div>
        </div>

        {/* Color + weight pairings */}
        <div style={{ borderTop: `1px solid ${t.hairline}`, paddingTop: 40, marginTop: 8 }}>
          <SpecLabel t={t}>Ink color scale</SpecLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { token: 'ink',   desc: 'Primary — headings, task titles, active nav', sample: 'Draft Clarity onboarding flow' },
              { token: 'ink80', desc: 'Secondary — nav labels, user name, setting values', sample: 'Upcoming · 12 tasks' },
              { token: 'ink60', desc: 'Tertiary — captions, descriptions, on-device label', sample: 'Tuesday · 12 May' },
              { token: 'ink40', desc: 'Placeholder — meta, count badges (inactive), disabled', sample: '23' },
              { token: 'ink20', desc: 'Faint — dividers and disabled track fills', sample: 'Divider / track' },
            ].map(row => (
              <div key={row.token} style={{
                display: 'grid', gridTemplateColumns: '100px 1fr 240px', gap: 20, alignItems: 'center',
                padding: '10px 14px', background: t.paperSubtle, borderRadius: t.r6, border: `1px solid ${t.hairlineSoft}`,
              }}>
                <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink60 }}>{row.token}</span>
                <span style={{ fontSize: 13, color: t.ink60 }}>{row.desc}</span>
                <span style={{ fontSize: 14, color: t[row.token] || t.ink }}>{row.sample}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SpecLabel = ({ t, children }) => (
  <div style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink40, marginBottom: 24 }}>{children}</div>
);

const SpecRow = ({ t, name, spec, children }) => (
  <div style={{ paddingBottom: 24, marginBottom: 24, borderBottom: `1px solid ${t.hairlineSoft}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: t.ink80 }}>{name}</span>
      <span style={{ fontFamily: t.fontMono, fontSize: 10, color: t.ink40 }}>{spec}</span>
    </div>
    {children}
  </div>
);

window.TypeSpecimen = TypeSpecimen;
