#!/usr/bin/env node

/**
 * Batch Packing Puzzle Generator
 *
 * Pre-generates daily Puzzle Packing puzzles deterministically from date and stores in Supabase.
 * No Claude API needed — pure algorithmic generation using pentomino backtracking solver.
 *
 * Run: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/generate-packing-puzzles.js [days]
 *
 * Arguments:
 *   days - number of days ahead to generate (default: 30)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing environment variables. Required:');
  console.error('  SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const daysAhead = parseInt(process.argv[2] || '30', 10);

// ─── Pentomino Generator (inlined from src/lib/packingPuzzleGenerator.js) ────

const ROWS = 5;
const COLS = 6;

const PIECE_SHAPES = {
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

function getOrientations(cells) {
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

const ALL_ORIENTATIONS = {};
for (const [id, cells] of Object.entries(PIECE_SHAPES)) {
  ALL_ORIENTATIONS[id] = getOrientations(cells);
}

function solvePacking(rows, cols, pieceIds, boardFlat, deadline) {
  if (!boardFlat) boardFlat = new Array(rows * cols).fill('');
  if (pieceIds.length === 0) {
    return boardFlat.indexOf('') === -1 ? boardFlat : null;
  }
  if (deadline && Date.now() > deadline) return null;

  const firstEmpty = boardFlat.indexOf('');
  if (firstEmpty === -1) return null;
  const eR = Math.floor(firstEmpty / cols);
  const eC = firstEmpty % cols;

  const [pieceId, ...remaining] = pieceIds;
  for (const cells of ALL_ORIENTATIONS[pieceId]) {
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

// Known-good combinations verified to tile 5×6
const FALLBACK_SETS = [
  ['I', 'L', 'N', 'P', 'T', 'W'],
  ['I', 'L', 'N', 'P', 'W', 'Y'],
  ['I', 'L', 'T', 'V', 'W', 'Y'],
];

function generatePackingPuzzleForDate(dateStr) {
  const rng = mulberry32(hashString(dateStr + '_packing_v1'));
  const allIds = Object.keys(PIECE_SHAPES);

  let solution = null;
  let chosenIds = null;

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

  if (!solution) {
    for (const fbIds of FALLBACK_SETS) {
      const result = solvePacking(ROWS, COLS, fbIds);
      if (result) { solution = result; chosenIds = fbIds; break; }
    }
  }

  if (!solution) throw new Error(`Could not generate packing puzzle for ${dateStr}`);

  const solution2D = [];
  for (let r = 0; r < ROWS; r++) {
    solution2D.push(solution.slice(r * COLS, (r + 1) * COLS));
  }

  const shuffledForAnchor = shuffle([...chosenIds], rng);
  const anchorIds = shuffledForAnchor.slice(0, 2);

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
    pieces: chosenIds,
    anchors: anchorIds,
    anchor_positions: anchorPositions,
    solution: solution2D,
  };
}

// ─── Date helpers ─────────────────────────────────────────────

function getTodayDateSGT() {
  const now = new Date();
  const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return sgt.toISOString().split('T')[0];
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  const today = getTodayDateSGT();
  console.log(`\n🧩 Packing Puzzle Generator`);
  console.log(`   Today (SGT): ${today}`);
  console.log(`   Generating puzzles for ${daysAhead} days ahead...\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < daysAhead; i++) {
    const date = addDays(today, i);

    // Check if puzzle already exists
    const { data: existing } = await supabase
      .from('packing_puzzles')
      .select('id')
      .eq('puzzle_date', date)
      .single();

    if (existing) {
      console.log(`  ⏭  ${date} — already exists`);
      skipped++;
      continue;
    }

    try {
      const puzzleData = generatePackingPuzzleForDate(date);
      const { error } = await supabase.from('packing_puzzles').insert({
        puzzle_date: puzzleData.puzzle_date,
        pieces: puzzleData.pieces,
        anchors: puzzleData.anchors,
        anchor_positions: puzzleData.anchor_positions,
        solution: puzzleData.solution,
      });

      if (error) throw error;

      console.log(`  ✅ ${date} — pieces: [${puzzleData.pieces.join(',')}], anchors: [${puzzleData.anchors.join(',')}]`);
      created++;
    } catch (err) {
      console.error(`  ❌ ${date} — Failed:`, err.message);
      failed++;
    }
  }

  console.log(`\n📊 Summary: ${created} created, ${skipped} skipped, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
