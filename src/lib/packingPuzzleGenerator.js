// ─── Puzzle Packing Generator ─────────────────────────────────────────────────
// 5×6 grid tiled by 6 pentominoes. 2 pieces are pre-placed as anchors (beginner).

export const ROWS = 5;
export const COLS = 6;

// All 12 standard pentominoes as normalised [row, col] offset arrays
export const PIECE_SHAPES = {
  F: [[0,1],[0,2],[1,0],[1,1],[2,1]],
  I: [[0,0],[1,0],[2,0],[3,0],[4,0]],
  L: [[0,0],[1,0],[2,0],[3,0],[3,1]],
  N: [[0,1],[1,0],[1,1],[2,0],[3,0]],
  P: [[0,0],[0,1],[1,0],[1,1],[2,0]],
  T: [[0,0],[0,1],[0,2],[1,1],[2,1]],
  U: [[0,0],[0,2],[1,0],[1,1],[1,2]],
  V: [[0,0],[1,0],[2,0],[2,1],[2,2]],
  W: [[0,0],[1,0],[1,1],[2,1],[2,2]],
  X: [[0,1],[1,0],[1,1],[1,2],[2,1]],
  Y: [[0,1],[1,0],[1,1],[2,1],[3,1]],
  Z: [[0,0],[0,1],[1,1],[2,1],[2,2]],
};

export const PIECE_COLORS = {
  F: '#f97316', // orange
  I: '#3b82f6', // blue
  L: '#f59e0b', // amber
  N: '#8b5cf6', // violet
  P: '#ec4899', // pink
  T: '#14b8a6', // teal
  U: '#22c55e', // green
  V: '#ef4444', // red
  W: '#94a3b8', // slate
  X: '#a855f7', // purple
  Y: '#06b6d4', // cyan
  Z: '#10b981', // emerald
};

// ─── Orientation helpers ────────────────────────────────────────────────────

function normalize(cells) {
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  return cells
    .map(([r, c]) => [r - minR, c - minC])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

function rotateCW(cells) {
  const maxR = Math.max(...cells.map(([r]) => r));
  return normalize(cells.map(([r, c]) => [c, maxR - r]));
}

function flipH(cells) {
  const maxC = Math.max(...cells.map(([, c]) => c));
  return normalize(cells.map(([r, c]) => [r, maxC - c]));
}

function serialize(cells) {
  return cells.map(([r, c]) => `${r},${c}`).join('|');
}

/** Returns all unique orientations (up to 8) for a piece's cell list */
export function getOrientations(cells) {
  const seen = new Set();
  const result = [];
  let cur = normalize(cells);
  for (let f = 0; f < 2; f++) {
    for (let r = 0; r < 4; r++) {
      const key = serialize(cur);
      if (!seen.has(key)) { seen.add(key); result.push(cur); }
      cur = rotateCW(cur);
    }
    cur = flipH(normalize(cells));
  }
  return result;
}

/** All orientations precomputed at module load — shared by UI and solver */
export const ALL_ORIENTATIONS = {};
for (const [id, cells] of Object.entries(PIECE_SHAPES)) {
  ALL_ORIENTATIONS[id] = getOrientations(cells);
}

// ─── Backtracking solver ───────────────────────────────────────────────────

/**
 * Place all `pieceIds` on a rows×cols board.
 * Uses "cover the first empty cell" heuristic for fast pruning.
 * Returns a flat board array (string per cell = pieceId | ''), or null if unsolvable.
 * Optional `deadline` (Date.now() ms) stops early and returns null on timeout.
 */
export function solvePacking(rows, cols, pieceIds, boardFlat, deadline) {
  if (!boardFlat) boardFlat = new Array(rows * cols).fill('');

  if (pieceIds.length === 0) {
    return boardFlat.indexOf('') === -1 ? boardFlat : null;
  }

  if (deadline && Date.now() > deadline) return null;

  // Find first empty cell
  const firstEmpty = boardFlat.indexOf('');
  if (firstEmpty === -1) return null;
  const eR = Math.floor(firstEmpty / cols);
  const eC = firstEmpty % cols;

  const [pieceId, ...remaining] = pieceIds;
  const orientations = ALL_ORIENTATIONS[pieceId];

  for (const cells of orientations) {
    // For each cell in this orientation that can cover (eR, eC)
    for (const [dr, dc] of cells) {
      const oR = eR - dr;
      const oC = eC - dc;
      const placed = cells.map(([r, c]) => [r + oR, c + oC]);

      if (!placed.every(([r, c]) =>
        r >= 0 && r < rows && c >= 0 && c < cols && boardFlat[r * cols + c] === ''
      )) continue;

      const next = [...boardFlat];
      for (const [r, c] of placed) next[r * cols + c] = pieceId;

      const result = solvePacking(rows, cols, remaining, next, deadline);
      if (result) return result;
    }
  }
  return null;
}

// ─── Seeded RNG ────────────────────────────────────────────────────────────

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    z ^= z + Math.imul(z ^ (z >>> 7), 61 | z);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Known-good combinations verified to tile 5×6 (used as final fallback)
const FALLBACK_SETS = [
  ['I', 'L', 'N', 'P', 'T', 'W'],
  ['I', 'L', 'N', 'P', 'W', 'Y'],
  ['I', 'L', 'T', 'V', 'W', 'Y'],
];

/**
 * Generate a Puzzle Packing puzzle for a given SGT date string (YYYY-MM-DD).
 * Returns: { puzzle_date, grid_rows, grid_cols, pieces, anchors, anchor_positions, solution }
 */
export function generatePackingPuzzleForDate(dateStr) {
  const rng = mulberry32(hashString(dateStr + '_packing_v1'));
  const allIds = Object.keys(PIECE_SHAPES);

  let solution = null;
  let chosenIds = null;

  // Try up to 80 random selections
  for (let attempt = 0; attempt < 80; attempt++) {
    const tryIds = shuffle(allIds, rng).slice(0, 6);
    const deadline = Date.now() + 1500;
    const result = solvePacking(ROWS, COLS, tryIds, null, deadline);
    if (result) {
      solution = result;
      chosenIds = tryIds;
      break;
    }
  }

  // Fallback to known-good sets
  if (!solution) {
    for (const fbIds of FALLBACK_SETS) {
      const result = solvePacking(ROWS, COLS, fbIds);
      if (result) { solution = result; chosenIds = fbIds; break; }
    }
  }

  if (!solution) throw new Error(`Could not generate packing puzzle for ${dateStr}`);

  // Convert flat solution to 2D
  const solution2D = [];
  for (let r = 0; r < ROWS; r++) {
    solution2D.push(solution.slice(r * COLS, (r + 1) * COLS));
  }

  // Pick 2 anchor pieces (beginner: 2 pre-placed clues)
  const shuffledForAnchor = shuffle([...chosenIds], rng);
  const anchorIds = shuffledForAnchor.slice(0, 2);

  // Record which cells belong to anchor pieces
  const anchorPositions = {};
  for (const id of anchorIds) {
    anchorPositions[id] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (solution2D[r][c] === id) anchorPositions[id].push([r, c]);
      }
    }
  }

  return {
    puzzle_date: dateStr,
    grid_rows: ROWS,
    grid_cols: COLS,
    pieces: chosenIds,
    anchors: anchorIds,
    anchor_positions: anchorPositions,
    solution: solution2D,
  };
}
