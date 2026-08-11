# Clarity — Claude Code Instructions

## Design decisions: always ask, never guess

This project has an active designer working in a separate Claude.ai project called **Clarity Design**.

**If you encounter a missing screen, missing state, or underspecified component — stop and tell the user what you need.** Do not invent design decisions. Do not approximate from what you know about similar apps. Wait for the user to get the answer from the designer and bring it back.

---

## Implementation completeness — all screens are required

**Every screen listed in `design-handoff/README.md` must be implemented.** Nothing is optional. "Phase 2" or "not yet built" labels in older versions of this file are now outdated — all screens are in scope.

### Required screens checklist

Before considering any view "done", confirm each of these exists and visually matches `Clarity.html`:

- [ ] **Today / Focus view** — greeting ("Good morning, [name]"), stat pills, AI plan strip, analysis staleness banner, ranked task groups
- [ ] **Today — Collapsed sidebar** — 52px rail, icon-only nav, `Ctrl+\` toggle
- [ ] **Task Detail panel** — slide-in from right, notes, subtasks, timer (idle + running), recurrence, activity log
- [ ] **Right-click Context Menu** — full item list with kbd hints, submenus for Schedule and Move to Topic
- [ ] **Quick Capture** — `Ctrl+K` modal, parse strip, hints row
- [ ] **Ask Clarity chat** — `Ctrl+/`, streaming bubbles, suggestion chips, accessible from sidebar nav
- [ ] **Onboarding** — 3-screen first-run flow; triggered by localStorage flag on first launch
- [ ] **First-run Tutorial** — 5-step coach mark overlay shown after onboarding completes
- [ ] **Settings** — all 7 panes: Appearance, AI (with provider switcher), Capture, Privacy, Data & Export (with backup list), Keyboard, About
- [ ] **Tasks / Inbox view** — search, status filter pills, tag filter pills
- [ ] **Calendar / Upcoming view** — month calendar with deadline dots + per-day task list
- [ ] **Archive view** (renamed from Someday) — tasks not actively worked on, with restore/delete
- [ ] **History / Done view** — completed task history, restorable
- [ ] **Weekly Summary** — streaming markdown AI review, regeneratable
- [ ] **Time Blocking strip** — 24h mini-timeline in Today header
- [ ] **Focus Mode** — fullscreen single-task view, progress ring, timer
- [ ] **Task Scheduling popover** — compact popover from context menu → "Schedule…"; calendar + time + recurrence
- [ ] **Topic management** — rename from "Areas"; add task to topic, move task out of topic, delete topic
- [ ] **Connected Graph view** — force-directed node graph linking tasks; Obsidian-style
- [ ] **Delete Undo toast** — 5-second grace window on any task deletion
- [ ] **Analysis staleness banner** — stale and error states in Focus view

### Things that went wrong in the first implementation — fix these

These specific items were missing or incorrect in the first build:

1. **Greeting** — The `h1` in Today view must read "Good morning, [name]." (or Good afternoon / Good evening based on time). The name comes from user settings; default to "there" if unset. This is not a static string.
2. **Settings access** — Settings must be reachable via: (a) `Ctrl+,` keyboard shortcut AND (b) a gear `⚙` icon in the sidebar footer next to the avatar. Do not hide it in a menu.
3. **Ask Clarity** — Must appear as a named item in the sidebar nav (below the GTD buckets, above the footer). Label: "Ask Clarity". Shortcut hint: `Ctrl+/`. Not hidden — always visible.
4. **Topics (Areas) appearance** — Topics section in the sidebar must match the design exactly: Geist Mono section label, `0.1em` tracking, uppercase, `ink40`; each topic as a nav item with count badge. Must include a `+ New topic` row at the bottom of the list.
5. **Time blocking** — Must appear in the Today view header, between the greeting and the AI plan strip.
6. **Focus mode** — Must be triggerable from the task detail panel footer and from the right-click context menu.
7. **Task scheduling popover** — Must open as a compact popover (320px) anchored to the triggering element (context menu item or task row). Not a full-screen modal.
8. **Typography** — All text must use Geist (UI) and Geist Mono (mono) as specified. Load from Google Fonts. Do not fall back to system fonts unless Geist fails to load.
9. **Density variants** — The density setting (Spacious / Balanced / Compact) must actually change task row spacing, font size, and group gap in real time. It is not decorative.
10. **First-run tutorial** — Must trigger automatically after onboarding; uses a `tutorialSeen` localStorage flag. The coach mark overlay must use the scrim + spotlight ring + panel spec exactly.
11. **Topics sidebar** — The sidebar section label reads "Topics" (not "Areas"). Nav items use `display: flex; flex-direction: column; gap: 1px` — NOT a `<ul>`/`<li>` list. Bullets or dots on topic items mean you used `<ul>` markup. Use plain `<div>` elements. Includes a `+ New topic` row and a `⋯` overflow button revealed on hover.
12. **Scheduling popover** — A compact floating card (320px) anchored to the context menu "Schedule…" item. NOT a full-screen modal or center overlay. The rest of the app stays visible behind a light scrim (`rgba(25,25,26,0.12)`). See screen 15 in README.md for exact anchor rules.
13. **Subtasks** — Each subtask is an **expandable card** (background `paperSubtle`, `r6`, `1px hairlineSoft` border). NOT a plain list row. Clicking expands to reveal a notes area, due date, and "Open" button. See the Subtasks section under screen 4 in README.md.
14. **AI plan strip** — The strip is a 3-column grid: `icon | body text | buttons`. Both **Accept** and **Adjust** buttons must be visible at all times. If only text appears and no buttons, you've dropped the third column.

---

## How the handoff loop works

```
You hit a design gap
        ↓
Tell the user: "I need a design for X — [describe exactly what's missing]"
        ↓
User pastes your question into the Clarity Design chat at claude.ai
        ↓
Designer produces new artboards + updates design-handoff/README.md
        ↓
User downloads the updated package and drops the new files into this repo
        ↓
You read the new specs and implement
```

### What counts as a design gap

Raise a design question if:
- A screen, view, or state is not covered in `design-handoff/README.md`
- You are unsure about a hover, focus, active, empty, loading, or error state
- A measurement, color, or spacing value is missing or ambiguous
- You are about to invent a new component that doesn't exist in the design files

### What does NOT need a design question

You can proceed without asking if:
- The spec is clearly documented in `design-handoff/README.md`
- The value can be derived directly from `design-handoff/tokens.jsx` (colors, radii, fonts)
- The pattern is an exact repeat of a documented component (e.g. another nav item, another settings row)

### Tone for design questions

Be specific. Instead of:
> "What does the hover state look like?"

Say:
> "I'm implementing the Today view task rows. The README doesn't spec the hover state — background color, cursor, and whether there's a reveal of any actions (e.g. a checkbox or drag handle). What should it look like?"

---

## Design files location

All design references are in `design-handoff/`:
- `README.md` — full screen specs, tokens, measurements
- `Clarity.html` — open in a browser to see all artboards visually
- Individual `.jsx` files — component-level source of truth for layout and structure

**When in doubt: open `Clarity.html` and match it exactly.** Pixel-for-pixel fidelity to the design artboards is the goal. If what you've built doesn't look like `Clarity.html`, it's wrong.

---

## Terminology

| Old name | New name | Notes |
|---|---|---|
| Areas | **Topics** | Renamed throughout; same GTD concept |
| Someday | **Archive** | Tasks not actively worked on |
| Archive (soft-delete) | **History** | Completed + deleted task history |

---

## Platform reminder

Clarity is a **Windows-first** application. All UI patterns, keyboard shortcuts, and shell chrome must follow Windows 11 conventions. The titlebar uses right-side Min/Max/Close controls (see `design-handoff/shell.jsx`). No macOS patterns.
