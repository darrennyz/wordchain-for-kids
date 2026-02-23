#!/usr/bin/env node

/**
 * Batch Sudoku Puzzle Generator
 *
 * Pre-generates 4x4 Sudoku puzzles deterministically from date and stores in Supabase.
 * No Claude API needed — pure algorithmic generation.
 *
 * Run: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/generate-sudoku-puzzles.js [days]
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

// ─── Sudoku Generator (same as src/lib/sudokuGenerator.js) ────

function createRNG(seed) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateToSeed(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const c = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash + c) | 0;
  }
  return Math.abs(hash);
}

function shuffleWithRNG(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isValid(grid, row, col, num) {
  for (let c = 0; c < 4; c++) {
    if (grid[row][c] === num) return false;
  }
  for (let r = 0; r < 4; r++) {
    if (grid[r][col] === num) return false;
  }
  const boxRow = Math.floor(row / 2) * 2;
  const boxCol = Math.floor(col / 2) * 2;
  for (let r = boxRow; r < boxRow + 2; r++) {
    for (let c = boxCol; c < boxCol + 2; c++) {
      if (grid[r][c] === num) return false;
    }
  }
  return true;
}

function generateFullGrid(rng) {
  const grid = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  function solve() {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (grid[r][c] === 0) {
          const nums = shuffleWithRNG([1, 2, 3, 4], rng);
          for (const num of nums) {
            if (isValid(grid, r, c, num)) {
              grid[r][c] = num;
              if (solve()) return true;
              grid[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }
  solve();
  return grid;
}

function countSolutions(grid, limit = 2) {
  let count = 0;
  function solve() {
    if (count >= limit) return;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (grid[r][c] === 0) {
          for (let num = 1; num <= 4; num++) {
            if (isValid(grid, r, c, num)) {
              grid[r][c] = num;
              solve();
              grid[r][c] = 0;
            }
          }
          return;
        }
      }
    }
    count++;
  }
  solve();
  return count;
}

function generateSudokuForDate(dateStr) {
  const seed = dateToSeed(dateStr);
  const rng = createRNG(seed);
  const fullGrid = generateFullGrid(rng);
  const solution = fullGrid.flat();
  const numGivens = 8 + Math.floor(rng() * 3);
  const allIndices = Array.from({ length: 16 }, (_, i) => i);
  shuffleWithRNG(allIndices, rng);
  const puzzle = [...solution];
  const removeOrder = [...allIndices];
  const removed = [];
  for (const idx of removeOrder) {
    if (removed.length >= 16 - numGivens) break;
    const backup = puzzle[idx];
    puzzle[idx] = 0;
    const testGrid = [
      puzzle.slice(0, 4),
      puzzle.slice(4, 8),
      puzzle.slice(8, 12),
      puzzle.slice(12, 16),
    ];
    const solutions = countSolutions(testGrid);
    if (solutions === 1) {
      removed.push(idx);
    } else {
      puzzle[idx] = backup;
    }
  }
  const givens = allIndices
    .filter((i) => puzzle[i] !== 0)
    .sort((a, b) => a - b);
  return {
    grid: puzzle,
    givens,
    solution,
    difficulty: givens.length >= 10 ? 'easy' : givens.length >= 7 ? 'medium' : 'hard',
  };
}

// ─── Date helpers ────────────────────────────────────────────

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

// ─── Main ────────────────────────────────────────────────────

async function main() {
  const today = getTodayDateSGT();
  console.log(`\n🔢 Sudoku Puzzle Generator`);
  console.log(`   Today (SGT): ${today}`);
  console.log(`   Generating puzzles for ${daysAhead} days ahead...\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < daysAhead; i++) {
    const date = addDays(today, i);

    // Check if puzzle already exists
    const { data: existing } = await supabase
      .from('sudoku_puzzles')
      .select('id')
      .eq('puzzle_date', date)
      .single();

    if (existing) {
      console.log(`  ⏭  ${date} — already exists`);
      skipped++;
      continue;
    }

    try {
      const puzzleData = generateSudokuForDate(date);
      const { error } = await supabase.from('sudoku_puzzles').insert({
        puzzle_date: date,
        grid: puzzleData.grid,
        givens: puzzleData.givens,
        difficulty: puzzleData.difficulty,
      });

      if (error) throw error;

      const givensCount = puzzleData.givens.length;
      console.log(`  ✅ ${date} — ${puzzleData.difficulty} (${givensCount} givens)`);
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
