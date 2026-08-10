# Handoff: Clarity — Windows 11 Task Management App

## Overview

Clarity is a calm, minimal Windows 11 desktop task manager with on-device AI. The design philosophy is "paper and ink" — warm off-white surfaces, a single muted blue accent used only for AI and focus states, and generous whitespace. The AI runs locally (Ollama) so no task data leaves the machine; this privacy guarantee is surfaced throughout the UI.

## About the Design Files

The files in this folder are **HTML/JSX design references** — high-fidelity prototypes built in React + Babel showing intended look and behavior. They are not production code to copy directly.

The task is to **recreate these designs in the target codebase's existing environment** (React, Electron, WinUI 3, Tauri, etc.) using its established patterns and component libraries. If no environment exists yet, React + Tauri is the recommended stack for a Windows-native feel with web technology.

The interactive prototype (`Clarity.html`) loads in any browser and is the primary reference. Open it and pan/zoom through all artboard sections.

## Fidelity

**High-fidelity.** Colors, typography, spacing, and interactions are all final. Recreate pixel-precisely using the design tokens below. Every value in this document is exact.

---

## Design Tokens

### Surfaces (Light theme)

| Token | Value | Usage |
|---|---|---|
| `paper` | `#FAFAF7` | Main app background |
| `paperSubtle` | `#F4F3EE` | Sidebar, secondary surfaces |
| `paperMuted` | `#EEEDE7` | Hover state backgrounds, kbd chips |
| `panel` | `#FFFFFF` | Floating panels, modals |
| `hairline` | `rgba(25,25,26,0.08)` | Borders, dividers |
| `hairlineSoft` | `rgba(25,25,26,0.05)` | Subtle separators |
| `divider` | `rgba(25,25,26,0.10)` | Section dividers |

### Ink (Light theme)

| Token | Value | Usage |
|---|---|---|
| `ink` | `#19191A` | Primary text, strong labels |
| `ink80` | `rgba(25,25,26,0.78)` | Body text, nav labels |
| `ink60` | `rgba(25,25,26,0.55)` | Secondary text, meta |
| `ink40` | `rgba(25,25,26,0.36)` | Tertiary, placeholders, counts |
| `ink20` | `rgba(25,25,26,0.18)` | Disabled states |

### Accent

| Token | Value | Usage |
|---|---|---|
| `accent` | `oklch(0.48 0.13 258)` | AI states, focus ring, active today, timer |
| `accentSoft` | `oklch(0.94 0.03 258)` | Accent background tint |
| `accentInk` | `oklch(0.32 0.10 258)` | Text on accentSoft |

### Status

| Token | Value | Usage |
|---|---|---|
| `warn` | `oklch(0.62 0.10 65)` | Stale analysis dot, warnings |
| `done` | `oklch(0.58 0.07 155)` | Completion checkmarks, on-device status dot |

### Dark Theme

All surfaces invert to warm charcoal (not slate). The accent shifts lighter for contrast.

| Token | Light | Dark |
|---|---|---|
| `paper` | `#FAFAF7` | `#16161A` |
| `paperSubtle` | `#F4F3EE` | `#1C1C20` |
| `paperMuted` | `#EEEDE7` | `#222227` |
| `panel` | `#FFFFFF` | `#1E1E22` |
| `ink` | `#19191A` | `#F4F3EE` |
| `ink80` | `rgba(25,25,26,0.78)` | `rgba(244,243,238,0.78)` |
| `ink60` | `rgba(25,25,26,0.55)` | `rgba(244,243,238,0.55)` |
| `ink40` | `rgba(25,25,26,0.36)` | `rgba(244,243,238,0.36)` |
| `ink20` | `rgba(25,25,26,0.18)` | `rgba(244,243,238,0.18)` |
| `accent` | `oklch(0.48 0.13 258)` | `oklch(0.68 0.13 258)` |
| `accentSoft` | `oklch(0.94 0.03 258)` | `oklch(0.30 0.08 258)` |
| `accentInk` | `oklch(0.32 0.10 258)` | `oklch(0.86 0.06 258)` |

### Typography

- **UI font:** `"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
- **Mono font:** `"Geist Mono", ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace`
- Geist is available from Google Fonts: `https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500`

| Role | Size | Weight | Letter-spacing | Usage |
|---|---|---|---|---|
| Display | 38px | 500 | -0.035em | Greeting h1 |
| Heading | 28–36px | 500 | -0.03em | Screen titles |
| Body | 13.5px | 400 | — | Task titles, nav labels |
| Secondary | 12.5–13px | 400 | — | Meta, subtitles |
| Small | 11–12px | 400 | — | Counts, timestamps |
| Label (mono) | 10–11px | 400 | 0.10–0.12em + uppercase | Section headers, badges |

### Radii

| Token | Value | Usage |
|---|---|---|
| `r6` | `6px` | Controls, rows, input fields |
| `r10` | `10px` | Cards, panels |
| `r14` | `14px` | Large cards |
| `rPill` | `999px` | Badges, tags, status chips |

---

## Window Shell

All screens are wrapped in the Windows 11 window shell (`shell.jsx`):

- **Titlebar height:** 32px
- **Titlebar background:** `paperSubtle`
- **Titlebar border-bottom:** `1px solid hairline`
- **Left:** Aperture mark (14px) + app title (12px, `ink80`) + optional badge
- **Right:** Three Win11 controls — minimize (46×32px), maximize (46×32px), close (46×32px)
  - Minimize/maximize hover: `rgba(25,25,26,0.07)`
  - Close hover: bg `#C42B1C`, color `#fff`
- **Titlebar badge ("On-device"):** mono 9.5px, uppercase, letter-spacing 0.10em, `ink60`, pill border `hairline`, green dot `oklch(0.58 0.07 155)`
- **Window shadow:** `0 0 0 1px rgba(0,0,0,0.10), 0 8px 32px rgba(0,0,0,0.12)`
- **Window border-radius:** 8px

### Aperture Mark (logo)

SVG mark — two overlapping circles forming an aperture. See `brand.jsx` and `icons.jsx` for the exact path data. Used at 14px in titlebar, 20px in sidebar, larger in brand contexts.

---

## Screens & Views

### 1. Today View (`today.jsx`)

**Layout:** 2-column. Sidebar (220px fixed) + main column (flex 1).

#### Sidebar

- Background: `paperSubtle`
- Border-right: `1px solid hairline`
- Padding: `20px 16px`
- Gap between sections: `28px`

**Brand row:** Aperture mark (20px) + "clarity" (15px, weight 600, letter-spacing -0.02em). Padding `4px 8px`.

**Search bar:** Full-width, background `paper`, border `1px solid hairline`, radius `r6`, padding `8px 10px`, font 13px, color `ink40`. Right: kbd chip "Ctrl+K" (mono 10.5px, `paperMuted` bg, radius 4px).

**Nav items:** Vertical list, gap 1px. Each row: `7px 10px` padding, radius `r6`, 13.5px. Active item: `paper` bg, `inset 0 0 0 1px hairline` box-shadow, weight 500, `ink`. Inactive: transparent bg, `ink80`. Count: mono 11px, `ink40` (active: `ink60`).

Nav items in order: **Inbox** · **Today** (active) · **Upcoming** · **Anytime** · **Archive** · **History**

**Ask Clarity row:** Padding `7px 10px`, radius `r6`, 13px, `ink80`. Left: 7px filled circle in `accent`. Right: kbd chip "Ctrl+/" (mono 10px, `ink40`, `paperMuted` bg, border `hairlineSoft`).

**Topics section:**
- Label: mono 10.5px, uppercase, letter-spacing 0.1em, `ink40`, padding `0 10px 10px`
- Topic rows: same style as nav items
- "+ New topic" row: 13px, `ink40`, `+` glyph at 14px

**Footer (bottom, `margin-top: auto`):**
- On-device badge: `paper` bg, border `hairline`, radius `r6`, padding `8px 10px`. Green status dot 7px with 4px halo ring at 35% opacity. Mono 10px uppercase "ON-DEVICE" + 11.5px "Clarity AI · running locally"
- Export button: `paper` bg, border `hairline`, radius `r6`, padding `8px 10px`, 12.5px `ink80`. Up-arrow icon (11px, `ink60`)
- User row: 22px avatar circle (ink bg, paper text, 10.5px weight 600) + 12.5px name + settings gear (⚙, 26×26px, radius `r6`, `ink40`)

#### Main column

- Padding: `36px 56px 0`
- Gap: `28px`

**Header:**
- Date label: mono 11px, uppercase, letter-spacing 0.12em, `ink60`, margin-bottom 8px. Format: `new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })`
- Greeting h1: 38px, weight 500, letter-spacing -0.035em, `ink`. Dynamic: before 12 → "Good morning", 12–17 → "Good afternoon", 17+ → "Good evening". Always ends with ", Raph."
- Right of header: two icon buttons (32×32px, radius `r6`, `ink40`)

**AI plan strip:**
- Background: `accentSoft`
- Border-radius: `r10`
- Padding: `14px 18px`
- Left border: `2px solid accent`
- Dot: 7px circle `accent`
- Body: 13px `accentInk`. 1–2 sentences, natural language, never bullet points.
- Refresh hint: mono 10px `accentInk` at 0.6 opacity

**Task list:**
- Section headers: mono 11px, uppercase, letter-spacing 0.12em, `ink60`
- Task rows: `12px 0` padding, border-bottom `1px solid hairlineSoft`, gap 12px

Task row anatomy (left→right):
1. Checkbox: 16×16px circle, border `1.5px solid ink20`. Hover: `ink40`. Checked: `done` fill, checkmark `paper`.
2. Title: 14px, `ink`. Done: `ink40` + strikethrough.
3. Meta chips (right): radius `rPill`, border `1px solid hairline`, padding `3px 8px`, mono 11px, `ink60`. Focus chip: `accentSoft` bg, `accent` border, `accentInk` text. Priority dot: 5px filled circle.
4. Time estimate: mono 11px, `ink40`.

Context menu on right-click: `panel` bg, radius `r10`, `1px solid hairline`, shadow `0 8px 24px rgba(0,0,0,0.10)`. Items: 13px, `ink80`, padding `8px 14px`.

---

### 2. Task Detail Panel (`task-detail.jsx`)

Slides in from the right; replaces the right portion of the layout (or overlays). Width: ~480px. Background `paper`, left border `1px solid hairline`.

**Header:** Back arrow (←) + task title (22px, weight 500, letter-spacing -0.02em, `ink`). Padding `28px 28px 0`.

**Metadata rows** (padding `0 28px`, gap 16px between rows):
Each row: label (12px mono uppercase, `ink40`, 80px width) + value (13.5px, `ink80`).

Rows: Due · Time est · Priority · Topic

**Notes field:** `paperSubtle` bg, radius `r10`, padding `16px 18px`, 13.5px, `ink80`, line-height 1.6. Placeholder `ink40`.

**Subtasks:** Expandable. Each subtask: checkbox (14px circle) + text (13.5px). "+ Add subtask" row: `ink40`, dashed border trigger.

**Time tracker:**
- Shows timer UI: play button + "Start timer" (13px, `ink60`)
- When running: shows elapsed HH:MM:SS in mono, accent-colored dot, stop button
- "Tracked: Nm" line **only appears when timeTracked > 0**

**AI suggestions strip:** Same style as plan strip — `accentSoft` bg, `accent` left border, 7px accent dot. Shows 1–2 actionable suggestions.

---

### 3. Quick Capture (`capture.jsx`)

Spotlight-style modal. Centered, `top: 20%`.

- Background: `panel`
- Border: `1px solid hairline`
- Border-radius: `r14`
- Shadow: `0 24px 48px rgba(0,0,0,0.16)`
- Max-width: 640px, width: 90vw

**Input:** 18px, `ink`, padding `20px 24px`. No border, no bg. Placeholder: "What needs doing?" in `ink40`.

**AI parse preview** (appears after ~300ms debounce):
- Padding `12px 24px`, background `paperSubtle`, border-top `1px solid hairline`
- Shows parsed fields as pill chips: due date, time estimate, topic, priority
- Chip style: `paperMuted` bg, `ink80`, mono 11px, radius `rPill`, padding `3px 8px`
- AI dot: 6px `accent`

**Footer:** `paperSubtle` bg, border-top `hairline`, padding `10px 16px`. Kbd hints right-aligned: mono 10px, `ink40`.

---

### 4. AI Chat Panel (`chat.jsx`)

Slides in from the right at 380px width. Background `paper`, left border `hairline`.

**Header:** "Ask Clarity" (15px, weight 500) + accent dot + close button.

**Message list:** Padding `20px 20px`, gap 20px between messages.

- **User messages:** Right-aligned. `paperMuted` bg, radius `r10 r10 2px r10`, padding `10px 14px`, 13.5px `ink`.
- **AI messages:** Left-aligned. No bg. Mono 10px uppercase "CLARITY" label in `ink40` above. 13.5px `ink80`, line-height 1.65.
- **Inline task references:** Pill chips inside AI message body. `accentSoft` bg, `accent` border, mono 11px, `accentInk`.

**Input bar:** Fixed to bottom. `paper` bg, border-top `hairline`, padding `12px 16px`. Text input (13.5px) + send button (accent, radius `r6`, 32×32px).

---

### 5. Today + Timeline (`time-blocking.jsx`)

Same 2-column layout as Today, same sidebar. Main column adds a 24h timeline strip between header and task list.

**Timeline strip:**
- Height: ~120px
- Background: `paperSubtle`, border `hairline`, radius `r10`
- Hour labels: mono 10px, `ink40`, left column
- Blocks: rounded rects with `accent` bg (focus), `paperMuted` (meeting/buffer). Label: 12px weight 500 inside block.
- Current time indicator: 2px horizontal line, `accent`, with dot.

---

### 6. Focus Mode (`focus-mode.jsx`)

Full-screen. Background `paper`. Centered vertically and horizontally.

- Task title: 48px, weight 500, letter-spacing -0.04em, `ink`, max-width 560px, centered
- Timer: 72px mono, letter-spacing -0.02em. Active: `accent`. Idle: `ink40`.
- Control buttons: 48×48px circles, `paperSubtle` bg. Play/pause/stop icons.
- Progress ring: SVG circle, stroke `accent`, track `ink20`. 80px diameter.
- Bottom: "end focus" link, 13px `ink40`.

---

### 7. Graph View (`graph.jsx`)

Full-screen force-directed node graph.

- Background: `paperSubtle`
- Nodes: circles, 28–48px diameter (scaled by connection count). Fill: `paper`, stroke `hairline`. Active: stroke `accent`, 2px.
- Node labels: 12px, `ink80`, below node.
- Edges: SVG lines, stroke `ink20`, 1px.
- Hovered node: drop-shadow `0 4px 12px rgba(0,0,0,0.12)`.
- Sidebar (right, 280px): selected node detail — title, meta, linked task list.

---

### 8. Task Scheduling Flow (`scheduling.jsx`)

Modal or side panel, 480px wide.

- **Step 1:** Quick-pick date buttons (Today / Tomorrow / This week / Next week / Pick date / **Archive**). Button style: `paperSubtle` bg, `hairline` border, radius `r6`, 13.5px, padding `10px 14px`. Selected: `ink` bg, `paper` text.
- **Step 2:** Time picker (if timed task). Hour/minute scroll or native time input.
- **Step 3:** Confirm with AI suggestion ("AI recommends 2pm — you have a focus block").

---

### 9. Settings (`settings.jsx` + `settings-panes.jsx`)

2-column. Left: 200px nav. Right: content.

**Nav:** Same list-item style as sidebar. Sections: Appearance · **AI assistant** · Capture · Privacy · Data & Export · Keyboard · About.

**AI assistant pane:**
- Provider selector: segmented control — **Ollama** (default, local) / OpenAI / Anthropic / OpenRouter. Active segment: `ink` bg, `paper` text. Inactive: `paperSubtle` bg, `ink60`.
- Model picker: radio list
- "Running locally" status indicator
- Context window slider

**Data & Export pane:**
- Backup toggle + frequency + retention rows
- **Backup file list:** `paperSubtle` bg, `hairline` border, radius `r6`. Each row: mono 12px filename + mono 11px size + download icon (↓). Border-bottom `hairlineSoft` between rows.
- "Back up now" + "Open backup folder" buttons

**Keyboard pane:**
Shortcut rows. Key order: Ctrl+1 → Inbox, Ctrl+2 → Today, Ctrl+3 → Upcoming, Ctrl+4 → Anytime, **Ctrl+5 → Archive**.

---

### 10. Onboarding (`onboarding.jsx`)

3-screen flow. Full-screen, centered content, max-width 480px.

- **Screen 1 — Welcome:** Aperture mark (64px) + "clarity" wordmark (48px, weight 600) + tagline (18px, `ink60`) + single CTA button.
- **Screen 2 — Privacy promise:** Heading + 3-row privacy points (icon + title + description). Each row: `paperSubtle` bg, radius `r10`, padding `16px 20px`.
- **Screen 3 — AI setup:** Ollama detection status + model download progress bar (`accent` fill).

No progress dots. Navigation: single "Continue →" button, right-aligned.

---

### 11. Empty States (`empty-states.jsx`)

Three views: Inbox / Today / Archive.

Each: centered, max-width 400px.
- SVG illustration: abstract, minimal, built from basic shapes, `ink20` stroke
- Heading: 22px, weight 500, `ink`, letter-spacing -0.02em
- Body: 14px, `ink60`, line-height 1.65
- CTA button: `ink` bg, `paper` text, radius `r6`, padding `10px 20px`, 13.5px weight 500

**Archive empty state** body copy: "Archive is for things you want to do but not now. No due dates, no pressure — just a place to park what matters eventually." CTA: "Add to Archive".

---

### 12. Search / Ctrl+K (`search-capture.jsx`)

Dual-mode modal (same chrome as Quick Capture):

**Mode A — empty input:** Recent tasks list + quick-action commands (Schedule…, Focus mode, Open graph, Settings).

**Mode B — typed query:** Live search results with relevance scores (mono 11px, `ink40`) + "Capture as new task" row at bottom (`accentSoft` bg, `accent` left border, Tab kbd hint).

Footer: mono 10px `ink40` kbd hints — `↵ open task · Tab capture · Esc close`.

---

### 13. Global Components (`global-components.jsx`)

#### Delete Undo Toast

Position: `fixed`, bottom 24px, left 50%, `transform: translateX(-50%)`.

- Background: `#19191A` (always dark, regardless of theme)
- Border-radius: `r10`
- Padding: `12px 16px`
- Min-width: 280px
- Shadow: `0 8px 24px rgba(25,25,26,0.18), 0 1px 4px rgba(25,25,26,0.10)`
- Left: "Task deleted" — 13px, `rgba(244,243,238,0.85)`
- Right: "Undo" button — 12.5px weight 500, `rgba(255,255,255,0.90)`
- Bottom progress bar: 2px. Track: `rgba(255,255,255,0.20)`. Fill: `rgba(255,255,255,0.60)`. Animates 100% → 0% over 5 seconds. Auto-deletes when bar reaches 0.

#### Analysis Staleness Banner

Sits between greeting header and AI plan strip in Today. Shown when AI analysis is older than threshold, or has failed.

**Stale state:**
- Background: `paperSubtle`
- Border: `1px solid hairline`
- Border-radius: `r6`
- Padding: `10px 14px`
- Left: 6px dot in `warn`
- Text: "Analysis updated **14m ago**" — 12.5px, `ink60`, bold value `ink80` weight 500
- Right: "Re-analyze" — 12.5px, `ink60`, cursor pointer

**Error state:**
- Background: `oklch(0.97 0.02 25)`
- Border: `1px solid oklch(0.88 0.05 25)`
- Left: 6px dot `oklch(0.62 0.15 25)`
- Text: "AI analysis failed" — `oklch(0.45 0.12 25)`
- Right: "Try again"

---

### 14. System Tray (`system-tray.jsx`)

Windows 11 taskbar tray popup. 300px wide, `panel` bg, radius `r10`, shadow.

Items: Quick capture · Today summary (task count) · Focus mode · Settings · Quit.

---

### 15. Density Variants (`density.jsx`)

Three variants of the task list, side by side:
- **Spacious:** task row padding `14px 0`, font 14.5px
- **Balanced:** task row padding `10px 0`, font 13.5px (default)
- **Compact:** task row padding `6px 0`, font 12.5px, reduced meta

---

## Interactions & Behavior

| Interaction | Detail |
|---|---|
| Task check | Circle animates to filled `done`. Title fades to `ink40` + strikethrough. Row fades out after 400ms. |
| Task delete | Row fades out immediately. Undo toast appears (fixed, bottom-center). 5s grace window. Auto-confirm at 0. |
| Chat open | Panel slides in from right, `transform: translateX(100%)` → `0`. Duration 220ms, ease-out. |
| Task detail open | Same slide-in from right. If chat is open, chat shifts left. |
| Focus mode enter | Full-screen transition: fade app to 0%, scale up focus card. Duration 300ms. |
| Ctrl+K | Modal fades in + scales from 0.96 to 1.0. Background dims to `rgba(0,0,0,0.15)`. |
| AI parse debounce | 300ms after last keypress in Capture. Parse result fades in below input. |
| Timeline drag | Drag task onto timeline block → creates time block. Visual: block materializes with 150ms ease. |
| Theme switch | All token values transition over 200ms. |
| Graph physics | Force-directed, spring simulation. Nodes draggable. Double-click to focus + expand subtasks. |

---

## State Management

| State | Where |
|---|---|
| Active list (Inbox/Today/etc.) | App root |
| Task list (all tasks) | App root, persisted to local SQLite or JSON |
| Selected task (for detail panel) | App root |
| AI chat open | App root |
| Focus mode active | App root |
| Ctrl+K open | App root |
| Timer running + elapsed | Task detail (or app root if persisted across views) |
| AI plan (cached) | App root; timestamp drives staleness banner |
| Theme (light/dark) | App root + `localStorage` |
| Density setting | App root + `localStorage` |
| Sidebar collapsed | App root + `localStorage` |

---

## Assets & Fonts

- **Geist + Geist Mono:** Google Fonts. Load with `family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500`.
- **Aperture mark:** Custom SVG logo. Source in `brand.jsx` and `icons.jsx`.
- **Icons:** All inline SVG throughout the design files. No icon library dependency.
- **No photography or illustration assets** — all visuals are type, SVG, and color.

---

## Files Reference

| File | Contents |
|---|---|
| `Clarity.html` | **Main design reference** — open this in a browser. All artboards in a zoomable canvas. |
| `tokens.jsx` | All design tokens (exact values) |
| `themes.jsx` | Dark theme token overrides |
| `shell.jsx` | Windows 11 window chrome + titlebar badge |
| `today.jsx` | Today view (main app screen) |
| `today-variants.jsx` | Today + detail panel, Today + chat, Today + context menu |
| `task-detail.jsx` | Task detail slide-in panel |
| `chat.jsx` | AI chat panel |
| `capture.jsx` | Quick capture modal |
| `search-capture.jsx` | Ctrl+K dual-mode modal |
| `time-blocking.jsx` | Today + 24h timeline strip |
| `focus-mode.jsx` | Full-screen focus view |
| `graph.jsx` | Connected task graph |
| `scheduling.jsx` | Task scheduling flow |
| `onboarding.jsx` | 3-screen first-run flow |
| `empty-states.jsx` | Zero-state screens |
| `settings.jsx` | Settings shell + nav |
| `settings-panes.jsx` | AI, Capture, Privacy, Data, Keyboard, About panes |
| `personalization.jsx` | Language & topics settings |
| `area-detail.jsx` | Topic detail view |
| `density.jsx` | Spacious / Balanced / Compact task list variants |
| `system-tray.jsx` | Windows 11 tray menu |
| `tutorial.jsx` | First-run coach marks |
| `global-components.jsx` | Delete Undo Toast + Analysis Staleness Banner |
| `brand.jsx` | Logo, type pairing, palette reasoning |
| `icons.jsx` | Aperture mark at all required sizes |
| `type-specimen.jsx` | Full typography specimen |

---

## Terminology

| Old (do not use) | Correct |
|---|---|
| Someday | **Archive** |
| Areas | **Topics** |
| Area detail | **Topic detail** |

---

*Design by Claude · June 2026 · Handoff package for Claude Code*
