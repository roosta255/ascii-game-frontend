import { blockToText } from "../functions/blockToText";
import { AsciiGlyph } from "./AsciiGlyph";
import { digestKeyframes, isKeyframeAnimating, Keyframe } from "./Keyframe";
import { DrawerProps } from "../types/DrawerProps";
import { RoomProps } from "../types/RoomProps";
import { Painter, AnimationFlyweight } from "../assets/Painter";
import { render } from "../assets/Renderer";

export interface AnimatedCharacterProps {
    /** The keyframes to animate — caller selects the correct list (e.g. wall.keyframes vs wall.lockKeyframes). */
    keyframes: Keyframe[];
    painter: Painter;
    /** The entity's current (post-logic) name. Only used for the static fallback when no spritesheet
     *  animation is active. Never used to determine transition state. */
    name: string;
    animationFlyweights: Record<string, AnimationFlyweight>;
    animationTime: number;
    /** For short non-predicted animations: a local clock time to use for sprite
     *  selection and frame progress instead of the server-synced animationTime. */
    localAnimationTime?: number;
    /** For non-movement entities (locks, items, etc.): the grid [col, row] to render at.
     *  When omitted, position is derived from digestKeyframes (used for moving characters). */
    position?: [number, number];
    /** Fallback position for characters whose only active keyframe is a non-movement animation
     *  (e.g. a transition animation with no concurrent standing/walking keyframe).
     *  Passed to digestKeyframes as the default when no keyframe provides a position. */
    fallbackPosition?: [number, number];
    /** Used for resolving transition before/after sprite indices when they belong to a
     *  different painter than the main one (e.g. lock animations reference door indices). */
    transitionPainter?: Painter;
    globals: DrawerProps;
    room: RoomProps;
    /** Trait names currently active on this character (from backend traitsComputed). */
    traitsComputed?: string[];
    /** Painter loaded from status-effect-animations.json — drives eye-color and overlay effects. */
    traitPainter?: Painter;
}

/**
 * Resolves whether a status-effect trait is currently active, consulting the keyframe
 * timeline before falling back to traitsComputed. This prevents showing/hiding the
 * inferred overlay state before the transition animation has had a chance to play.
 *
 * Timeline rule: find the most recent keyframe for this trait by t1.
 *   - Before it starts (t < t0): use data[0] (pre-transition state)
 *   - At or after t0: use data[1] (post-transition state)
 * If no keyframe exists for this trait, fall back to traitsComputed membership.
 */
export function resolveTraitActive(
    traitName: string,
    keyframes: Keyframe[],
    traitsComputed: string[],
    t: number
): boolean {
    const traitKfs = keyframes.filter(k => k.animation === traitName);
    if (traitKfs.length === 0) return traitsComputed.includes(traitName);
    const lastKf = traitKfs.reduce((a, b) => b.t1 > a.t1 ? b : a);
    if (t < lastKf.t0) return lastKf.data[0] === 1;
    if (t <= lastKf.t1) return lastKf.data[1] === 1;
    return traitsComputed.includes(traitName);
}

export function AnimatedCharacter({
  keyframes,
  painter,
  name,
  animationFlyweights,
  animationTime,
  localAnimationTime,
  position,
  fallbackPosition,
  transitionPainter: _transitionPainter,
  globals,
  room,
  traitsComputed,
  traitPainter,
}: AnimatedCharacterProps) {
  const spriteTime = localAnimationTime ?? animationTime;
  const keyframe = digestKeyframes(keyframes, animationTime, room, fallbackPosition);
  const translationProgress = keyframe.t1 > keyframe.t0
    ? (animationTime - keyframe.t0) / (keyframe.t1 - keyframe.t0)
    : 0;
  const kx = Math.floor(keyframe.curve(keyframe.source[0], keyframe.destination[0], translationProgress));
  const ky = Math.floor(keyframe.curve(keyframe.source[1], keyframe.destination[1], translationProgress));
  const x = position?.[0] ?? kx;
  const y = position?.[1] ?? ky;

  const sheet = globals.textures.animationSheet;
  const [fw, fh] = sheet?.meta.size ?? [0, 0];
  const [dox, doy] = sheet?.meta["draw-offset"] ?? [0, 0];
  const [sw, sh] = globals.textures.icons.meta.size;
  const TRANSPARENT: AsciiGlyph = { char: " ", fg: 0xff00ff, bg: 0xff00ff };

  // Frame buffer: animation sheet dimensions when available, icon dimensions otherwise.
  // The div is always positioned at (x - dox, y - doy), which equals (x, y) when sheet is absent.
  const frameGlyphs: AsciiGlyph[][] = sheet
    ? Array.from({ length: fh }, () => Array.from({ length: fw }, () => ({ ...TRANSPARENT })))
    : Array.from({ length: sh }, () => Array.from({ length: sw }, () => ({ ...TRANSPARENT })));
  const frameGlobals: DrawerProps = { ...globals, glyphs: frameGlyphs };
  const drawCoords: [number, number] = sheet ? [dox, doy] : [0, 0];

  // Resolve active status effects from traitPainter renderers.
  const traits = traitsComputed ?? [];
  let activeEyePalette: number | undefined;
  const activeOverlayEffects: string[] = [];

  if (traitPainter) {
    for (const [effectName, renderer] of Object.entries(traitPainter.renderers)) {
      const traitName = effectName.includes(':') ? effectName.split(':')[0] : effectName;
      if (!resolveTraitActive(traitName, keyframes, traits, spriteTime)) continue;
      if (renderer.type === "EyePaletteRenderer") {
        activeEyePalette = renderer.palette;
      } else if (renderer.type === "AnimatedSpriteRenderer") {
        activeOverlayEffects.push(effectName);
      }
    }
  }

  function buildOverlayDivs() {
    if (!sheet || activeOverlayEffects.length === 0) return [];
    return activeOverlayEffects.flatMap(effectName => {
      const renderer = traitPainter!.renderers[effectName];
      if (renderer.type !== "AnimatedSpriteRenderer") return [];
      const overlayGlyphs: AsciiGlyph[][] = Array.from({ length: fh }, () =>
        Array.from({ length: fw }, () => ({ ...TRANSPARENT }))
      );
      render(renderer, {
        globals: { ...globals, glyphs: overlayGlyphs },
        locals: { coords: [dox, doy], animationTime },
      });
      return [(
        <div
          key={`overlay-${effectName}`}
          className="status-overlay"
          style={{ position: "absolute", left: `${x - dox}ch`, top: `${y - doy}em`, pointerEvents: "none" }}
        >
          {blockToText(overlayGlyphs)}
        </div>
      )];
    });
  }

  const activeKeyframe = keyframes.find(k =>
    k.room0 === room.index &&
    isKeyframeAnimating(k, spriteTime) &&
    !!sheet?.meta.spritesheet[k.animation]
  );
  const flyweight = activeKeyframe ? (animationFlyweights[activeKeyframe.animation] ?? null) : null;

  if (!activeKeyframe) {
    if (painter.renderers[name]?.type === "Unrendered") {
      const overlayDivs = buildOverlayDivs();
      if (overlayDivs.length === 0) return null;
      return <>{overlayDivs}</>;
    }
    painter.draw(name, { globals: frameGlobals, locals: { coords: drawCoords, direction: 0, eyePaletteOverride: activeEyePalette } });
    const overlayDivs = buildOverlayDivs();
    const characterDiv = (
      <div className="animated-character" style={{ position: "absolute", left: `${x - dox}ch`, top: `${y - doy}em`, pointerEvents: "none" }}>
        {blockToText(frameGlyphs)}
      </div>
    );
    if (overlayDivs.length === 0) return characterDiv;
    return <>{characterDiv}{overlayDivs}</>;
  }

  const animName = activeKeyframe.animation;
  const glyphProgress = activeKeyframe.t1 > activeKeyframe.t0
    ? Math.max(0, Math.min(1, (spriteTime - activeKeyframe.t0) / (activeKeyframe.t1 - activeKeyframe.t0)))
    : 0;

  let beforeGlyphs: AsciiGlyph[][] | null = null;
  let afterGlyphs: AsciiGlyph[][] | null = null;

  if (flyweight?.isTransition) {
    const tp = painter;
    const beforeName = tp.indexMap[activeKeyframe.data[0]];
    const afterName = tp.indexMap[activeKeyframe.data[1]];
    if (Object.keys(tp.indexMap).length > 0) {
      const beforeRenderer = beforeName ? tp.getRenderer(beforeName) : null;
      const afterRenderer = afterName ? tp.getRenderer(afterName) : null;
      if ((!beforeRenderer || beforeRenderer.type === "Unrendered") &&
          (!afterRenderer || afterRenderer.type === "Unrendered")) {
        return null;
      }
    }
    const makeBuffer = (): AsciiGlyph[][] =>
      Array.from({ length: sh }, () => Array.from({ length: sw }, () => ({ ...TRANSPARENT })));
    if (beforeName && activeKeyframe.data[0] !== 0) {
      beforeGlyphs = makeBuffer();
      tp.draw(beforeName, { globals: { ...globals, glyphs: beforeGlyphs }, locals: { coords: [0, 0], direction: 0, eyePaletteOverride: activeEyePalette } });
    }
    if (afterName && activeKeyframe.data[1] !== 0) {
      afterGlyphs = makeBuffer();
      tp.draw(afterName, { globals: { ...globals, glyphs: afterGlyphs }, locals: { coords: [0, 0], direction: 0, eyePaletteOverride: activeEyePalette } });
    }
  } else if (flyweight?.isGlyphing) {
    const makeBuffer = (): AsciiGlyph[][] =>
      Array.from({ length: sh }, () => Array.from({ length: sw }, () => ({ ...TRANSPARENT })));
    const buf = makeBuffer();
    painter.draw(name, { globals: { ...globals, glyphs: buf }, locals: { coords: [0, 0], direction: 0, eyePaletteOverride: activeEyePalette } });
    beforeGlyphs = buf;
    afterGlyphs = buf;
  }

  render(
    { type: "AnimatedSpriteRenderer", animation: animName, looping: false, palette: 0 },
    {
      globals: frameGlobals,
      locals: { coords: [dox, doy], animationProgress: glyphProgress, beforeGlyphs, afterGlyphs },
    }
  );

  const overlayDivs = buildOverlayDivs();
  const animatedDiv = (
    <div className="animated-character" style={{ position: "absolute", left: `${x - dox}ch`, top: `${y - doy}em`, pointerEvents: "none" }}>
      {blockToText(frameGlyphs)}
    </div>
  );
  if (overlayDivs.length === 0) return animatedDiv;
  return <>{animatedDiv}{overlayDivs}</>;
}
