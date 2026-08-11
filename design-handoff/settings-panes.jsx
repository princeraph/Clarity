// Settings panes — AI, Capture, Privacy, Data & Export, Keyboard, About.
// Each is a self-contained view for the right column of SettingsView.
// Uses the same Section / Row / Switch / Segmented helpers from settings.jsx.

// ── Shared SettingsShell ─────────────────────────────────────────────────────
// Wraps any pane in the two-column settings layout with the sidebar nav.

const SettingsShell = ({ active, children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const pages = ['Appearance','AI assistant','Capture','Privacy','Data & export','Keyboard','About'];
  return (
    <div style={{
      width:'100%', height:'100%', background:t.paper, color:t.ink,
      fontFamily:t.fontUI, display:'grid', gridTemplateColumns:'232px 1fr', overflow:'hidden',
    }}>
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
            background: label===active ? t.paper : 'transparent',
            boxShadow: label===active ? `inset 0 0 0 1px ${t.hairline}` : 'none',
            fontSize:13.5, color: label===active ? t.ink : t.ink80,
            fontWeight: label===active ? 500 : 400,
          }}>{label}</div>
        ))}
      </aside>
      <main style={{ padding:'36px 56px', overflow:'auto', display:'flex', flexDirection:'column', gap:36 }}>
        {children}
      </main>
    </div>
  );
};

// ── Shared helpers (mirror settings.jsx — same visual language) ───────────────

const StgSection = ({ title, subtitle, children }) => {
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

const StgRow = ({ label, hint, toggle, on, value, danger, wide }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display:'grid', gridTemplateColumns: wide ? '1fr auto' : '180px 1fr auto', gap:16, alignItems:'center',
      padding:'12px 14px', background:t.paperSubtle, borderRadius:t.r6,
      border:`1px solid ${t.hairlineSoft}`,
    }}>
      {!wide && <div style={{ fontSize:13.5, color: danger ? 'oklch(0.52 0.15 25)' : t.ink }}>{label}</div>}
      {wide && <div style={{ fontSize:13.5, color: danger ? 'oklch(0.52 0.15 25)' : t.ink }}>{label}{hint && <div style={{ fontSize:11.5, color:t.ink60, marginTop:2 }}>{hint}</div>}</div>}
      {!wide && <div style={{ fontSize:12.5, color:t.ink60, lineHeight:1.45 }}>{hint||''}</div>}
      {toggle
        ? <StgSwitch on={on} />
        : value
        ? <span style={{ fontFamily:t.fontMono, fontSize:12, color:t.ink80, whiteSpace:'nowrap' }}>{value}</span>
        : null
      }
    </div>
  );
};

const StgSwitch = ({ on }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <span style={{
      width:32, height:18, borderRadius:999, background: on ? t.accent : t.ink20,
      position:'relative', display:'inline-block', flexShrink:0,
    }}>
      <span style={{
        position:'absolute', top:2, left: on ? 16 : 2,
        width:14, height:14, borderRadius:'50%', background:'#fff',
        boxShadow:'0 1px 2px rgba(0,0,0,0.2)',
      }}></span>
    </span>
  );
};

const StgSegmented = ({ options, active }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display:'inline-flex', padding:3, background:t.paperSubtle, borderRadius:t.r6,
      border:`1px solid ${t.hairline}`, width:'fit-content',
    }}>
      {options.map(o => (
        <span key={o} style={{
          padding:'6px 14px', borderRadius:4, fontSize:12.5,
          background: o===active ? t.paper : 'transparent',
          color: o===active ? t.ink : t.ink60, fontWeight: o===active ? 500 : 400,
          boxShadow: o===active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none', cursor:'pointer',
        }}>{o}</span>
      ))}
    </div>
  );
};

const StgBtn = ({ label, danger }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <button style={{
      fontFamily:t.fontUI, fontSize:12.5, fontWeight:500, cursor:'pointer',
      padding:'8px 14px', borderRadius:t.r6,
      background: danger ? 'oklch(0.96 0.02 25)' : t.paper,
      color: danger ? 'oklch(0.45 0.15 25)' : t.ink,
      border: `1px solid ${danger ? 'oklch(0.82 0.06 25)' : t.hairline}`,
    }}>{label}</button>
  );
};

const StgKeyRow = ({ action, shortcut, group }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display:'grid', gridTemplateColumns:'1fr auto', gap:24, alignItems:'center',
      padding:'9px 14px', background:t.paperSubtle, borderRadius:t.r6,
      border:`1px solid ${t.hairlineSoft}`,
    }}>
      <span style={{ fontSize:13, color:t.ink }}>{action}</span>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        {shortcut.map((k,i) => (
          <span key={i} style={{
            fontFamily:t.fontMono, fontSize:10.5, color:t.ink60,
            padding:'2px 7px', background:t.paper, borderRadius:4,
            border:`1px solid ${t.hairline}`,
            boxShadow:'0 1px 0 rgba(0,0,0,0.06)',
          }}>{k}</span>
        ))}
      </div>
    </div>
  );
};

const StgHeader = ({ section, title }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <header>
      <div style={{
        fontFamily:t.fontMono, fontSize:11, letterSpacing:'0.12em',
        textTransform:'uppercase', color:t.ink60, marginBottom:6,
      }}>Settings · {section}</div>
      <h1 style={{ margin:0, fontSize:30, fontWeight:500, letterSpacing:'-0.03em' }}>{title}</h1>
    </header>
  );
};

// ── AI Assistant pane ─────────────────────────────────────────────────────────

const SettingsAI = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <SettingsShell active="AI assistant">
      <StgHeader section="AI assistant" title="On-device intelligence" />

      {/* Provider selector */}
      <StgSection title="Provider" subtitle="Ollama runs entirely on-device. Cloud providers are available but send task data off-machine.">
        <div style={{ display:'flex', gap:0, background:t.paperSubtle, borderRadius:t.r6, padding:3, border:`1px solid ${t.hairline}`, width:'fit-content' }}>
          {[
            { label:'Ollama', local:true },
            { label:'OpenAI' },
            { label:'Anthropic' },
            { label:'OpenRouter' },
          ].map(p => (
            <div key={p.label} style={{
              padding:'7px 16px', borderRadius:4, fontSize:12.5, cursor:'pointer',
              background: p.local ? t.ink : 'transparent',
              color: p.local ? t.paper : t.ink60,
              fontWeight: p.local ? 500 : 400,
            }}>{p.label}</div>
          ))}
        </div>
      </StgSection>

      <StgSection title="Model" subtitle="All models run locally. No data leaves your machine.">
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[
            { name:'Llama 3.2 · 8B', size:'4.2 GB', desc:'Default — fast, fits most hardware.', active:true },
            { name:'Llama 3.1 · 3B', size:'2.0 GB', desc:'Lighter — for older or low-RAM machines.', active:false },
            { name:'Mistral · 7B',   size:'4.1 GB', desc:'Alternative — slightly stronger reasoning.', active:false },
          ].map(m => (
            <div key={m.name} style={{
              display:'grid', gridTemplateColumns:'auto 1fr auto', gap:14, alignItems:'center',
              padding:'13px 14px', background:t.paperSubtle, borderRadius:t.r6,
              border:`1px solid ${m.active ? t.accent : t.hairlineSoft}`,
            }}>
              <div style={{
                width:14, height:14, borderRadius:'50%', border:`1.5px solid ${m.active ? t.accent : t.ink40}`,
                background: m.active ? t.accent : 'transparent', flexShrink:0,
              }}></div>
              <div>
                <div style={{ fontSize:13.5, fontWeight: m.active ? 500 : 400 }}>{m.name}</div>
                <div style={{ fontSize:11.5, color:t.ink60, marginTop:2 }}>{m.desc}</div>
              </div>
              <span style={{ fontFamily:t.fontMono, fontSize:11, color:t.ink40 }}>{m.size}</span>
            </div>
          ))}
        </div>
      </StgSection>

      <StgSection title="Context" subtitle="How much of your task history the assistant reads before replying.">
        <StgSegmented options={['3 days','7 days','14 days','All']} active="7 days" />
      </StgSection>

      <StgSection title="Features">
        <StgRow label="Daily plan strip" hint="Show AI-generated plan at top of Today view." toggle on />
        <StgRow label="Auto-reschedule stale tasks" hint="Suggest new dates for tasks idle more than 7 days." toggle on={false} />
        <StgRow label="Smart area detection" hint="Automatically assign area when you capture." toggle on />
        <StgRow label="Conversation history" hint="Remember past Ask Clarity sessions within context window." toggle on />
      </StgSection>

      <StgSection title="Ask Clarity">
        <StgRow label="Panel shortcut" value="Ctrl+/" />
        <StgRow label="Thinking indicator" hint="Show animated dots while model generates." toggle on />
      </StgSection>
    </SettingsShell>
  );
};

// ── Capture pane ──────────────────────────────────────────────────────────────

const SettingsCapture = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <SettingsShell active="Capture">
      <StgHeader section="Capture" title="How tasks come in" />

      <StgSection title="Global shortcut" subtitle="Opens the capture bar from anywhere on Windows.">
        <div style={{
          display:'flex', alignItems:'center', gap:12,
          padding:'12px 14px', background:t.paperSubtle,
          borderRadius:t.r6, border:`1px solid ${t.hairlineSoft}`,
        }}>
          <div style={{ flex:1, fontSize:13.5, color:t.ink }}>Quick capture</div>
          <div style={{ display:'flex', gap:4 }}>
            {['Ctrl','K'].map(k => (
              <span key={k} style={{
                fontFamily:t.fontMono, fontSize:10.5, color:t.ink60,
                padding:'3px 8px', background:t.paper, borderRadius:4,
                border:`1px solid ${t.hairline}`, boxShadow:'0 1px 0 rgba(0,0,0,0.06)',
              }}>{k}</span>
            ))}
          </div>
          <span style={{ fontSize:12, color:t.ink40, cursor:'pointer' }}>Change</span>
        </div>
      </StgSection>

      <StgSection title="Defaults" subtitle="Applied when the AI parser can't determine a value.">
        <StgRow label="Default area" value="Inbox" />
        <StgRow label="Default due date" value="None" />
        <StgRow label="Default duration" value="—" />
      </StgSection>

      <StgSection title="Parsing">
        <StgRow label="Show parse preview" hint="Display parsed pills before saving." toggle on />
        <StgRow label="Auto-assign area" hint="Let AI pick the area based on task content." toggle on />
        <StgRow label="Detect recurrence" hint="Parse 'every Tuesday' into a repeating task." toggle on />
        <StgRow label="Parse duration" hint="Estimate time from task text ('≈ 30 min')." toggle on={false} />
      </StgSection>

      <StgSection title="After capture">
        <StgRow label="On save" value="Close & return" />
        <StgRow label="Capture chime" toggle on={false} />
        <StgRow label="Show in Today if due today" toggle on />
      </StgSection>
    </SettingsShell>
  );
};

// ── Privacy pane ──────────────────────────────────────────────────────────────

const SettingsPrivacy = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <SettingsShell active="Privacy">
      <StgHeader section="Privacy" title="What stays on your machine" />

      <div style={{
        padding:'14px 16px', background:t.accentSoft,
        borderRadius:t.r10, border:`1px solid ${t.hairline}`,
        display:'flex', alignItems:'flex-start', gap:12,
      }}>
        <span style={{
          width:7, height:7, borderRadius:'50%', background:t.done,
          flexShrink:0, marginTop:5,
        }}></span>
        <div style={{ fontSize:13, color:t.accentInk, lineHeight:1.55 }}>
          Clarity runs entirely on-device. Your tasks, notes, and AI conversations are never sent to any server. The settings below are all off by default.
        </div>
      </div>

      <StgSection title="Diagnostics">
        <StgRow label="Anonymous usage data" hint="Counts of features used — no task content." toggle on={false} />
        <StgRow label="Crash reports" hint="Auto-send logs when Clarity crashes." toggle on={false} />
        <StgRow label="Performance metrics" hint="Startup time, model latency." toggle on={false} />
      </StgSection>

      <StgSection title="AI & conversation">
        <StgRow label="Store Ask Clarity history" hint="Keeps conversation log between sessions." toggle on />
        <StgRow label="Use history to improve plans" hint="AI reads past sessions to improve daily suggestions." toggle on />
        <div style={{ display:'flex', gap:8 }}>
          <StgBtn label="Clear conversation history" />
        </div>
      </StgSection>

      <StgSection title="Danger zone">
        <StgRow label="Reset all privacy settings to defaults" wide toggle={false} value={null} hint="" />
        <div style={{ display:'flex', gap:8 }}>
          <StgBtn label="Reset to defaults" />
        </div>
      </StgSection>
    </SettingsShell>
  );
};

// ── Data & Export pane ────────────────────────────────────────────────────────

const SettingsData = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <SettingsShell active="Data & export">
      <StgHeader section="Data & export" title="Your data, your way" />

      <StgSection title="Storage">
        <div style={{
          display:'grid', gridTemplateColumns:'1fr auto', gap:16, alignItems:'center',
          padding:'12px 14px', background:t.paperSubtle,
          borderRadius:t.r6, border:`1px solid ${t.hairlineSoft}`,
        }}>
          <div>
            <div style={{ fontSize:13.5, color:t.ink }}>Data location</div>
            <div style={{ fontFamily:t.fontMono, fontSize:11.5, color:t.ink60, marginTop:3 }}>%APPDATA%\Clarity</div>
          </div>
          <StgBtn label="Change…" />
        </div>
        <StgRow label="Storage used" value="18.4 MB" />
        <StgRow label="Model stored separately" hint="Model files are in %LOCALAPPDATA%\Clarity\models." value="4.2 GB" />
      </StgSection>

      <StgSection title="Backup" subtitle="Clarity never syncs to the cloud. Back up the local data file manually or on a schedule.">
        <StgRow label="Auto-backup" toggle on />
        <StgRow label="Backup frequency" value="Daily" />
        <StgRow label="Keep backups for" value="30 days" />
        {/* Backup file list */}
        <div style={{ marginTop:4 }}>
          <div style={{ fontFamily:t.fontMono, fontSize:10, letterSpacing:'0.10em', textTransform:'uppercase', color:t.ink40, marginBottom:8 }}>Backup files</div>
          <div style={{ background:t.paperSubtle, borderRadius:t.r6, border:`1px solid ${t.hairline}`, overflow:'hidden' }}>
            {[
              { name:'tasks-2026-05-24.json', size:'18.4 KB' },
              { name:'tasks-2026-05-23.json', size:'17.9 KB' },
              { name:'tasks-2026-05-22.json', size:'17.1 KB' },
              { name:'tasks-2026-05-21.json', size:'16.8 KB' },
              { name:'tasks-2026-05-20.json', size:'16.2 KB' },
            ].map((f,i,arr) => (
              <div key={f.name} style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'10px 14px',
                borderBottom: i < arr.length-1 ? `1px solid ${t.hairlineSoft}` : 'none',
              }}>
                <span style={{ fontFamily:t.fontMono, fontSize:12, color:t.ink, flex:1 }}>{f.name}</span>
                <span style={{ fontFamily:t.fontMono, fontSize:11, color:t.ink60 }}>{f.size}</span>
                <span style={{ fontSize:12, color:t.ink40, cursor:'pointer' }}>↓</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <StgBtn label="Back up now" />
          <StgBtn label="Open backup folder" />
        </div>
      </StgSection>

      <StgSection title="Export tasks">
        <div style={{ fontSize:12.5, color:t.ink60, marginBottom:4 }}>Export all tasks in a portable format.</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <StgBtn label="Export as CSV" />
          <StgBtn label="Export as JSON" />
          <StgBtn label="Export as Markdown" />
        </div>
      </StgSection>

      <StgSection title="Import">
        <div style={{ fontSize:12.5, color:t.ink60, marginBottom:4 }}>Bring tasks in from other apps.</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <StgBtn label="Import from Things 3" />
          <StgBtn label="Import from Todoist" />
          <StgBtn label="Import from CSV" />
        </div>
      </StgSection>

      <StgSection title="Danger zone">
        <div style={{ fontSize:12.5, color:t.ink60, marginBottom:8 }}>These actions are permanent and cannot be undone.</div>
        <div style={{ display:'flex', gap:8 }}>
          <StgBtn label="Delete all tasks" danger />
          <StgBtn label="Reset Clarity" danger />
        </div>
      </StgSection>
    </SettingsShell>
  );
};

// ── Keyboard pane ─────────────────────────────────────────────────────────────

const SettingsKeyboard = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <SettingsShell active="Keyboard">
      <StgHeader section="Keyboard" title="Shortcuts" />

      <StgSection title="Navigation">
        <StgKeyRow action="Go to Today"          shortcut={['Ctrl','1']} />
        <StgKeyRow action="Go to Inbox"          shortcut={['Ctrl','2']} />
        <StgKeyRow action="Go to Upcoming"       shortcut={['Ctrl','3']} />
        <StgKeyRow action="Go to Anytime"        shortcut={['Ctrl','4']} />
        <StgKeyRow action="Go to Archive"        shortcut={['Ctrl','5']} />
        <StgKeyRow action="Open Settings"        shortcut={['Ctrl',',']} />
      </StgSection>

      <StgSection title="Tasks">
        <StgKeyRow action="Open task detail"     shortcut={['↵']} />
        <StgKeyRow action="Mark complete"        shortcut={['Space']} />
        <StgKeyRow action="Delete task"          shortcut={['Del']} />
        <StgKeyRow action="Move to Today"        shortcut={['Ctrl','T']} />
        <StgKeyRow action="Schedule task"        shortcut={['Ctrl','S']} />
        <StgKeyRow action="Open context menu"    shortcut={['Shift','F10']} />
      </StgSection>

      <StgSection title="Capture">
        <StgKeyRow action="Quick capture"        shortcut={['Ctrl','K']} />
        <StgKeyRow action="Save capture"         shortcut={['Ctrl','↵']} />
        <StgKeyRow action="Dismiss capture"      shortcut={['Esc']} />
      </StgSection>

      <StgSection title="View">
        <StgKeyRow action="Toggle sidebar"       shortcut={['Ctrl','\\']} />
        <StgKeyRow action="Open Ask Clarity"     shortcut={['Ctrl','/']} />
        <StgKeyRow action="Toggle dark mode"     shortcut={['Ctrl','Shift','L']} />
        <StgKeyRow action="Zoom in"              shortcut={['Ctrl','+']} />
        <StgKeyRow action="Zoom out"             shortcut={['Ctrl','-']} />
        <StgKeyRow action="Reset zoom"           shortcut={['Ctrl','0']} />
      </StgSection>
    </SettingsShell>
  );
};

// ── About pane ────────────────────────────────────────────────────────────────

const SettingsAbout = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <SettingsShell active="About">
      <StgHeader section="About" title="Clarity" />
      <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <window.ApertureMark s={56} />
          <div>
            <div style={{ fontSize:22, fontWeight:500, letterSpacing:'-0.03em' }}>Clarity</div>
            <div style={{ fontFamily:t.fontMono, fontSize:12, color:t.ink60, marginTop:4 }}>Version 0.1.0 · build 20260523</div>
            <div style={{ fontSize:12.5, color:t.ink60, marginTop:6 }}>On-device task manager + AI assistant</div>
          </div>
        </div>
        <StgSection title="System">
          <StgRow label="Platform" value="Windows 11" />
          <StgRow label="Model" value="Llama 3.2 · 8B" />
          <StgRow label="Model version" value="q4_K_M" />
          <StgRow label="Data format" value="SQLite 3.45" />
        </StgSection>
        <StgSection title="Links">
          <div style={{ display:'flex', gap:8 }}>
            <StgBtn label="Check for updates" />
            <StgBtn label="Release notes" />
            <StgBtn label="Report a bug" />
          </div>
        </StgSection>
      </div>
    </SettingsShell>
  );
};

window.SettingsShell    = SettingsShell;
window.SettingsAI       = SettingsAI;
window.SettingsCapture  = SettingsCapture;
window.SettingsPrivacy  = SettingsPrivacy;
window.SettingsData     = SettingsData;
window.SettingsKeyboard = SettingsKeyboard;
window.SettingsAbout    = SettingsAbout;
