// Settings — single column, sectioned. Nothing buried, nothing decorative.
// Sections: Appearance, AI, Capture, Privacy, Data. Switch is the smallest
// affordance possible.

const SettingsView = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.paper, color: t.ink,
      fontFamily: t.fontUI,
      display: 'grid', gridTemplateColumns: '232px 1fr',
      overflow: 'hidden',
    }}>
      {/* Settings sidebar */}
      <aside style={{
        background: t.paperSubtle,
        borderRight: `1px solid ${t.hairline}`,
        padding: '20px 16px',
        display: 'flex', flexDirection: 'column', gap: 4,
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px', marginBottom: 16 }}>
          <window.ApertureMark s={20} />
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>Settings</span>
        </div>
        {[
          ['Appearance', true],
          ['AI assistant', false],
          ['Capture', false],
          ['Privacy', false],
          ['Data & export', false],
          ['Keyboard', false],
          ['About', false],
        ].map(([label, active]) => (
          <div key={label} style={{
            padding: '7px 10px', borderRadius: t.r6,
            background: active ? t.paper : 'transparent',
            boxShadow: active ? `inset 0 0 0 1px ${t.hairline}` : 'none',
            fontSize: 13.5,
            color: active ? t.ink : t.ink80,
            fontWeight: active ? 500 : 400,
          }}>{label}</div>
        ))}
      </aside>

      {/* Settings content */}
      <main style={{ padding: '36px 56px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 36 }}>
        <header>
          <div style={{
            fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: t.ink60, marginBottom: 6,
          }}>Settings · Appearance</div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500, letterSpacing: '-0.03em' }}>How Clarity looks</h1>
        </header>

        <Section title="Theme" subtitle="Match the system, or choose. Switches with the OS at sunset.">
          <div style={{ display: 'flex', gap: 12 }}>
            <ThemeChip label="Light" active={false} bg={t.paper} ring />
            <ThemeChip label="Dark" active={true} bg="#16161A" inkLabel="#F4F3EE" />
            <ThemeChip label="Auto" active={false} bg={`linear-gradient(90deg, ${t.paper} 50%, #16161A 50%)`} />
          </div>
        </Section>

        <Section title="Accent" subtitle="The one color that calls your attention. Used sparingly — focus, AI, today.">
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { name: 'Ink',     val: 'oklch(0.48 0.13 258)', active: true },
              { name: 'Moss',    val: 'oklch(0.55 0.10 155)' },
              { name: 'Ember',   val: 'oklch(0.62 0.13 40)' },
              { name: 'Plum',    val: 'oklch(0.50 0.12 320)' },
            ].map(c => (
              <div key={c.name} style={{
                width: 36, height: 36, borderRadius: 999,
                background: c.val,
                boxShadow: c.active
                  ? `0 0 0 2px ${t.paper}, 0 0 0 4px ${t.ink}`
                  : 'none',
                cursor: 'pointer',
              }}></div>
            ))}
          </div>
        </Section>

        <Section title="Density" subtitle="Spacious for reading; compact when the day is full.">
          <Segmented options={['Spacious', 'Balanced', 'Compact']} active="Balanced" />
        </Section>

        <Section title="Type">
          <Row label="Display font" value="Geist" hint="Default — calm and modern." />
          <Row label="System font fallback" value="On" toggle on />
          <Row label="Mono for badges" value="Geist Mono" hint="Used for time, count, and on-device signals." />
        </Section>

        <Section title="Sounds">
          <Row label="Capture chime" value="Off" toggle on={false} />
          <Row label="Complete chime" value="On" toggle on />
        </Section>
      </main>
    </div>
  );
};

const Section = ({ title, subtitle, children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <section>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, letterSpacing: '-0.005em' }}>{title}</h3>
        {subtitle && <div style={{ marginTop: 4, fontSize: 12.5, color: t.ink60, lineHeight: 1.5 }}>{subtitle}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </section>
  );
};

const Row = ({ label, value, hint, toggle, on }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 16, alignItems: 'center',
      padding: '12px 14px',
      background: t.paperSubtle, borderRadius: t.r6,
      border: `1px solid ${t.hairlineSoft}`,
    }}>
      <div style={{ fontSize: 13.5, color: t.ink }}>{label}</div>
      <div style={{ fontSize: 12.5, color: t.ink60, lineHeight: 1.45 }}>{hint || ''}</div>
      {toggle ? <Switch on={on} /> : (
        <span style={{ fontFamily: t.fontMono, fontSize: 12, color: t.ink80 }}>{value}</span>
      )}
    </div>
  );
};

const Switch = ({ on }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <span style={{
      width: 32, height: 18, borderRadius: 999,
      background: on ? t.accent : t.ink20,
      position: 'relative', display: 'inline-block',
      transition: 'background 200ms',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 16 : 2,
        width: 14, height: 14, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'left 200ms',
      }}></span>
    </span>
  );
};

const ThemeChip = ({ label, active, bg, inkLabel, ring }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: 132, padding: 12,
      background: t.paperSubtle, borderRadius: t.r10,
      border: `1px solid ${active ? t.ink : t.hairline}`,
      display: 'flex', flexDirection: 'column', gap: 10,
      cursor: 'pointer',
    }}>
      <div style={{
        height: 60, borderRadius: 6, background: bg,
        boxShadow: ring ? `inset 0 0 0 1px ${t.hairline}` : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <window.ApertureMark s={26} ink={inkLabel} accent={t.accent} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: active ? 500 : 400 }}>{label}</span>
        {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.ink }}></span>}
      </div>
    </div>
  );
};

const Segmented = ({ options, active }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display: 'inline-flex', padding: 3,
      background: t.paperSubtle, borderRadius: t.r6,
      border: `1px solid ${t.hairline}`,
      width: 'fit-content',
    }}>
      {options.map(o => (
        <span key={o} style={{
          padding: '6px 14px', borderRadius: 4, fontSize: 12.5,
          background: o === active ? t.paper : 'transparent',
          color: o === active ? t.ink : t.ink60,
          fontWeight: o === active ? 500 : 400,
          boxShadow: o === active ? `0 1px 2px rgba(0,0,0,0.06)` : 'none',
          cursor: 'pointer',
        }}>{o}</span>
      ))}
    </div>
  );
};

window.SettingsView = SettingsView;
