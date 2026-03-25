# Animation Overlay System (Traits + Keyframes)

## Problem

We need to support persistent visual states (e.g. sleeping, frozen, enraged) without polluting the Keyframe timeline system.

These states:
- Render as layered, looping animations on top of characters
- Are data-driven
- Must not conflict with timeline-based animations that explicitly toggle those same states

---

## Core Concept

There are two sources of truth:

### 1. Keyframe Animations (Authoritative)

- Explicit ON/OFF transitions
- Time-based
- Override all inferred state

### 2. Traits (Fallback)

- Provided by backend via `traitsComputed`
- Used only when no keyframes affect that trait

---

## Data Model

Replace boolean flags with:

traitsComputed: string[]

Example:
["ASLEEP", "FROZEN"]

---

## Keyframe Behavior

Keyframes toggle traits using:

keyframe.data[0]

- 1 → turn ON
- 0 → turn OFF

---

## Trait → Keyframe Mapping

| Trait      | Keyframe Animation |
|------------|-------------------|
| ASLEEP     | SLEEP             |
| ENCHAINED  | ENCHAIN           |
| ENCAGED    | ENCAGE            |
| CONFUSED   | CONFUSE           |
| EXCITED    | EXCITE            |
| ENRAGED    | ENRAGE            |
| FROZEN     | FROZEN            |
| ENFLAMED   | ENFLAME           |

---

## Animation Types

### Keyframe Animations (Transient)

- Play once
- Include:
  - Spritesheet
  - Sound effect

### Loop Animations (Persistent)

- Loop indefinitely
- Layered on top of character
- Optional looping audio

---

## Data-Driven Config

Example JSON:

{
  "ASLEEP": {
    "keyframeAnimation": "SLEEP",
    "loop": {
      "spritesheet": "sleep_loop",
      "audio": "sleep_loop_sound"
    }
  }
}

---

## Rendering Pipeline

For each character:

1. Start with traitsComputed
2. Override traits if keyframes exist for them
3. For each active trait:
   - Render loop animation
   - Play loop audio (optional)

---

## Priority Rules

1. Keyframes override traits
2. Traits only apply when no keyframes exist
3. Multiple traits can stack

---

## Goals

- Avoid bloating keyframes
- Fully data-driven
- Deterministic rendering
- Clean separation of concerns

---

## Open Questions

- Z-order of overlapping effects
- Audio stacking rules
- Performance of multiple overlays
- Trait exclusivity rules
