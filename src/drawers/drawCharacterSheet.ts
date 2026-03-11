import { DrawerProps } from '../types/DrawerProps';
import { writeText, formatTrait } from './canvasUtils';

export interface DrawCharacterSheetProps {
  globals: DrawerProps;
  sheet: any;
  sheetPage: string;
  setSheetPage: (page: string) => void;
}

type CW = { word: string; fg: number };

const PAGES = ['roles', 'attributes', 'capabilities', 'states', 'afflictions', 'debuffs', 'characters'];
const PAGE_LABELS: Record<string, string> = {
  roles: 'ROLE', attributes: 'ATTR', capabilities: 'CAPA',
  states: 'STAT', afflictions: 'AFFL', debuffs: 'DEBT', characters: 'CHAR',
};

const BG        = 0x000000;
const HIGHLIGHT  = 0x888888;
const DARK_GRAY  = 0x555555;
const LIGHT_GRAY = 0xaaaaaa;
const PRESENT_FG = 0x88bb88;
const ABSENT_FG  = 0xbb8888;

export function drawCharacterSheetAt(
  offset: [number, number],
  { globals, sheet, sheetPage, setSheetPage }: DrawCharacterSheetProps,
) {
  if (!sheet) return;

  const [ox, oy] = offset;
  const WIDTH = 39;
  const glyphs = globals.glyphs;

  function wt(x: number, y: number, text: string, fg: number, bg: number, onClick?: () => void) {
    writeText(glyphs, x, y, text, fg, bg, onClick);
  }

  function writeWords(startX: number, startRow: number, words: CW[], indent = 0): number {
    let x = startX;
    let y = startRow;
    let lineStart = true;
    for (const { word, fg } of words) {
      if (!lineStart) {
        if (x + 1 + word.length > ox + WIDTH) {
          y++;
          x = ox + indent;
          lineStart = true;
        } else {
          if (glyphs[y]?.[x]) glyphs[y][x] = { char: ' ', fg: DARK_GRAY, bg: BG };
          x++;
        }
      }
      wt(x, y, word, fg, BG);
      x += word.length;
      lineStart = false;
    }
    return y + 1;
  }

  // Page tabs
  let tx = ox;
  for (const p of PAGES) {
    const label = PAGE_LABELS[p];
    const isActive = sheetPage === p;
    const pageCopy = p;
    const pageEmpty = (sheet[p] ?? []).length === 0;
    if (pageEmpty) {
      wt(tx, oy, label, 0x333333, BG);
    } else if (isActive) {
      for (let bx = tx - 1; bx <= tx + label.length; bx++) {
        if (glyphs[oy - 1]?.[bx]) glyphs[oy - 1][bx] = { char: '\u2584', fg: HIGHLIGHT, bg: BG };
      }
      if (glyphs[oy]?.[tx - 1])           glyphs[oy][tx - 1]           = { char: '\u2590', fg: HIGHLIGHT, bg: BG };
      wt(tx, oy, label, 0x000000, HIGHLIGHT, () => setSheetPage(pageCopy));
      if (glyphs[oy]?.[tx + label.length]) glyphs[oy][tx + label.length] = { char: '\u258c', fg: HIGHLIGHT, bg: BG };
    } else {
      wt(tx, oy, label, DARK_GRAY, BG, () => setSheetPage(pageCopy));
    }
    tx += label.length + 1;
  }

  // Separator
  wt(ox, oy + 1, '\u2500'.repeat(WIDTH), 0x444444, BG);

  const traits: any[] = sheet[sheetPage] ?? [];
  const isAttributePage = sheetPage === 'attributes';
  let row = oy + 2;

  for (const trait of traits) {
    if (row >= glyphs.length) break;
    const nameFg = !trait.isPresent ? ABSENT_FG : trait.upstream.length > 0 ? PRESENT_FG : LIGHT_GRAY;
    const nameWords = formatTrait(trait.trait).toLowerCase().split(' ');

    if (isAttributePage) {
      // "<name> grants <down1> & <down2> ..."
      const line1: CW[] = nameWords.map(w => ({ word: w, fg: nameFg }));
      if (trait.downstream.length > 0) {
        line1.push({ word: 'grants', fg: DARK_GRAY });
        for (let i = 0; i < trait.downstream.length; i++) {
          if (i > 0) line1.push({ word: '&', fg: DARK_GRAY });
          line1.push({ word: formatTrait(trait.downstream[i]).toLowerCase(), fg: LIGHT_GRAY });
        }
      }
      row = writeWords(ox, row, line1, 2);

      // "* gained from <up1> & <up2> ..."
      if (trait.upstream.length > 0) {
        if (row >= glyphs.length) break;
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
      const icon = trait.isPresent ? '*' : '.';
      const line1: CW[] = [{ word: icon, fg: DARK_GRAY }, ...nameWords.map(w => ({ word: w, fg: nameFg }))];
      row = writeWords(ox, row, line1, 2);

      if (trait.upstream.length > 0 && row < glyphs.length) {
        const upWords: CW[] = [{ word: 'cause:', fg: DARK_GRAY }];
        for (let i = 0; i < trait.upstream.length; i++) {
          if (i > 0) upWords.push({ word: '&', fg: DARK_GRAY });
          upWords.push({ word: formatTrait(trait.upstream[i]).toLowerCase(), fg: LIGHT_GRAY });
        }
        row = writeWords(ox + 2, row, upWords, 2);
      }
      if (trait.downstream.length > 0 && row < glyphs.length) {
        const downWords: CW[] = [{ word: 'effect:', fg: DARK_GRAY }];
        for (let i = 0; i < trait.downstream.length; i++) {
          if (i > 0) downWords.push({ word: '&', fg: DARK_GRAY });
          downWords.push({ word: formatTrait(trait.downstream[i]).toLowerCase(), fg: LIGHT_GRAY });
        }
        row = writeWords(ox + 2, row, downWords, 2);
      }
    }

    row++; // blank line between entries
  }
}
