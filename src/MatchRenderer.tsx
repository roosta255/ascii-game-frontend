import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSynth } from "./audio/index";
import { blockToText } from "./functions/blockToText";
import { Texture } from "./assets/Texture";
import { SpritesheetPainter } from "./assets/SpritesheetPainter";
import { Painter, FlyweightEntry, AnimationFlyweight } from "./assets/Painter";
import { decorateFlyweights } from "./assets/flyweightLabels";
import { AnimatedCharacter } from "./types/AnimatedCharacter";
import { loadXp, createBlankCanvas } from "./types/AsciiGlyph";
import { DrawerProps, rebuildGlyphs } from "./types/DrawerProps";
import { calculatePosition, GridCalculator } from "./types/GridCalculator";
import { createMovePrediction, createLockBouncePrediction, isKeyframeDuplicate, isKeyframeAnimating, Keyframe, predictedMovesRemaining, predictedActionsRemaining, createMoveDecrementPrediction, createActionDecrementPrediction } from "./types/Keyframe";
import { CellSize } from "./types/CellSize";
import { TimeRef } from "./types/TimeRef";
import { RoomPropLoader, RoomProps, toFloorGlyphsFromCell, toFloorGlyphsFromDoor, toFloorGlyphsFromLock } from "./types/RoomProps";
import { useIsMobile } from "./hooks/useIsMobile";
import { drawChestAt } from "./drawers/drawChest";
import { buildEventSentence } from "./functions/buildEventSentence";
import { FADE_DURATION, HIGHLIGHT_COLOR, NORMAL_COLOR, lerpColor, computeFade, makeEventKey, syncEventTimestamps, resolveAction, computeEventLogRows } from "./functions/eventLogAnimation";
import "./MatchRenderer.css";

const DEBUG_KEYFRAMES = import.meta.env.VITE_DEBUG_KEYFRAMES === 'true';
const EVENT_LOG_CAPACITY = 8;

function debugKeyframes(label: string, keyframes: Keyframe[]) {
  if (!DEBUG_KEYFRAMES) return;
  console.groupCollapsed(`[keyframes] ${label} (${keyframes.length})`);
  console.log(JSON.stringify(keyframes, null, 2));
  console.groupEnd();
}

export interface MatchRendererProps {
  match: any;
  viewedRoomId: number;
  setViewedRoomId: (id: number) => void;
  timeRef: TimeRef;
  refreshMatch: () => Promise<void>;
}

function getAllCharacters(match: any): any[] {
  const dungeonChars = match.dungeon?.characters ?? [];
  const builderChars = match.builders?.map((b: any) => b.character) ?? [];
  const allCharacters = [...dungeonChars, ...builderChars];
  return allCharacters;
}

export default function MatchRenderer({ match, viewedRoomId, setViewedRoomId, timeRef, refreshMatch }: MatchRendererProps) {
  const [backgroundTexture, setBackgroundTexture] = useState<Texture | null>(null);
  const [minimapTexture, setMinimapTexture] = useState<Texture | null>(null);
  const [spriteMeta, setSpriteMeta] = useState<any>(null);
  const [rolePainter, setRolePainter] = useState<Painter | null>(null);
  const [itemPainter, setItemPainter] = useState<Painter | null>(null);
  const [doorPainter, setDoorPainter] = useState<Painter | null>(null);
  const [lockPainter, setLockPainter] = useState<Painter | null>(null);
  const [chestLockPainter, setChestLockPainter] = useState<Painter | null>(null);
  const [roomPropLoader, setRoomPropLoader] = useState<RoomPropLoader | null>(null);
  const [doorwayPainter, setDoorwayPainter] = useState<Painter | null>(null);
  const [backgroundPainter, setBackgroundPainter] = useState<Painter | null>(null);
  const [iconsTexture, setIconsTexture] = useState<Texture | null>(null);
  const [animationSheet, setAnimationSheet] = useState<SpritesheetPainter | null>(null);
  const [renderTime, setRenderTime] = useState<number>(0);
  const [flyweights, setFlyweights] = useState<{ roles: FlyweightEntry[]; doors: FlyweightEntry[]; locks: FlyweightEntry[]; items: FlyweightEntry[]; animations: AnimationFlyweight[]; } | null>(null);
  const [lockRules, setLockRules] = useState<any[] | null>(null);
  const [traitPainter, setTraitPainter] = useState<Painter | null>(null);

  const cellSize = useRef<CellSize | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const naturalCanvasWidthRef = useRef(0);
  const isMobile = useIsMobile();
  const [showInventory, setShowInventory] = useState(false);
  const [showCharacter, setShowCharacter] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<'inventory' | 'character' | 'chest' | 'log' | 'match'>('inventory');
  const [showEventLog, setShowEventLog] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const navigate = useNavigate();
  const [selectedChestId, setSelectedChestId] = useState<number | null>(null);
  const [sheetPage, setSheetPage] = useState('attributes');
  const [roomTransition, setRoomTransition] = useState<{toRoom: number;direction: number;endTime: number;} | null>(null);
  const [predictedMoves, setPredictedMoves] = useState<Keyframe[]>([]);
  const [requestErrorLog, setRequestErrorLog] = useState<any[] | null>(null);
  const [interaction, setInteraction] = useState<{
    type: 'idle' | 'awaitingItem';
    target?: { kind: 'lock'; direction: number };
    validItemTypes?: string[];
  }>(() => ({ type: 'idle' }));
  // Stat predictions (moves/actions consumed). Kept as a ref so rapid clicks
  // read the latest value synchronously without waiting for a React re-render.
  const predictedStatsRef = useRef<Keyframe[]>([]);
  // Synchronous refs for movement prediction chaining between rapid clicks.
  const predictedMovesRef = useRef<Keyframe[]>([]);
  const predictedLocationRef = useRef<{ type: string; data: number; t1: number } | null>(null);
  // Tracks the local performance.now() timestamp when a non-predicted keyframe was first seen.
  // Key: `${animation}_${t0}`. Used to play animations from the beginning when first detected on the client.
  const shortAnimClocksRef = useRef<Map<string, number>>(new Map());
  // Records the client timestamp when the viewed room last changed. Animations whose server
  // start time maps to before this value are treated as pre-existing and not replayed.
  const roomEntryTimeRef = useRef<number>(performance.now());
  // Per-room event timestamps: roomId -> (eventKey -> timeFirstSeen).
  // Kept across room transitions so returning to a room doesn't re-highlight old events.
  const eventLogTimestampsRef = useRef<Map<number, Map<string, number>>>(new Map());
  function getRoomTimestamps(roomId: number): Map<string, number> {
    if (!eventLogTimestampsRef.current.has(roomId)) {
      eventLogTimestampsRef.current.set(roomId, new Map());
    }
    return eventLogTimestampsRef.current.get(roomId)!;
  }

  useEffect(() => {
    roomEntryTimeRef.current = performance.now();
    shortAnimClocksRef.current.clear();
    setSelectedChestId(null);
  }, [viewedRoomId]);

  useEffect(() => {
    document.fonts.load("16px 'RexPaintFont'").then(() => {
      console.log("✅ RexPaintFont loaded");
      // Force re-measurement: the baseline width may have been captured with the
      // fallback font if assets finished loading before the font did.
      naturalCanvasWidthRef.current = 0;
    });

    fetch(`${import.meta.env.BASE_URL}knossos-2025-room.json`)
      .then(res => res.json())
      .then(meta =>
        fetch(`${import.meta.env.BASE_URL}${meta.path}`)
          .then(res => res.arrayBuffer())
          .then(loadXp)
          .then(layers => setBackgroundTexture(new Texture(layers[0], meta)))
      )
      .catch(err => console.error("❌ Failed to load background:", err));

    fetch(`${import.meta.env.BASE_URL}minimap-5x4.json`)
      .then(res => res.json())
      .then(meta =>
        fetch(`${import.meta.env.BASE_URL}${meta.path}`)
          .then(res => res.arrayBuffer())
          .then(loadXp)
          .then(layers => setMinimapTexture(new Texture(layers[0], meta)))
      )
      .catch(err => console.error("❌ Failed to load background:", err));

    fetch(`${import.meta.env.BASE_URL}icons.json`)
      .then(res => res.json())
      .then(meta => {
        setSpriteMeta(meta);
        return fetch(`${import.meta.env.BASE_URL}${meta.path}`)
          .then(res => res.arrayBuffer())
          .then(loadXp)
          .then(layers => setIconsTexture(new Texture(layers[0], meta)));
      })
      .catch(err => console.error("❌ Failed to load icons:", err));

    SpritesheetPainter.load(
      `${import.meta.env.BASE_URL}icon-animations-spritesheet.json`,
      import.meta.env.BASE_URL,
    )
      .then(setAnimationSheet)
      .catch(err => console.error("❌ Failed to load icon-animations-spritesheet:", err));

    RoomPropLoader.load(`${import.meta.env.BASE_URL}rooms.json`)
      .then(setRoomPropLoader)
      .catch(err => console.error("❌ Failed to load rooms.json:", err));

    Painter.load(`${import.meta.env.BASE_URL}roles.json`)
      .then(setRolePainter)
      .catch(err => console.error("❌ Failed to load roles.json:", err));

    Painter.load(`${import.meta.env.BASE_URL}items.json`)
      .then(setItemPainter)
      .catch(err => console.error("❌ Failed to load items.json:", err));

    Painter.load(`${import.meta.env.BASE_URL}backgrounds.json`)
      .then(setBackgroundPainter)
      .catch(err => console.error("❌ Failed to load backgrounds.json:", err));

    Painter.load(`${import.meta.env.BASE_URL}doorways.json`)
      .then(setDoorwayPainter)
      .catch(err => console.error("❌ Failed to load doorways.json:", err));

    Painter.load(`${import.meta.env.BASE_URL}doors.json`)
      .then(setDoorPainter)
      .catch(err => console.error("❌ Failed to load doors.json:", err));

    Painter.load(`${import.meta.env.BASE_URL}locks.json`)
      .then(setLockPainter)
      .catch(err => console.error("❌ Failed to load locks.json:", err));

    Painter.load(`${import.meta.env.BASE_URL}chest_locks.json`)
      .then(setChestLockPainter)
      .catch(err => console.error("❌ Failed to load chest_locks.json:", err));

    fetch(`${API_BASE}/api/flyweights`)
      .then(res => res.json())
      .then(raw => decorateFlyweights(raw, import.meta.env.BASE_URL))
      .then(setFlyweights)
      .catch(err => console.error("❌ Failed to load flyweights:", err));

    Painter.load(`${import.meta.env.BASE_URL}status-effect-animations.json`)
      .then(setTraitPainter)
      .catch(err => console.error("❌ Failed to load status-effect-animations.json:", err));

    fetch(`${API_BASE}/api/flyweights/rules`)
      .then(res => res.json())
      .then(setLockRules)
      .catch(err => console.error("❌ Failed to load flyweights/rules:", err));
  }, []);

  useEffect(() => {
    if (!flyweights) return;
    if (rolePainter) rolePainter.setIndexMap(flyweights.roles);
    if (itemPainter) itemPainter.setIndexMap(flyweights.items);
    if (doorPainter) doorPainter.setIndexMap(flyweights.doors);
    if (lockPainter) lockPainter.setIndexMap(flyweights.doors);
    if (chestLockPainter) chestLockPainter.setIndexMap(flyweights.locks);
  }, [flyweights, rolePainter, itemPainter, doorPainter, lockPainter, chestLockPainter]);

  useEffect(() => {
    if (!roomTransition) return;

    const id = setInterval(() => {
      if (performance.now() >= roomTransition.endTime) {
        setViewedRoomId(roomTransition.toRoom);
        setRoomTransition(null);
      }
    }, 16);

    return () => clearInterval(id);
  }, [roomTransition]);

  useEffect(() => {
    const cancel = () => {
      if (interaction.type !== 'idle') {
        setInteraction({ type: 'idle' });
      }
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [interaction]);

  const lastLoggedKeyframesRef = useRef<string>('');
  // Log server keyframes whenever they actually change
  useEffect(() => {
    if (!DEBUG_KEYFRAMES || !match) return;
    const builderChar = match.builders?.[0]?.character;
    if (!builderChar) return;
    const json = JSON.stringify(builderChar.keyframes ?? []);
    if (json === lastLoggedKeyframesRef.current) return;
    lastLoggedKeyframesRef.current = json;
    debugKeyframes(`server → builder keyframes (t=${performance.now().toFixed(0)})`, builderChar.keyframes ?? []);
  }, [match]);

  // animation loop
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      setRenderTime(performance.now());
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const isRenderReady = backgroundTexture && spriteMeta && itemPainter && minimapTexture && rolePainter && roomPropLoader && doorPainter && lockPainter && chestLockPainter && doorwayPainter && backgroundPainter && iconsTexture && match;
  const isAnimationReady = isRenderReady && cellSize && renderTime;

  if (!isAnimationReady) {
    return (<div ref={sceneRef} className="scene">
        <pre>Loading...</pre>
      </div>);
  }

  const room = match.dungeon.rooms[viewedRoomId];

  const roomProps: RoomProps = {
    position: [0,0],
    cells: roomPropLoader.getProps(room.type),
    size: [room.width, room.height],
    index: viewedRoomId,
  };

  const globals: DrawerProps = {
    textures: {
      icons: iconsTexture,
      rooms: backgroundTexture,
      minimap: minimapTexture,
      animationSheet: animationSheet ?? undefined,
    },
    painters: {
      doors: doorPainter,
      items: itemPainter,
      locks: lockPainter,
      chestLocks: chestLockPainter,
      roles: rolePainter,
      backgrounds: backgroundPainter,
      doorways: doorwayPainter,
    },
    glyphs: createBlankCanvas(!isMobile && rightPanelMode === 'chest' ? 112 : 80, isMobile && selectedChestId != null ? 91 : isMobile && showInventory ? 70 : isMobile && showCharacter ? 67 : isMobile && showEventLog ? 42 + computeEventLogRows(room.eventLog ?? [], eventToSentence, EVENT_LOG_CAPACITY) : isMobile && showMatch ? 52 : 42),
    animatedExtras: [],
  };

  
  const animationFlyweights: Record<string, AnimationFlyweight> = Object.fromEntries(
    (flyweights?.animations ?? []).map(a => [a.name, a])
  );

  const BUILDER_ID = 0;
  const builderOffset = match.builders[BUILDER_ID].character.offset;
  function applyClientKeyframesToCharacter(character: any) {
    var characterCopy = {...character};
    if (builderOffset == character.characterId && predictedMoves.length != 0) {
      characterCopy.keyframes = predictedMoves.concat(character.keyframes.filter((k: Keyframe) => !predictedMoves.some(p => isKeyframeDuplicate(p, 10000, k))));
    }
    return characterCopy; 
  }

  // console.log("🧭 Rendering room ID:", viewedRoomId, room);
  const effectiveCharacters = getAllCharacters(match).map(c => applyClientKeyframesToCharacter(c));
  const offsetMap = Object.fromEntries(effectiveCharacters.map((c: any) => [c.offset, c]));
  const chestOffsetMap: Record<number, number> = {};
  (match.dungeon.chests ?? []).forEach((chest: any, index: number) => {
    if (chest.containerCharacterId != null) chestOffsetMap[chest.containerCharacterId] = index;
  });

  const account = match.builders[BUILDER_ID].player.account;
  const player = match.builders[BUILDER_ID].player;
  const times = timeRef.current;
  const isMatchStarted = !!match.isStarted;

  async function handleApiResponse(res: Response): Promise<{ ok: boolean; json: any }> {
    const text = await res.text();
    let json: any = null;
    try {
      const parsed = JSON.parse(text);
      json = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    } catch {}

    if (!res.ok) {
      console.info(`❌ HTTP ${res.status}`);
      console.error(text);
      if (json?.eventLog) {
        setRequestErrorLog(json.eventLog);
      } else {
        setRequestErrorLog([{ action: "UNKNOWN_ERROR" }]);
      }
      return { ok: false, json };
    }

    setRequestErrorLog(null);
    return { ok: true, json };
  }

  function markRegionClickable(
    startX: number,
    startY: number,
    width: number,
    height: number,
    onClick: () => void
  ) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const gx = startX + x;
        const gy = startY + y;
        if (globals.glyphs[gy]?.[gx]) {
          globals.glyphs[gy][gx].onClick = () => onClick();
        }
      }
    }
  }

  function writeText(x: number, y: number, text: string, fg: number, bg: number, onClick?: () => void) {
    for (let i = 0; i < text.length; i++) {
      if (globals.glyphs[y]?.[x + i]) {
        globals.glyphs[y][x + i] = { char: text[i], fg, bg, onClick };
      }
    }
  }

  function formatTrait(name: string): string {
    return name.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function builderHasTrait(traitName: string): boolean {
    const sheet = match.builders[BUILDER_ID].character?.sheet;
    if (!sheet) return false;
    for (const page of Object.values(sheet) as any[][]) {
      for (const t of page) {
        if (t.trait === traitName && t.isPresent) return true;
      }
    }
    return false;
  }

  async function leaveMatch() {
    const res = await fetch(`${API_BASE}/api/match/${match.filename}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account }),
    });
    if (res.ok) navigate('/');
  }

  function resolveLabel(name: string, typename: string): string {
    const entries = typename === 'ROLE' ? flyweights?.roles
      : typename === 'DOOR' ? flyweights?.doors
      : typename === 'ITEM' ? flyweights?.items
      : null;
    return entries?.find(e => e.name === name)?.label ?? name.toLowerCase().replace(/_/g, ' ');
  }

  function eventToSentence(event: any): string {
    return buildEventSentence({
      actor: resolveLabel(event.actor.name, event.actor.typename),
      action: resolveAction(event.action),
      tool: event.tool ? resolveLabel(event.tool.name, event.tool.typename) : undefined,
      target: event.target ? resolveLabel(event.target.name, event.target.typename) : undefined,
      direction: event.direction?.toLowerCase(),
    });
  }


  function safeEventToSentence(event: any): string {
    try {
      return eventToSentence(event);
    } catch {
      return event.action?.toLowerCase().replace(/_/g, ' ') ?? 'unknown error';
    }
  }

  function drawEventLogAt(offset: [number, number], errorLog?: any[] | null) {
    const [ox, oy] = offset;
    const WIDTH = 39;
    const BG = 0x000000;
    const now = performance.now();

    writeText(ox, oy, 'EVENT LOG', 0x888888, BG);
    writeText(ox, oy + 1, '\u2500'.repeat(WIDTH), 0x444444, BG);

    const eventLog: any[] = room.eventLog ?? [];
    const visible = eventLog.slice(-EVENT_LOG_CAPACITY);
    let row = oy + 2;

    if (visible.length === 0) {
      writeText(ox, row, 'No events yet.', 0x555555, BG);
      row++;
    } else {

    // Register newly seen events; evict stale keys no longer in the visible window.
    syncEventTimestamps(visible, getRoomTimestamps(viewedRoomId), now);

    for (let i = 0; i < visible.length; i++) {
      const event = visible[i];
      const key = makeEventKey(event);
      const timeAdded = getRoomTimestamps(viewedRoomId).get(key) ?? now;
      const fade = computeFade(timeAdded, now);
      const fg = lerpColor(HIGHLIGHT_COLOR, NORMAL_COLOR, fade);

      const sentence = eventToSentence(event);
      const words = sentence.split(' ');
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (candidate.length > WIDTH) {
          writeText(ox, row++, line, fg, BG);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) writeText(ox, row++, line, fg, BG);
      row++; // blank line between events
    }
    } // end else (visible.length > 0)

    // --- ERROR LOG BLOCK ---
    if (errorLog && errorLog.length > 0) {
      row++; // spacing
      writeText(ox, row++, '--- ACTION FAILED ---', 0xff5555, BG);

      for (const event of errorLog) {
        const sentence = safeEventToSentence(event);
        const words = sentence.split(' ');
        let line = '';

        for (const word of words) {
          const candidate = line ? `${line} ${word}` : word;
          if (candidate.length > WIDTH) {
            writeText(ox, row++, line, 0xff5555, BG);
            line = word;
          } else {
            line = candidate;
          }
        }

        if (line) writeText(ox, row++, line, 0xff5555, BG);
        row++;
      }
    }
  }

  function drawCharacterSheetAt(offset: [number, number]) {
    const sheet = match.builders[BUILDER_ID].character.sheet;
    if (!sheet) return;

    const [ox, oy] = offset;
    const WIDTH = 39;
    const BG        = 0x000000;
    const HIGHLIGHT  = 0x888888;
    const DARK_GRAY  = 0x555555;
    const LIGHT_GRAY = 0xaaaaaa;
    const PRESENT_FG = 0x88bb88;
    const ABSENT_FG  = 0xbb8888;

    // Writes a sequence of colored words with word-wrap; returns the next row.
    type CW = { word: string; fg: number };
    function writeWords(startX: number, startRow: number, words: CW[], indent: number = 0): number {
      let x = startX;
      let y = startRow;
      let lineStart = true;
      for (const { word, fg } of words) {
        if (!lineStart) {
          const needsWrap = x + 1 + word.length > ox + WIDTH;
          if (needsWrap) {
            y++;
            x = ox + indent;
            lineStart = true;
          } else {
            if (globals.glyphs[y]?.[x]) globals.glyphs[y][x] = { char: ' ', fg: DARK_GRAY, bg: BG };
            x++;
          }
        }
        writeText(x, y, word, fg, BG);
        x += word.length;
        lineStart = false;
      }
      return y + 1;
    }

    const PAGES = ['roles', 'attributes', 'capabilities', 'states', 'afflictions', 'debuffs', 'characters'];
    const PAGE_LABELS: Record<string, string> = {
      roles: 'ROLE', attributes: 'ATTR', capabilities: 'CAPA',
      states: 'STAT', afflictions: 'AFFL', debuffs: 'DEBT', characters: 'CHAR',
    };

    // Page tabs
    let tx = ox;
    for (const p of PAGES) {
      const label = PAGE_LABELS[p];
      const isActive = sheetPage === p;
      const pageCopy = p;
      const pageEmpty = (sheet[p] ?? []).length === 0;
      if (pageEmpty) {
        writeText(tx, oy, label, 0x333333, BG);
      } else if (isActive) {
        for (let bx = tx - 1; bx <= tx + label.length; bx++) {
          if (globals.glyphs[oy - 1]?.[bx]) globals.glyphs[oy - 1][bx] = { char: '\u2584', fg: HIGHLIGHT, bg: BG };
        }
        if (globals.glyphs[oy]?.[tx - 1])           globals.glyphs[oy][tx - 1]           = { char: '\u2590', fg: HIGHLIGHT, bg: BG };
        writeText(tx, oy, label, 0x000000, HIGHLIGHT, () => setSheetPage(pageCopy));
        if (globals.glyphs[oy]?.[tx + label.length]) globals.glyphs[oy][tx + label.length] = { char: '\u258c', fg: HIGHLIGHT, bg: BG };
      } else {
        writeText(tx, oy, label, DARK_GRAY, BG, () => setSheetPage(pageCopy));
      }
      tx += label.length + 1;
    }

    // Separator
    writeText(ox, oy + 1, '\u2500'.repeat(WIDTH), 0x444444, BG);

    const traits: any[] = sheet[sheetPage] ?? [];
    const isAttributePage = sheetPage === 'attributes';
    let row = oy + 2;

    for (const trait of traits) {
      if (row >= globals.glyphs.length) break;
      const nameFg = !trait.isPresent ? ABSENT_FG : trait.upstream.length > 0 ? PRESENT_FG : LIGHT_GRAY;
      const nameWords = formatTrait(trait.trait).toLowerCase().split(' ');

      if (isAttributePage) {
        // Line 1: "<name> grants <down1> & <down2> ..."
        const line1: CW[] = nameWords.map(w => ({ word: w, fg: nameFg }));
        if (trait.downstream.length > 0) {
          line1.push({ word: 'grants', fg: DARK_GRAY });
          for (let i = 0; i < trait.downstream.length; i++) {
            if (i > 0) line1.push({ word: '&', fg: DARK_GRAY });
            line1.push({ word: formatTrait(trait.downstream[i]).toLowerCase(), fg: LIGHT_GRAY });
          }
        }
        row = writeWords(ox, row, line1, 2);

        // Line 2: "* gained from <up1> & <up2> ..."
        if (trait.upstream.length > 0) {
          if (row >= globals.glyphs.length) break;
          const line2: CW[] = [
            { word: '*', fg: DARK_GRAY },
            { word: 'gained', fg: DARK_GRAY },
            { word: 'from', fg: DARK_GRAY },
          ];
          for (let i = 0; i < trait.upstream.length; i++) {
            if (i > 0) line2.push({ word: '&', fg: DARK_GRAY });
            line2.push({ word: formatTrait(trait.upstream[i]).toLowerCase(), fg: LIGHT_GRAY });
          }
          row = writeWords(ox, row, line2, 2);
        }
      } else {
        // Standard page: ". Name" or "* Name"
        const icon = trait.isPresent ? '*' : '.';
        const line1: CW[] = [{ word: icon, fg: DARK_GRAY }, ...nameWords.map(w => ({ word: w, fg: nameFg }))];
        row = writeWords(ox, row, line1, 2);

        if (trait.upstream.length > 0 && row < globals.glyphs.length) {
          const upWords: CW[] = [{ word: 'cause:', fg: DARK_GRAY }];
          for (let i = 0; i < trait.upstream.length; i++) {
            if (i > 0) upWords.push({ word: '&', fg: DARK_GRAY });
            upWords.push({ word: formatTrait(trait.upstream[i]).toLowerCase(), fg: LIGHT_GRAY });
          }
          row = writeWords(ox + 2, row, upWords, 2);
        }
        if (trait.downstream.length > 0 && row < globals.glyphs.length) {
          const downWords: CW[] = [{ word: 'effect:', fg: DARK_GRAY }];
          for (let i = 0; i < trait.downstream.length; i++) {
            if (i > 0) downWords.push({ word: '&', fg: DARK_GRAY });
            downWords.push({ word: formatTrait(trait.downstream[i]).toLowerCase(), fg: LIGHT_GRAY });
          }
          row = writeWords(ox + 2, row, downWords, 2);
        }
      }

      // Blank line between entries
      row++;
    }
  }

  function drawMatchPanelAt(offset: [number, number]) {
    const [ox, oy] = offset;
    const BG = 0x000000;

    const hasExited = builderHasTrait('EXITED_DUNGEON');
    const isDead = builderHasTrait('IS_DEAD');
    const isMangled = builderHasTrait('IS_MANGLED');

    let buttonLabel: string;
    let statusText: string;
    let statusFg: number;
    if (hasExited) {
      buttonLabel = 'ACCEPT VICTORY';
      statusText = 'You have escaped the dungeon.';
      statusFg = 0x88bb88;
    } else if (isDead || isMangled) {
      buttonLabel = 'ACCEPT DEFEAT';
      statusText = 'Your character has fallen.';
      statusFg = 0xbb8888;
    } else {
      buttonLabel = 'ABANDON MATCH';
      statusText = 'Leave the match at any time.';
      statusFg = 0x888888;
    }

    writeText(ox, oy, 'MATCH', 0x888888, BG);
    writeText(ox, oy + 1, '─'.repeat(39), 0x444444, BG);
    writeText(ox, oy + 3, statusText, statusFg, BG);
    const btn = '[ ' + buttonLabel + ' ]';
    writeText(ox, oy + 5, btn, statusFg, BG, () => { leaveMatch(); });
  }

  async function activateLock(direction: number, itemIndex?: number) {
    const builderCharacter = match.builders[BUILDER_ID].character;
    const bouncePrediction = createLockBouncePrediction(viewedRoomId, direction, builderCharacter, times);
    if (bouncePrediction) {
      const newPredictions = [...predictedMovesRef.current, bouncePrediction];
      predictedMovesRef.current = newPredictions;
      setPredictedMoves(newPredictions);
    }
    const isForcedTurnEnd = predictedActionsRemaining(builderCharacter.actionsRemaining, predictedStatsRef.current, times.fetchTime) === 0;
    predictedStatsRef.current = [...predictedStatsRef.current, createActionDecrementPrediction(builderCharacter.actionsRemaining, predictedStatsRef.current, times)];
    const moveBody: any = { account, character: builderOffset, room: viewedRoomId, direction, isForcedTurnEnd };
    if (itemIndex !== undefined) moveBody.item = itemIndex;
    const stringifiedBody = JSON.stringify(moveBody);
    getSynth().playSquare(220);
    const lockRes = await fetch(`${API_BASE}/api/match/${match.filename}/activate_lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stringifiedBody,
    });
    console.log("Lock request:", stringifiedBody);
    const { ok: lockOk, json: lockJson } = await handleApiResponse(lockRes);
    if (!lockOk) return;
    console.log("✅ Lock success response:", lockJson);
    await refreshMatch();
  }

  function drawRoomAt(roomX: number, roomY: number, room: any, roomId: number) {

    // TODO: remove global mutation
    roomProps.position = [roomX, roomY];

    function drawCharacterAt(drawX: number, drawY: number, cell: any) {
      const character = cell.offset && offsetMap[cell.offset];
      if (!character) return;

      const traits: string[] = character.traitsComputed ?? [];
      const hasAnimation = character.keyframes.find((k: Keyframe) => isKeyframeAnimating(k, animationTime)) !== undefined;
      const hasStatusEffect = traitPainter != null && traits.some((t: string) => t in traitPainter.renderers);

      if (hasAnimation || hasStatusEffect) {
        globals.animatedExtras.push(
          <AnimatedCharacter
            key={`character-${character.offset}`}
            keyframes={character.keyframes}
            painter={rolePainter!}
            name={character.role}
            animationFlyweights={animationFlyweights}
            animationTime={animationTime}
            localAnimationTime={entityLocalAnimTime(character.keyframes)}
            globals={globals}
            room={roomProps}
            fallbackPosition={[drawX, drawY]}
            traitsComputed={traits}
            traitPainter={traitPainter ?? undefined}
          />
        );
        return;
      }
      const chestIndex = chestOffsetMap[character.offset];
      if (chestIndex != null) {
        globals.painters.roles.draw(character.role, {globals, locals: {coords: [drawX, drawY], onClick: () => { setSelectedChestId(chestIndex); setRightPanelMode('chest'); setShowEventLog(false); }}});
        return;
      }
      const onClick = (!character.isActionable || !isMatchStarted) ? undefined : async () => {
        try {
          const builderCharacter = match.builders[BUILDER_ID].character;
          const isForcedTurnEnd = predictedActionsRemaining(builderCharacter.actionsRemaining, predictedStatsRef.current, times.fetchTime) === 0;
          predictedStatsRef.current = [...predictedStatsRef.current, createActionDecrementPrediction(builderCharacter.actionsRemaining, predictedStatsRef.current, times)];
          debugKeyframes(`character click → predicted stats`, predictedStatsRef.current);
          debugKeyframes(`character click → builder keyframes (server)`, builderCharacter.keyframes ?? []);
          getSynth().playSquare(220);
          const target = character.isObject ? builderOffset : cell.offset;
          const activator = character.isObject ? cell.offset : builderOffset;
          const activateBody = { account, room: roomId, character: activator, target, isForcedTurnEnd };
          const stringifiedBody = JSON.stringify(activateBody);
          const response = await fetch(`${API_BASE}/api/match/${match.filename}/activate_character`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: stringifiedBody,
          });
          const { ok } = await handleApiResponse(response);
          if (!ok) {
            predictedStatsRef.current = [];
            return;
          }
          console.log("Character activated");
          await refreshMatch();
          predictedStatsRef.current = [];
        } catch (error) {
          console.error("Error activating character:", error);
          predictedStatsRef.current = [];
        }
      };
      // if (cell.offset == 168) {
      //   console.log("Drawing role: ", character.role);
      // }
      rolePainter.draw(character.role, {globals, locals: {coords: [drawX, drawY], onClick}});
    }

    globals.painters.backgrounds.draw(room.type, {globals, locals: {coords: [roomX, roomY], room}});
    globals.painters.doorways.draw(room.type, {globals, locals: {coords: [roomX, roomY], room}});

    const CELL_SIZE_X = 5;
    const CELL_SIZE_Y = 4;

    function setClickableFloor(drawX: number, drawY: number, floor: number) {
      if (!isMatchStarted) return;
      markRegionClickable(drawX, drawY, CELL_SIZE_X, CELL_SIZE_Y, async () => {
        try {
          const builderCharacter = match.builders[BUILDER_ID].character;
          const currentAnimTime = performance.now() - times.serverToClientOffset;
          const predictedLoc = predictedLocationRef.current;
          const activePredictedLoc = (predictedLoc && predictedLoc.t1 > currentAnimTime) ? predictedLoc : null;
          if (predictedLoc && !activePredictedLoc) {
            predictedMovesRef.current = [];
            predictedLocationRef.current = null;
          }
          const sourceCharacter = activePredictedLoc
            ? { ...builderCharacter, location: { type: activePredictedLoc.type, data: activePredictedLoc.data } }
            : builderCharacter;
          const movePrediction = createMovePrediction(roomId, floor, undefined, sourceCharacter, match, times, activePredictedLoc?.t1);
          const isForcedTurnEnd = predictedMovesRemaining(builderCharacter.movesRemaining, predictedStatsRef.current, times.fetchTime) === 0;
          if (movePrediction.length > 0) {
            predictedStatsRef.current = [...predictedStatsRef.current, createMoveDecrementPrediction(builderCharacter.movesRemaining, predictedStatsRef.current, times)];
            predictedLocationRef.current = { type: 'FLOOR', data: floor, t1: movePrediction[0].t1 };
          }
          const chainedPredictions = activePredictedLoc
            ? [...predictedMovesRef.current.filter(k => !k.animation.startsWith('STANDING_')), ...movePrediction]
            : movePrediction;
          predictedMovesRef.current = chainedPredictions;
          debugKeyframes(`floor click → predicted movement`, chainedPredictions);
          debugKeyframes(`floor click → builder keyframes (server)`, builderCharacter.keyframes ?? []);
          setPredictedMoves(chainedPredictions);
          const moveBody = {
            account,
            character: builderOffset,
            room: roomId,
            floor,
            isForcedTurnEnd,
          };

          getSynth().playSquare(220);

          const stringifyMoveBody = JSON.stringify(moveBody);

          // Move character (WAIT for it)
          const res = await fetch(
            `${API_BASE}/api/match/${match.filename}/move_character`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: stringifyMoveBody,
            }
          );

          console.log("Move request (non-JSON):", stringifyMoveBody);
          const bodyText = await res.text();

          if (!res.ok) {
            console.info(`❌ HTTP ${res.status} request:`, moveBody);
            console.error(`❌ HTTP ${res.status} response:`, bodyText);
            setPredictedMoves([]);
            predictedMovesRef.current = [];
            predictedLocationRef.current = null;
            throw new Error(`HTTP ${res.status}`);
          }

          // 3️⃣ Parse JSON only if it actually is JSON
          if (bodyText.trim().startsWith("{") || bodyText.trim().startsWith("[")) {
            console.log("✅ Move success:", JSON.parse(bodyText));
          } else {
            console.log("✅ Move success response (non-JSON):", bodyText);
          }

          // 4️⃣ Refresh AFTER move completes
          await refreshMatch();
          predictedStatsRef.current = [];

        } catch (err) {
          console.error("❌ Floor move failed:", err);
          setPredictedMoves([]);
          predictedMovesRef.current = [];
          predictedLocationRef.current = null;
          predictedStatsRef.current = [];
        }
      });
    }

    var i = 0;
    for (const cell of room.floorCells) {
      const [drawX, drawY] = toFloorGlyphsFromCell(roomProps, i);
      const character = cell.offset && offsetMap[cell.offset];
      if (!character) {
        setClickableFloor(drawX, drawY, i);
      } else {
        drawCharacterAt(drawX, drawY, cell);
      }
      i++;
    }

    function setClickableDoorway(drawX: number, drawY: number, direction: number, route: string, nextViewedRoomId?: number) {
      if (!isMatchStarted) return;
      markRegionClickable(drawX, drawY, CELL_SIZE_X, CELL_SIZE_Y, async () => {
        const builderCharacter = match.builders[BUILDER_ID].character;
        const currentAnimTime = performance.now() - times.serverToClientOffset;
        const predictedLoc = predictedLocationRef.current;
        const activePredictedLoc = (predictedLoc && predictedLoc.t1 > currentAnimTime) ? predictedLoc : null;
        if (predictedLoc && !activePredictedLoc) {
          predictedMovesRef.current = [];
          predictedLocationRef.current = null;
        }
        const sourceCharacter = activePredictedLoc
          ? { ...builderCharacter, location: { type: activePredictedLoc.type, data: activePredictedLoc.data } }
          : builderCharacter;
        const movePrediction = createMovePrediction(roomId, undefined, direction, sourceCharacter, match, times, activePredictedLoc?.t1);
        const isForcedTurnEnd = predictedMovesRemaining(builderCharacter.movesRemaining, predictedStatsRef.current, times.fetchTime) === 0;
        if (movePrediction.length > 0) {
          predictedStatsRef.current = [...predictedStatsRef.current, createMoveDecrementPrediction(builderCharacter.movesRemaining, predictedStatsRef.current, times)];
          predictedLocationRef.current = { type: 'DOOR', data: direction, t1: movePrediction[0].t1 };
        }
        const chainedPredictions = activePredictedLoc
          ? [...predictedMovesRef.current.filter(k => !k.animation.startsWith('STANDING_')), ...movePrediction]
          : movePrediction;
        predictedMovesRef.current = chainedPredictions;
        debugKeyframes(`door click → predicted movement`, chainedPredictions);
        debugKeyframes(`door click → builder keyframes (server)`, builderCharacter.keyframes ?? []);
        setPredictedMoves(chainedPredictions);
        getSynth().playSquare(220);
        const moveBody = { account, character: builderOffset, room: roomId, direction, isForcedTurnEnd };
        fetch(`${API_BASE}/api/match/${match.filename}/${route}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(moveBody),
        })
          .then(async res => {
            const bodyText = await res.text();
            if (!res.ok) {
              console.info(`❌ HTTP ${res.status} request: `, moveBody);
              console.error(`❌ HTTP ${res.status} response: `, bodyText);
              setPredictedMoves([]);
              predictedMovesRef.current = [];
              predictedLocationRef.current = null;
              throw new Error(`HTTP ${res.status}`);
            }
            try {
              console.log("✅ Move success:", JSON.parse(bodyText));
            } catch {
              console.warn("⚠️ Non-JSON response:", bodyText);
            }

            await refreshMatch();
            predictedStatsRef.current = [];

            // 🚀 Immediately switch room if doorway leads to adjacent room
            const wall = room.walls[direction];
            if (nextViewedRoomId !== undefined) {
              const now = performance.now();
              setRoomTransition({
                toRoom: nextViewedRoomId,
                direction,
                endTime: now + 1200, // match keyframe duration
              });
            }
          })
          .catch(err => {
            console.error("❌ Move failed:", err);
            setPredictedMoves([]);
            predictedMovesRef.current = [];
            predictedLocationRef.current = null;
            predictedStatsRef.current = [];
          });
      });
    }

    function getMatchingLockRules(direction: number): any[] {
      if (!lockRules) return [];
      const doorType = room.walls[direction].door;
      return lockRules.filter(rule => rule.target === doorType);
    }

    function setClickableLock(drawX: number, drawY: number, direction: number) {
      if (!isMatchStarted) return;
      markRegionClickable(drawX, drawY, CELL_SIZE_X, CELL_SIZE_Y, async () => {
        const rules = getMatchingLockRules(direction);
        const itemRules = rules.filter(r => r.requiresItem);
        const noItemRules = rules.filter(r => !r.requiresItem);

        if (itemRules.length > 0) {
          setInteraction({
            type: 'awaitingItem',
            target: { kind: 'lock', direction },
            validItemTypes: itemRules.map(r => r.itemType),
          });
          return;
        }

        if (noItemRules.length > 0 || rules.length === 0) {
          await activateLock(direction);
        }
      });
    }

    for (var i = 0; i < 4; i++) {
      {
        const wall = room.walls[i];
        let [dx, dy] = toFloorGlyphsFromDoor(roomProps, i);
        const cell = wall.cell;

        if (wall.keyframes?.some((k: Keyframe) => isLocallyAnimating(k))) {
          globals.animatedExtras.push(
            <AnimatedCharacter
              key={`wall-${i}-door`}
              keyframes={wall.keyframes}
              painter={doorPainter!}
              name={wall.door}
              animationFlyweights={animationFlyweights}
              animationTime={animationTime}
              localAnimationTime={entityLocalAnimTime(wall.keyframes)}
              position={[dx, dy]}
              globals={rebuildGlyphs(globals, 5, 4)}
              room={roomProps}
            />
          );
        } else {
          globals.painters.doors.draw(wall.door, {globals, locals: {coords: [dx, dy], direction: 0}});
        }

        if (wall.isDoorActionable) {
          let nextViewedRoomId: number | undefined;

          switch (wall.door) {
            case "LADDER_1_BOTTOM":
            case "POLE_1_BOTTOM":
              nextViewedRoomId = room.above;
              break;

            case "LADDER_1_TOP":
            case "POLE_1_TOP":
              nextViewedRoomId = room.below;
              break;

            case "TIME_GATE_AWAKENED":
              switch (room.type) {
                case "TIME_GATE_TO_FUTURE":
                  nextViewedRoomId = room.posterior;
                  break;
                case "TIME_GATE_TO_PAST":
                  nextViewedRoomId = room.anterior;
                  break;
              }
            default:
              nextViewedRoomId = undefined;
          }

          setClickableDoorway(dx, dy, i, "activate_door", nextViewedRoomId);
        }
        else if (!wall.isBlocking) {
          setClickableDoorway(dx, dy, i, "move_character", wall.adjacent);
        }
        drawCharacterAt(dx, dy, cell);
      }
      {
        const wall = room.walls[i];
        let [dx, dy] = toFloorGlyphsFromLock(roomProps, i);

        if (wall.lockKeyframes?.some((k: Keyframe) => isLocallyAnimating(k))) {
          globals.animatedExtras.push(
            <AnimatedCharacter
              key={`wall-${i}-lock`}
              keyframes={wall.lockKeyframes}
              painter={lockPainter!}
              name={wall.door}
              animationFlyweights={animationFlyweights}
              animationTime={animationTime}
              localAnimationTime={entityLocalAnimTime(wall.lockKeyframes)}
              position={[dx, dy]}
              transitionPainter={doorPainter!}
              globals={rebuildGlyphs(globals, 5, 4)}
              room={roomProps}
            />
          );
        } else {
          globals.painters.locks.draw(wall.door, {globals, locals: {coords: [dx, dy], direction: 0}});
        }

        if (wall.isLockActionable) {
          setClickableLock(dx, dy, i);
        }
      }
    }
  }

  const animationTime = performance.now() - times.serverToClientOffset;

  // Returns the effective animation time for a keyframe.
  // Non-predicted keyframes that started after the client entered the current room
  // get their own local clock so they always play from the beginning.
  // Pre-existing animations (started before room entry) use global time and will
  // appear finished if their window has already passed, preventing stale replay.
  function getLocalAnimTime(k: Keyframe): number {
    if (k.predicted) return animationTime;
    const clientAnimStart = k.t0 + times.serverToClientOffset;
    if (clientAnimStart < roomEntryTimeRef.current) return animationTime;
    const key = `${k.animation}_${k.t0}`;
    if (!shortAnimClocksRef.current.has(key)) {
      shortAnimClocksRef.current.set(key, performance.now());
      playAnimationSound(k.animation);
    }
    return k.t0 + (performance.now() - shortAnimClocksRef.current.get(key)!);
  }

  function playAnimationSound(animation: string): void {
    const synth = getSynth();
    switch (animation) {
      case "CRUSH":   synth.crush();   break;
      case "SLIDE":   synth.pop();     break;
      case "POOF":    synth.poof();    break;
      case "PICKUP":  synth.pickup();  break;
      case "UNLOCK":  synth.unlock();  break;
      case "ERROR":   synth.error();   break;
      case "DAMAGE":  synth.damage();  break;
      case "FALL":    synth.fall();    break;
      case "RISE":    synth.rise();    break;
      case "SPARK":   synth.spark();   break;
      case "POP":     synth.pop();     break;
      case "TOGGLER_SWITCH_BLUE":
                      synth.togglerSwitch(); break;
      case "TOGGLER_SWITCH_ORANGE":
                      synth.togglerSwitch(); break;
    }
  }

  function isLocallyAnimating(k: Keyframe): boolean {
    return isKeyframeAnimating(k, getLocalAnimTime(k));
  }

  // Returns the local clock time for the first non-predicted keyframe on an entity that
  // started after room entry, or undefined if none qualify (caller falls back to global animationTime).
  function entityLocalAnimTime(keyframes: Keyframe[]): number | undefined {
    for (const k of keyframes) {
      if (!k.predicted) {
        const local = getLocalAnimTime(k);
        if (isKeyframeAnimating(k, local)) return local;
      }
    }
    return undefined;
  }

  drawRoomAt(0, 0, room, viewedRoomId);

  function drawInventoryAt(offset: [number, number]) {
    if (player.inventory.isEmpty || !player.inventory.items.some((item: any) => item.type !== 'NIL')) {
      return;
    }
    globals.textures.minimap.draw(globals.glyphs, "INVENTORY", offset[0], offset[1], 0);
    const INVENTORY_WIDTH = 5;
    const inventoryGrid: GridCalculator = {
      position: offset,
      offset: [3, 3],
      stride: [6, 6],
    }
    for (const item of player.inventory.items) {
      const isHighlighted =
        interaction.type === 'awaitingItem' &&
        interaction.validItemTypes?.includes(item.type);

      const onClick = !item.isActionable ? undefined : async () => {
        // Interaction mode: use item on a lock
        if (interaction.type === 'awaitingItem') {
          if (!interaction.validItemTypes?.includes(item.type)) {
            getSynth().error?.();
            return;
          }
          if (interaction.target?.kind === 'lock') {
            // activateLock is defined inside drawRoomAt; call it via the ref captured below
            await activateLock(interaction.target.direction, item.index);
          }
          setInteraction({ type: 'idle' });
          return;
        }

        // Normal inventory activation
        try {
          getSynth().playSquare(220);
          const builderCharacter = match.builders[BUILDER_ID].character;
          const isForcedTurnEnd = predictedActionsRemaining(builderCharacter.actionsRemaining, predictedStatsRef.current, times.fetchTime) === 0;
          predictedStatsRef.current = [...predictedStatsRef.current, createActionDecrementPrediction(builderCharacter.actionsRemaining, predictedStatsRef.current, times)];
          const activateBody = { account, room: viewedRoomId, character: builderOffset, item: item.index, isForcedTurnEnd };
          const response = await fetch(`${API_BASE}/api/match/${match.filename}/activate_inventory_item`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(activateBody),
          });
          if (!response.ok) {
            console.warn(`Failed to activate inventory item, body: ${activateBody}`);
            console.error("Failed to activate inventory item, response:", await response.text());
            predictedStatsRef.current = [];
          } else {
            console.log("Inventory item activated");
            await refreshMatch();
            predictedStatsRef.current = [];
          }
        } catch (error) {
          console.error("Error activating inventory item:", error);
          predictedStatsRef.current = [];
        }
      };

      const itemCell: [number, number] = [item.index % INVENTORY_WIDTH, Math.floor(item.index / INVENTORY_WIDTH)];
      const itemDraw: [number, number] = calculatePosition(inventoryGrid, itemCell);
      if (item.keyframes?.some((k: Keyframe) => isLocallyAnimating(k))) {
        globals.animatedExtras.push(
          <AnimatedCharacter
            key={`item-${item.index}`}
            keyframes={item.keyframes}
            painter={itemPainter!}
            name={item.type}
            animationFlyweights={animationFlyweights}
            animationTime={animationTime}
            localAnimationTime={entityLocalAnimTime(item.keyframes)}
            position={itemDraw}
            globals={rebuildGlyphs(globals, 6, 6)}
            room={roomProps}
          />
        );
      } else if (item.type !== "NIL") {
        globals.painters.items.draw(item.type, {globals, locals: {coords: itemDraw, onClick}});
        if (isHighlighted) {
          for (let dy = 0; dy < 6; dy++) {
            for (let dx = 0; dx < 6; dx++) {
              const g = globals.glyphs[itemDraw[1] + dy]?.[itemDraw[0] + dx];
              if (g) g.bg = 0x225522;
            }
          }
        }
        if (item.stacks > 1) {
          const sx = itemDraw[0] + 3;
          const sy = itemDraw[1] + 5;
          if (globals.glyphs[sy]?.[sx]) {
            globals.glyphs[sy][sx] = { char: String(item.stacks), fg: 0xffffff, bg: 0x000000 };
          }
        }
      }
    }
  }

  const chestProps = { globals, account, match, viewedRoomId, builderOffset, BUILDER_ID, predictedStatsRef, times, refreshMatch, animationFlyweights, animationTime, roomProps, isLocallyAnimating, entityLocalAnimTime, isMatchStarted };

  if (!isMobile) {
    // Panel toggle tabs
    const PANEL_HL = 0x888888;
    const invActive = rightPanelMode === 'inventory';
    const chrActive = rightPanelMode === 'character';
    if (invActive) {
      for (let bx = 40; bx <= 50; bx++) {
        if (globals.glyphs[0]?.[bx]) globals.glyphs[0][bx] = { char: '\u2584', fg: PANEL_HL, bg: 0x000000 };
      }
      if (globals.glyphs[1]?.[40]) globals.glyphs[1][40] = { char: '\u2590', fg: PANEL_HL, bg: 0x000000 };
      writeText(41, 1, 'INVENTORY', 0x000000, PANEL_HL, () => setRightPanelMode('inventory'));
      if (globals.glyphs[1]?.[50]) globals.glyphs[1][50] = { char: '\u258c', fg: PANEL_HL, bg: 0x000000 };
    } else {
      writeText(41, 1, 'INVENTORY', 0x555555, 0x000000, () => setRightPanelMode('inventory'));
    }
    if (chrActive) {
      for (let bx = 50; bx <= 60; bx++) {
        if (globals.glyphs[0]?.[bx]) globals.glyphs[0][bx] = { char: '\u2584', fg: PANEL_HL, bg: 0x000000 };
      }
      if (globals.glyphs[1]?.[50]) globals.glyphs[1][50] = { char: '\u2590', fg: PANEL_HL, bg: 0x000000 };
      writeText(51, 1, 'CHARACTER', 0x000000, PANEL_HL, () => setRightPanelMode('character'));
      if (globals.glyphs[1]?.[60]) globals.glyphs[1][60] = { char: '\u258c', fg: PANEL_HL, bg: 0x000000 };
    } else {
      writeText(51, 1, 'CHARACTER', 0x555555, 0x000000, () => setRightPanelMode('character'));
    }
    const logActive = rightPanelMode === 'log';
    if (logActive) {
      for (let bx = 60; bx <= 64; bx++) {
        if (globals.glyphs[0]?.[bx]) globals.glyphs[0][bx] = { char: '\u2584', fg: PANEL_HL, bg: 0x000000 };
      }
      if (globals.glyphs[1]?.[60]) globals.glyphs[1][60] = { char: '\u2590', fg: PANEL_HL, bg: 0x000000 };
      writeText(61, 1, 'LOG', 0x000000, PANEL_HL, () => setRightPanelMode('log'));
      if (globals.glyphs[1]?.[64]) globals.glyphs[1][64] = { char: '\u258c', fg: PANEL_HL, bg: 0x000000 };
    } else {
      writeText(61, 1, 'LOG', 0x555555, 0x000000, () => setRightPanelMode('log'));
    }
    const matchActive = rightPanelMode === 'match';
    if (matchActive) {
      for (let bx = 64; bx <= 70; bx++) {
        if (globals.glyphs[0]?.[bx]) globals.glyphs[0][bx] = { char: '\u2584', fg: PANEL_HL, bg: 0x000000 };
      }
      if (globals.glyphs[1]?.[64]) globals.glyphs[1][64] = { char: '\u2590', fg: PANEL_HL, bg: 0x000000 };
      writeText(65, 1, 'MATCH', 0x000000, PANEL_HL, () => setRightPanelMode('match'));
      if (globals.glyphs[1]?.[70]) globals.glyphs[1][70] = { char: '\u258c', fg: PANEL_HL, bg: 0x000000 };
    } else {
      writeText(65, 1, 'MATCH', 0x555555, 0x000000, () => setRightPanelMode('match'));
    }
    const chest = selectedChestId != null ? (match.dungeon.chests ?? [])[selectedChestId] : null;
    if (rightPanelMode === 'chest' && chest) {
      drawInventoryAt([41, 13]);
      drawChestAt([76, 13], { ...chestProps, chest });
    } else if (rightPanelMode === 'inventory') {
      drawInventoryAt([41, 13]);
    } else if (rightPanelMode === 'log') {
      drawEventLogAt([41, 3], requestErrorLog);
    } else if (rightPanelMode === 'match') {
      drawMatchPanelAt([41, 3]);
    } else {
      drawCharacterSheetAt([41, 3]);
    }
  } else if (isMobile && selectedChestId != null && (match.dungeon.chests ?? [])[selectedChestId]) {
    drawInventoryAt([0, 41]);
    const mobileChestY = (player.inventory.isEmpty || !player.inventory.items.some((item: any) => item.type !== 'NIL')) ? 41 : 66;
    drawChestAt([0, mobileChestY], { ...chestProps, chest: (match.dungeon.chests ?? [])[selectedChestId] });
  } else if (showInventory) {
    drawInventoryAt([0, 41]);
  } else if (showCharacter) {
    drawCharacterSheetAt([0, 41]);
  } else if (showEventLog) {
    drawEventLogAt([0, 42], requestErrorLog);
  } else if (showMatch) {
    drawMatchPanelAt([0, 43]);
  }


  // Capture the natural canvas width once (at base font-size, before any scaling).
  // CSS font-size changes alter scrollWidth so we store the baseline to avoid feedback loops.
  const currentScrollWidth = sceneRef.current?.scrollWidth ?? 0;
  if (naturalCanvasWidthRef.current === 0 && currentScrollWidth > 400) {
    naturalCanvasWidthRef.current = currentScrollWidth;
  }
  const availableWidth = sceneRef.current?.parentElement?.clientWidth ?? window.innerWidth;
  const targetFontSize = (isMobile && naturalCanvasWidthRef.current > 0)
    ? Math.min(16, 16 * availableWidth / (naturalCanvasWidthRef.current * 39 / 80))
    : 16;

  return (
  <div>
    <div style={{ overflow: "hidden" }}>
      <div ref={sceneRef} className="scene" style={{ fontSize: `${targetFontSize}px` }}>
        <pre>{blockToText(globals.glyphs)}</pre>
        <div className="overlay">
          {globals.animatedExtras}
        </div>
      </div>
    </div>
    {isMobile && (
      <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {selectedChestId != null && (
          <button style={{ padding: "0.75rem 1rem" }} onClick={() => setSelectedChestId(null)}>
            Close Chest
          </button>
        )}
        {!player.inventory.isEmpty && (
          <button style={{ padding: "0.75rem 1rem" }} onClick={() => { setShowInventory(v => !v); setShowCharacter(false); setShowEventLog(false); setSelectedChestId(null); }}>
            {showInventory ? "Close Inventory" : "Inventory"}
          </button>
        )}
        <button style={{ padding: "0.75rem 1rem" }} onClick={() => { setShowCharacter(v => !v); setShowInventory(false); setShowEventLog(false); setSelectedChestId(null); }}>
          {showCharacter ? "Close Character" : "Character"}
        </button>
        <button style={{ padding: "0.75rem 1rem" }} onClick={() => { setShowEventLog(v => !v); setShowInventory(false); setShowCharacter(false); setShowMatch(false); setSelectedChestId(null); }}>
          {showEventLog ? "Close Log" : "Log"}
        </button>
        <button style={{ padding: "0.75rem 1rem" }} onClick={() => { setShowMatch(v => !v); setShowInventory(false); setShowCharacter(false); setShowEventLog(false); setSelectedChestId(null); }}>
          {showMatch ? "Close Match" : "Match"}
        </button>
      </div>
    )}
  </div>
);

}
