# Mobile Support Feature Plan
### ascii-game-frontend

---

## Overview

The app has two distinct screens that need mobile treatment: the **Lobby** (a form + two data tables) and the **Match View** (a fixed-size ASCII grid with an absolutely-positioned animation overlay). These are very different problems and are split into separate workstreams.

A third cross-cutting concern is the global CSS baseline — `index.css` and `App.css` — which affects both screens.

---

## Files Involved

| File | Role | Mobile issues |
|---|---|---|
| `index.html` | Entry point | Missing or unverified viewport meta tag |
| `index.css` | Global styles | Fixed `h1` size, no breakpoints, `*` font override |
| `App.css` | App-level styles | `width: 100vw` overflow bug, `pre` rule targets wrong element |
| `LobbyPage.tsx` | Lobby UI | Two raw `<table>` elements, inline-flow form |
| `MatchPage.tsx` | Match shell | `End Turn` button unreachable below the canvas on mobile |
| `MatchRenderer.tsx` | ASCII renderer | Fixed 80×42 glyph canvas, inventory baked in at col 41, click-only interaction |
| `MatchRenderer.css` | Renderer styles | `.scene` has no max-width or scroll containment |
| `blockToText.tsx` | Canvas renderer | Renders 3,360 `<span>` elements per frame — mobile perf concern |
| `Painter.ts` | Glyph drawing | Draws into glyph grid — inventory panel bypasses this entirely on mobile |

---

## Workstream 1 — Global CSS Baseline

**Effort: Small. Do this first — it unblocks everything else.**

### 1.1 — Viewport meta tag (`index.html`)

Without this, mobile browsers render a zoomed-out desktop view and nothing else matters.

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

Verify it exists and is not set to a fixed width or `user-scalable=no`.

### 1.2 — Fix `#root` box model (`App.css`)

`width: 100vw` combined with `padding: 2rem` causes horizontal overflow because padding is added on top of the viewport width. Fix:

```css
#root {
  min-height: 100vh;
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 1rem;
}

@media (min-width: 600px) {
  #root {
    padding: 2rem;
  }
}
```

### 1.3 — Responsive `h1` (`index.css`)

`h1` at `3.2em` ("Ian's Dungeon Server") is enormous on a phone. Use `clamp`:

```css
h1 {
  font-size: clamp(1.5rem, 5vw, 3.2em);
  line-height: 1.1;
}
```

### 1.4 — Button tap targets (`index.css`)

Current button padding results in tap targets below the recommended 44px minimum height:

```css
button {
  min-height: 44px;
  padding: 0.6em 1.4em;
}
```

---

## Workstream 2 — Lobby Page

**Effort: Medium. Pure UI work, no game logic involved.**

### 2.1 — Replace tables with responsive cards (`LobbyPage.tsx`)

Both `<table border={1}>` blocks will overflow on screens narrower than ~500px. Add a shared `useIsMobile` hook and conditionally render cards instead of table rows on mobile. The existing table JSX stays untouched and is hidden below the breakpoint via CSS.

**New file `src/hooks/useIsMobile.ts`:**

```ts
import { useEffect, useState } from "react";

export function useIsMobile(breakpoint = 600): boolean {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}
```

Each match row becomes a stacked card on mobile:

```
┌───────────────────────────┐
│ Match: Crypt of Doom      │
│ Host: ian · Gen: dungeon  │
│ Status: waiting           │
│ ┌──────────┐ ┌──────────┐ │
│ │   Open   │ │  Leave   │ │
│ └──────────┘ └──────────┘ │
└───────────────────────────┘
```

### 2.2 — Stack the `CreateMatchForm` (`LobbyPage.tsx`)

The form uses `{" "}` spacers between `<label>` elements causing awkward inline wrapping on mobile. Replace with a flex column layout that switches to row on desktop:

```css
.create-match-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.create-match-form label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.create-match-form input,
.create-match-form select {
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 1em;
  padding: 0.5em;
  background: #111;
  color: white;
  border: 1px solid #444;
  border-radius: 4px;
}

@media (min-width: 600px) {
  .create-match-form {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-end;
  }
}
```

---

## Workstream 3 — Match View / ASCII Renderer

**Effort: Medium–Large. Split into two sub-tracks: canvas scaling and inventory extraction.**

### How the canvas actually works

`MatchRenderer.tsx` builds an 80×42 glyph grid and passes it to `blockToText`, which renders it as **3,360 individual `<span>` elements** — one per glyph — each with inline `color`, `backgroundColor`, and an optional `onClick`. This is important for two reasons:

- The inventory glyphs at columns 41+ are just spans in the same div structure. There is no bitmap to extract — pulling the inventory out of the canvas on mobile just means not writing to those glyph slots and rendering a React component instead.
- 3,360 styled spans re-rendered on every animation frame (via the RAF loop in `MatchRenderer`) is a meaningful mobile performance concern. This isn't in scope for this plan but worth keeping in mind for a future pass.

`measureCellSize` is called once on mount and stored in a ref, but its result is never read anywhere downstream. It is currently dead code and does not affect any of the plans below.

---

### 3.1 — Canvas scaling (`MatchRenderer.tsx`, `MatchRenderer.css`)

The full canvas is 80 glyphs wide but room content only ever occupies the first **39 glyphs** (the max room glyph width). The inventory sits at columns 41+ and is blank on mobile once `drawInventoryAt` is skipped. So rather than scaling to fit the full 80-column canvas, scale to fit just the 39-column room portion — this makes the room fill the viewport without wasting scale budget on dead columns.

The scale factor is: `viewportWidth / (naturalCanvasWidth × 39/80)`.

In other words, treat the room's share of the canvas pixel width as the 100% reference and scale it up or down to match the available viewport width.

**New hook `src/hooks/useSceneScale.ts`:**

```ts
import { useEffect, useState, RefObject } from "react";

const ROOM_GLYPH_WIDTH = 39;
const CANVAS_GLYPH_WIDTH = 80;
const ROOM_FRACTION = ROOM_GLYPH_WIDTH / CANVAS_GLYPH_WIDTH; // 0.4875

export function useSceneScale(sceneRef: RefObject<HTMLElement>): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function recalculate() {
      if (!sceneRef.current) return;
      const naturalCanvasWidth = sceneRef.current.scrollWidth;
      const roomWidth = naturalCanvasWidth * ROOM_FRACTION;
      const available = window.innerWidth;
      // Always scale — this sizes down on small screens and up on large ones
      // to keep the room filling the viewport width.
      // Add a max cap if you don't want upscaling on desktop:
      // setScale(Math.min(1, available / roomWidth));
      setScale(available / roomWidth);
    }

    recalculate();
    window.addEventListener("resize", recalculate);
    return () => window.removeEventListener("resize", recalculate);
  }, [sceneRef]);

  return scale;
}
```

Apply in `MatchRenderer.tsx` using `transform: scale()`. This preserves all glyph grid coordinates and click region math exactly — nothing in `drawRoomAt`, `markRegionClickable`, or `AnimatedCharacter` needs to change because the DOM geometry is unchanged, only the visual size.

```tsx
const scale = useSceneScale(sceneRef);

// Wrapper div compensates for the fact that transform: scale() doesn't
// affect layout flow — the element still occupies its natural (unscaled) height.
return (
  <div style={{
    height: sceneRef.current
      ? sceneRef.current.offsetHeight * scale
      : undefined
  }}>
    <div
      ref={sceneRef}
      className="scene"
      style={{
        transformOrigin: "top left",
        transform: `scale(${scale})`,
      }}
    >
      <pre>{blockToText(globals.glyphs)}</pre>
      <div className="overlay">...</div>
    </div>
  </div>
);
```

The inventory columns (41–80) will hang off the right edge of the viewport but are blank on mobile, so nothing meaningful is clipped.

---

### 3.2 — Inventory extraction (`MatchRenderer.tsx`, new `InventoryPanel.tsx`)

On desktop: no change. `drawInventoryAt([41, 13])` runs as normal, inventory is baked into the glyph canvas.

On mobile: skip `drawInventoryAt`, and render a new `<InventoryPanel>` React component as a toggleable overlay instead.

**The split in `MatchRenderer.tsx`:**

```tsx
const isMobile = useIsMobile();

// In the draw section — only write inventory glyphs on desktop:
if (!isMobile) {
  drawInventoryAt([41, 13]);
}

// In the return JSX:
return (
  <div style={...}> {/* scale wrapper */}
    <div ref={sceneRef} className="scene" style={...}>
      <pre>{blockToText(globals.glyphs)}</pre>
      <div className="overlay">...</div>
    </div>
    {isMobile && (
      <InventoryPanel
        inventory={player.inventory}
        account={account}
        matchFilename={match.filename}
        viewedRoomId={viewedRoomId}
        builderOffset={builderOffset}
        onAction={refreshMatch}
        autoTurnEnding={autoTurnEnding}
      />
    )}
  </div>
);
```

**New `src/components/InventoryPanel.tsx`:**

A floating toggle button (e.g. "INV") sits in the corner of the game view. Tapping it opens a panel that slides in over the canvas. The panel renders each inventory item as a tappable cell — items with `isActionable: true` get a highlighted style, and tapping them fires the same `activate_inventory_item` API call that currently lives inside `drawInventoryAt`.

```
┌─────────────────────────┐
│ Inventory          [×]  │
│ ┌──────┐ ┌──────┐       │
│ │Sword │ │Shield│       │
│ └──────┘ └──────┘       │
│ ┌──────┐                │
│ │ Key  │                │
│ └──────┘                │
└─────────────────────────┘
       [INV]  ← floating toggle
```

Item rendering does not need `Painter` or the glyph pipeline — just use the item `type` string as a label (or a mapped display name). The `isActionable` flag drives the enabled/disabled visual state and whether tapping the cell triggers an action.

---

### 3.3 — End Turn button positioning (`MatchPage.tsx`)

Currently rendered below `<MatchRenderer>`, which on mobile means it sits off-screen below the scaled canvas. Fix it to the bottom-right of the viewport on mobile:

```css
@media (max-width: 600px) {
  .end-turn-btn {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 100;
    min-height: 52px;
    padding: 0.75em 1.5em;
    font-size: 1.1em;
  }
}
```

Add `className="end-turn-btn"` to the button in `MatchPage.tsx`.

---

### 3.4 — Touch interaction (future consideration)

`onClick` handlers on glyphs fire correctly on tap so basic movement and activation work on mobile without any changes. Two things are worth noting for a follow-up:

- There is no visual affordance for which floor cells and doorways are tappable. On desktop the cursor changes to pointer. On mobile there's no equivalent cue. A future pass could highlight walkable cells and doorways in a distinct color when on mobile.
- The `bootstrapAudio()` call in `main.jsx` already uses `pointerdown`, which works correctly on touch devices. No change needed there.

---

## Recommended Implementation Order

1. **Workstream 1** — global CSS fixes, one PR, safe to ship immediately
2. **Workstream 2** — lobby responsive layout, self-contained, no game logic risk
3. **Workstream 3.1** — room-width scale transform, ships with 3.3
4. **Workstream 3.3** — End Turn button fixed positioning, ship alongside 3.1
5. **Workstream 3.2** — inventory extraction and overlay panel, most complex, ship last
6. **Workstream 3.4** — touch affordances, future backlog

---

## Files to Create / Modify

| Action | File |
|---|---|
| Verify/add viewport meta | `index.html` |
| Fix box model, responsive padding | `App.css` |
| Responsive `h1`, button tap targets | `index.css` |
| Table → cards on mobile, form stacking | `LobbyPage.tsx` |
| Lobby card + form CSS | `src/lobby.css` (new) |
| Mobile breakpoint hook | `src/hooks/useIsMobile.ts` (new) |
| Room-width scale hook | `src/hooks/useSceneScale.ts` (new) |
| Scale wrapper, skip `drawInventoryAt` on mobile, `InventoryPanel` integration | `MatchRenderer.tsx` |
| Scene scroll/scale containment | `MatchRenderer.css` |
| End Turn button positioning | `MatchPage.tsx` |
| Toggleable inventory overlay component | `src/components/InventoryPanel.tsx` (new) |
