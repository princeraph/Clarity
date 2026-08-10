// personalization.jsx — Language & personalization settings pane.
// Language, locale, date format, app name, greeting, custom topics, theme extras.

const LANGUAGES = [
  { code: 'en-US', label: 'English (US)',     flag: '🇺🇸', active: true  },
  { code: 'en-GB', label: 'English (UK)',     flag: '🇬🇧', active: false },
  { code: 'fr-FR', label: 'Français',         flag: '🇫🇷', active: false },
  { code: 'de-DE', label: 'Deutsch',          flag: '🇩🇪', active: false },
  { code: 'es-ES', label: 'Español',          flag: '🇪🇸', active: false },
  { code: 'ja-JP', label: '日本語',            flag: '🇯🇵', active: false },
  { code: 'pt-BR', label: 'Português (BR)',   flag: '🇧🇷', active: false },
  { code: 'zh-CN', label: '中文 (简体)',       flag: '🇨🇳', active: false },
];

const SettingsPersonalization = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const pages = ['Appearance','AI assistant','Capture','Privacy','Data & export','Keyboard','Language & display','About'];
  return (
    <div style={{
      width:'100%', height:'100%', background:t.paper, color:t.ink,
      fontFamily:t.fontUI, display:'grid', gridTemplateColumns:'232px 1fr', overflow:'hidden',
    }}>
      {/* Sidebar */}
      <aside style={{
        background:t.paperSubtle, borderRight:`1px solid ${t.hairline}`,
        padding:'20px 16px', display:'flex', flexDirection:'column', gap:4, boxSizing:'border-box',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 8px', marginBottom:16 }}>
          <window.ApertureMark s={20} />
          <span style={{ fontSize:15, fontWeight:600, letterSpacing:'-0.02em' }}>Settings</span>
        </div>
        {pages.map(label => (
          <div key={label} style={{
            padding:'7px 10px', borderRadius:t.r6,
            background: label==='Language & display' ? t.paper : 'transparent',
            boxShadow: label==='Language & display' ? `inset 0 0 0 1px ${t.hairline}` : 'none',
            fontSize:13.5, color: label==='Language & display' ? t.ink : t.ink80,
            fontWeight: label==='Language & display' ? 500 : 400,
          }}>{label}</div>
        ))}
      </aside>

      {/* Content */}
      <main style={{ padding:'36px 56px', overflow:'auto', display:'flex', flexDirection:'column', gap:36 }}>
        <header>
          <div style={{ fontFamily:t.fontMono, fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', color:t.ink60, marginBottom:6 }}>Settings · Language & display</div>
          <h1 style={{ margin:0, fontSize:30, fontWeight:500, letterSpacing:'-0.03em' }}>Language & personalization</h1>
        </header>

        {/* Language */}
        <PSection title="Language" subtitle="Changes all UI text. Restarts Clarity to apply.">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {LANGUAGES.map(lang => (
              <div key={lang.code} style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'10px 14px', background:t.paperSubtle, borderRadius:t.r6,
                border:`1px solid ${lang.active ? t.ink : t.hairlineSoft}`,
                cursor:'pointer',
              }}>
                <span style={{ fontSize:18, lineHeight:1 }}>{lang.flag}</span>
                <span style={{ fontSize:13.5, fontWeight: lang.active ? 500 : 400, color: lang.active ? t.ink : t.ink80, flex:1 }}>{lang.label}</span>
                {lang.active && <span style={{ width:7, height:7, borderRadius:'50%', background:t.ink }}></span>}
              </div>
            ))}
          </div>
        </PSection>

        {/* Locale */}
        <PSection title="Locale" subtitle="Controls how dates, times, and numbers are formatted.">
          <PRow label="Date format" value="May 24, 2026" dropdown />
          <PRow label="Time format" value="12h (3:30 PM)" dropdown />
          <PRow label="First day of week" value="Monday" dropdown />
          <PRow label="Number format" value="1,234.56" dropdown />
        </PSection>

        {/* App identity */}
        <PSection title="App identity" subtitle="Make Clarity feel like yours. Changes are local only.">
          <PRow label="App name" value="clarity" editable hint="Shown in the titlebar and sidebar." />
          <PRow label="Your name" value="Raph" editable hint="Used in the daily greeting." />
          <PRow label="Greeting style" value="Good morning, {name}." dropdown hint="How Clarity addresses you at the top of Today." />
        </PSection>

        {/* Custom topics */}
        <PSection title="Topics" subtitle="Rename or reorder your topics. Changes apply everywhere.">
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {[
              { label:'Personal',       emoji:'👤', count:6 },
              { label:'Clarity (work)', emoji:'💼', count:14 },
              { label:'Reading list',   emoji:'📚', count:9 },
            ].map((a,i) => (
              <div key={i} style={{
                display:'grid', gridTemplateColumns:'auto 1fr auto auto', gap:12, alignItems:'center',
                padding:'10px 14px', background:t.paperSubtle, borderRadius:t.r6,
                border:`1px solid ${t.hairlineSoft}`,
              }}>
                <span style={{ fontSize:16, cursor:'pointer' }}>{a.emoji}</span>
                <span style={{ fontSize:13.5, color:t.ink }}>{a.label}</span>
                <span style={{ fontFamily:t.fontMono, fontSize:11, color:t.ink40 }}>{a.count} tasks</span>
                <span style={{ fontSize:12, color:t.ink40, cursor:'pointer', padding:'2px 6px' }}>Edit</span>
              </div>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', cursor:'pointer', color:t.ink60, fontSize:13 }}>
              <span style={{ fontSize:16 }}>+</span> Add topic
            </div>
          </div>
        </PSection>

        {/* Typography scale */}
        <PSection title="Text size" subtitle="Scales the entire UI. Does not affect font choice.">
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <span style={{ fontFamily:t.fontMono, fontSize:11, color:t.ink60 }}>A</span>
            <div style={{
              flex:1, height:4, background:t.paperMuted, borderRadius:999, position:'relative',
            }}>
              <div style={{ position:'absolute', left:0, top:0, bottom:0, width:'50%', background:t.accent, borderRadius:999 }}></div>
              <div style={{ position:'absolute', left:'50%', top:-5, width:14, height:14, borderRadius:'50%', background:t.paper, border:`2px solid ${t.accent}`, transform:'translateX(-50%)', boxShadow:'0 1px 3px rgba(0,0,0,0.12)' }}></div>
            </div>
            <span style={{ fontFamily:t.fontMono, fontSize:16, color:t.ink60 }}>A</span>
          </div>
          <div style={{ display:'flex', justifyContent:'center', gap:32, marginTop:4 }}>
            {['Small','Default','Large','XL'].map(s => (
              <span key={s} style={{ fontFamily:t.fontMono, fontSize:10.5, color: s==='Default' ? t.ink : t.ink40, fontWeight: s==='Default' ? 500 : 400 }}>{s}</span>
            ))}
          </div>
        </PSection>

        {/* Reduce motion */}
        <PSection title="Accessibility">
          <PRow label="Reduce motion" hint="Disables animations and transitions." toggle on={false} />
          <PRow label="High contrast mode" hint="Increases border and text contrast." toggle on={false} />
          <PRow label="Focus rings always visible" hint="Show keyboard focus indicators even with mouse." toggle on={false} />
        </PSection>
      </main>
    </div>
  );
};

const PSection = ({ title, subtitle, children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <section>
      <div style={{ marginBottom:14 }}>
        <h3 style={{ margin:0, fontSize:14, fontWeight:500, letterSpacing:'-0.005em' }}>{title}</h3>
        {subtitle && <div style={{ marginTop:4, fontSize:12.5, color:t.ink60, lineHeight:1.5 }}>{subtitle}</div>}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{children}</div>
    </section>
  );
};

const PRow = ({ label, value, hint, toggle, on, dropdown, editable }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display:'grid', gridTemplateColumns:'180px 1fr auto', gap:16, alignItems:'center',
      padding:'12px 14px', background:t.paperSubtle, borderRadius:t.r6,
      border:`1px solid ${t.hairlineSoft}`,
    }}>
      <div>
        <div style={{ fontSize:13.5, color:t.ink }}>{label}</div>
        {hint && <div style={{ fontSize:11.5, color:t.ink60, marginTop:2 }}>{hint}</div>}
      </div>
      <div style={{ fontSize:12.5, color:t.ink60 }}></div>
      {toggle ? (
        <span style={{ width:32, height:18, borderRadius:999, background: on ? t.accent : t.ink20, position:'relative', display:'inline-block', flexShrink:0 }}>
          <span style={{ position:'absolute', top:2, left: on ? 16 : 2, width:14, height:14, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 2px rgba(0,0,0,0.2)' }}></span>
        </span>
      ) : (
        <div style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'5px 10px', background:t.paper, border:`1px solid ${t.hairline}`,
          borderRadius:t.r6, fontSize:13, color:t.ink, cursor:'pointer',
        }}>
          <span style={{ fontFamily: editable ? t.fontUI : t.fontMono, fontSize: editable ? 13 : 12 }}>{value}</span>
          {dropdown && <span style={{ color:t.ink40, fontSize:10, marginLeft:4 }}>▾</span>}
          {editable && <span style={{ color:t.ink40, fontSize:11, marginLeft:4 }}>✎</span>}
        </div>
      )}
    </div>
  );
};

window.SettingsPersonalization = SettingsPersonalization;
