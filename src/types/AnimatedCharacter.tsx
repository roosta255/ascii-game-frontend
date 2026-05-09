import { blockToText } from "../functions/blockToText";
import { AsciiGlyph } from "./AsciiGlyph";
import { digestKeyframes, isKeyframeAnimating, Keyframe } from "./Keyframe";
import { DrawerProps } from "../types/DrawerProps";
import { RoomProps } from "../types/RoomProps";
import { Painter, AnimationFlyweight } from "../assets/Painter";

export interface StatusEffectDef {
    /** Animation name in the spritesheet to loop indefinitely while trait is active. */
    loopSprite?: string;
    loopAudio?: string | null;
    /** Palette index to apply to eye-sentinel pixels while this trait is active. */
    eyePalette?: number;
}

export type StatusEffectConfig = Record<string, StatusEffectDef>;

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
    /** Status effect config loaded from status-effect-animations.json. */
    statusEffectConfig?: StatusEffectConfig;
}

const OVERLAY_FRAME_DURATION_MS = 200;

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
    return lastKf.data[1] === 1;
}

/**
 * Given a status-effect config and the current character state, returns the active
 * eye-palette override (if any) and the list of overlay effect names that should loop.
 *
 * Effect type is determined by the config fields themselves:
 *   eyePalette present → IS_EYE_COLOR effect
 *   loopSprite present → IS_OVERLAY effect
 *
 * This does NOT gate on animationFlyweights.isEyeColor / .isOverlay — those flags
 * represent the same information and are redundant here.
 */
export function resolveStatusEffects(
    config: StatusEffectConfig,
    keyframes: Keyframe[],
    traitsComputed: string[],
    t: number,
): { activeEyePalette: number | undefined; activeOverlayEffects: string[] } {
    let activeEyePalette: number | undefined;
    const activeOverlayEffects: string[] = [];
    for (const [effectName, def] of Object.entries(config)) {
        if (!resolveTraitActive(effectName, keyframes, traitsComputed, t)) continue;
        if (def.eyePalette != null) activeEyePalette = def.eyePalette;
        if (def.loopSprite) activeOverlayEffects.push(effectName);
    }
    return { activeEyePalette, activeOverlayEffects };
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
  statusEffectConfig,
}: AnimatedCharacterProps) {
  // Use localAnimationTime for sprite selection/progress when provided (short non-predicted anims).
  // Movement/position always uses the server-synced animationTime.
  const spriteTime = localAnimationTime ?? animationTime;
  // Translation: where to render the character.
  // Static entities (locks, items, etc.) supply their own position; moving characters
  // derive it from digestKeyframes.
  const keyframe = digestKeyframes(keyframes, animationTime, room, fallbackPosition);
  const translationProgress = keyframe.t1 > keyframe.t0
    ? (animationTime - keyframe.t0) / (keyframe.t1 - keyframe.t0)
    : 0;
  const kx = Math.floor(keyframe.curve(keyframe.source[0], keyframe.destination[0], translationProgress));
  const ky = Math.floor(keyframe.curve(keyframe.source[1], keyframe.destination[1], translationProgress));
  const x = position?.[0] ?? kx;
  const y = position?.[1] ?? ky;

  // Spritesheet dimensions — needed for both animation and overlay rendering.
  const sheet = globals.textures.animationSheet;
  const [fw, fh] = sheet?.meta.size ?? [0, 0];
  const [dox, doy] = sheet?.meta["draw-offset"] ?? [0, 0];
  const TRANSPARENT: AsciiGlyph = { char: " ", fg: 0xff00ff, bg: 0xff00ff };

  // Resolve status-effect states against the keyframe timeline.
  const traits = traitsComputed ?? [];
  const config = statusEffectConfig ?? {};

  const { activeEyePalette, activeOverlayEffects } = resolveStatusEffects(config, keyframes, traits, spriteTime);
  const activeOverlays = activeOverlayEffects
    .map(name => ({ effectName: name, def: config[name] }))
    .filter((entry): entry is { effectName: string; def: StatusEffectDef & { loopSprite: string } } =>
      entry.def?.loopSprite != null
    );

  // Build overlay divs for all active IS_OVERLAY traits.
  function buildOverlayDivs() {
    if (!sheet || activeOverlays.length === 0) return [];
    return activeOverlays.flatMap(({ effectName, def }) => {
      const loopSprite = def.loopSprite!;
      const animDef = sheet.meta.spritesheet[loopSprite];
      if (!animDef) return [];
      const frameCount = animDef.length;
      const loopFrame = Math.floor((animationTime % (frameCount * OVERLAY_FRAME_DURATION_MS)) / OVERLAY_FRAME_DURATION_MS);
      const overlayGlyphs: AsciiGlyph[][] = Array.from({ length: fh }, () =>
        Array.from({ length: fw }, () => ({ ...TRANSPARENT }))
      );
      sheet.drawFrame(overlayGlyphs, loopSprite, loopFrame, null, null, dox, doy, animDef.palette[0] ?? 0);
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

  // Glyphing: find the active keyframe whose animation exists in the spritesheet.
  const activeKeyframe = keyframes.find(k =>
    k.room0 === room.index &&
    isKeyframeAnimating(k, spriteTime) &&
    !!sheet?.meta.spritesheet[k.animation]
  );
  const flyweight = activeKeyframe ? (animationFlyweights[activeKeyframe.animation] ?? null) : null;

  // No active spritesheet animation: fall back to static painter render.
  // Only skip if the entity is Unrendered — `name` is safe to use here since no transition is active.
  if (!activeKeyframe) {
    if (painter.renderers[name]?.type === "Unrendered") {
      return null;
    }
    painter.draw(name, { globals, locals: { coords: [0, 0], direction: 0, eyePaletteOverride: activeEyePalette } });
    const overlayDivs = buildOverlayDivs();
    const characterDiv = (
      <div className="animated-character" style={{ position: "absolute", left: `${x}ch`, top: `${y}em`, pointerEvents: "none" }}>
        {blockToText(globals.glyphs)}
      </div>
    );
    if (overlayDivs.length === 0) return characterDiv;
    return <>{characterDiv}{overlayDivs}</>;
  }

  const frameGlyphs: AsciiGlyph[][] = Array.from({ length: fh }, () =>
    Array.from({ length: fw }, () => ({ ...TRANSPARENT }))
  );

  const animName = activeKeyframe.animation;
  // console.log(`role: ${name}, animation: ${animName}`);
  const animDef = sheet!.meta.spritesheet[animName];
  const frameCount = animDef?.length ?? 1;
  const glyphProgress = activeKeyframe.t1 > activeKeyframe.t0
    ? Math.max(0, Math.min(1, (spriteTime - activeKeyframe.t0) / (activeKeyframe.t1 - activeKeyframe.t0)))
    : 0;
  const frameIndex = Math.min(Math.floor(glyphProgress * frameCount), frameCount - 1);

  let beforeGlyphs: AsciiGlyph[][] | null = null;
  let afterGlyphs: AsciiGlyph[][] | null = null;

  if (flyweight?.isTransition) {
    // const tp = transitionPainter ?? painter;
    const tp = painter;
    const beforeName = tp.indexMap[activeKeyframe.data[0]];
    const afterName = tp.indexMap[activeKeyframe.data[1]];
    // Only drop if the indexMap is populated — an empty indexMap means flyweights haven't
    // been applied yet (React effect timing), not that the sprites are absent.
    if (Object.keys(tp.indexMap).length > 0) {
      const beforeRenderer = beforeName ? tp.getRenderer(beforeName) : null;
      const afterRenderer = afterName ? tp.getRenderer(afterName) : null;
      if ((!beforeRenderer || beforeRenderer.type === "Unrendered") &&
          (!afterRenderer || afterRenderer.type === "Unrendered")) {
        return null;
      }
    }
    const [sw, sh] = globals.textures.icons.meta.size;
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
    const [sw, sh] = globals.textures.icons.meta.size;
    const makeBuffer = (): AsciiGlyph[][] =>
      Array.from({ length: sh }, () => Array.from({ length: sw }, () => ({ ...TRANSPARENT })));
    const buf = makeBuffer();
    painter.draw(name, { globals: { ...globals, glyphs: buf }, locals: { coords: [0, 0], direction: 0, eyePaletteOverride: activeEyePalette } });
    beforeGlyphs = buf;
    afterGlyphs = buf;
  }

  const paletteKeys = animDef?.palette ?? [0];
  const animPalette = paletteKeys[Math.min(Math.floor(glyphProgress * paletteKeys.length), paletteKeys.length - 1)];

  sheet!.drawFrame(frameGlyphs, animName, frameIndex, beforeGlyphs, afterGlyphs, dox, doy, animPalette);

  const overlayDivs = buildOverlayDivs();
  const animatedDiv = (
    <div className="animated-character" style={{ position: "absolute", left: `${x - dox}ch`, top: `${y - doy}em`, pointerEvents: "none" }}>
      {blockToText(frameGlyphs)}
    </div>
  );
  if (overlayDivs.length === 0) return animatedDiv;
  return <>{animatedDiv}{overlayDivs}</>;
}
