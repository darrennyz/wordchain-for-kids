/**
 * Deterministic 4x4 Sudoku Generator
 * Uses date string as seed so all players get the same puzzle each day.
 */

// Seeded pseudo-random number generator (mulberry32)
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

// Convert date string to numeric seed
function dateToSeed(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const c = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash + c) | 0;
  }
  return Math.abs(hash);
}

// Shuffle array in place using seeded RNG
function shuffleWithRNG(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Check if placing num at (row, col) is valid
function isValid(grid, row, col, num) {
  // Check row
  for (let c = 0; c < 4; c++) {
    if (grid[row][c] === num) return false;
  }
  // Check column
  for (let r = 0; r < 4; r++) {
    if (grid[r][col] === num) return false;
  }
  // Check 2x2 box
  const boxRow = Math.floor(row / 2) * 2;
  const boxCol = Math.floor(col / 2) * 2;
  for (let r = boxRow; r < boxRow + 2; r++) {
    for (let c = boxCol; c < boxCol + 2; c++) {
      if (grid[r][c] === num) return false;
    }
  }
  return true;
}

// Generate a complete valid 4x4 grid using backtracking with seeded RNG
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
    return true; // All cells filled
  }

  solve();
  return grid;
}

// Count solutions for a puzzle (stop at 2 — we only need to know if unique)
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

/**
 * Generate a Sudoku puzzle deterministically from a date string.
 * @param {string} dateStr - e.g. "2026-02-23"
 * @returns {{ grid: number[], givens: number[], solution: number[] }}
 *   grid: flat 16-element array with 0s for blanks
 *   givens: indices of pre-filled cells
 *   solution: flat 16-element array with full solution
 */
export function generateSudokuForDate(dateStr) {
  const seed = dateToSeed(dateStr);
  const rng = createRNG(seed);

  // Generate complete grid
  const fullGrid = generateFullGrid(rng);

  // Flatten to 1D array for storage
  const solution = fullGrid.flat();

  // Determine which cells to keep as givens (8-10 for easy/kids)
  const numGivens = 8 + Math.floor(rng() * 3); // 8, 9, or 10
  const allIndices = Array.from({ length: 16 }, (_, i) => i);
  shuffleWithRNG(allIndices, rng);

  // Try removing cells while maintaining unique solution
  const puzzle = [...solution];
  const removeOrder = [...allIndices]; // Try removing in shuffled order
  const removed = [];

  for (const idx of removeOrder) {
    if (removed.length >= 16 - numGivens) break;

    const backup = puzzle[idx];
    puzzle[idx] = 0;

    // Check if still has unique solution
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
      puzzle[idx] = backup; // Restore — removing breaks uniqueness
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

/**
 * Check if a user's grid is complete and valid
 * @param {number[]} userGrid - flat 16-element array
 * @returns {boolean}
 */
export function isSudokuComplete(userGrid) {
  if (userGrid.some((v) => v === 0 || v === null)) return false;

  const grid = [
    userGrid.slice(0, 4),
    userGrid.slice(4, 8),
    userGrid.slice(8, 12),
    userGrid.slice(12, 16),
  ];

  // Check all rows
  for (let r = 0; r < 4; r++) {
    if (new Set(grid[r]).size !== 4) return false;
  }
  // Check all columns
  for (let c = 0; c < 4; c++) {
    const col = [grid[0][c], grid[1][c], grid[2][c], grid[3][c]];
    if (new Set(col).size !== 4) return false;
  }
  // Check all 2x2 boxes
  for (let br = 0; br < 2; br++) {
    for (let bc = 0; bc < 2; bc++) {
      const box = [
        grid[br * 2][bc * 2],
        grid[br * 2][bc * 2 + 1],
        grid[br * 2 + 1][bc * 2],
        grid[br * 2 + 1][bc * 2 + 1],
      ];
      if (new Set(box).size !== 4) return false;
    }
  }
  return true;
}

/**
 * Get constraint violations for a cell
 * @param {number[]} grid - flat 16-element array
 * @param {number} index - cell index (0-15)
 * @returns {boolean} true if the cell has a conflict
 */
export function hasCellConflict(grid, index) {
  const val = grid[index];
  if (!val) return false;

  const row = Math.floor(index / 4);
  const col = index % 4;

  // Check row
  for (let c = 0; c < 4; c++) {
    if (c !== col && grid[row * 4 + c] === val) return true;
  }
  // Check column
  for (let r = 0; r < 4; r++) {
    if (r !== row && grid[r * 4 + col] === val) return true;
  }
  // Check 2x2 box
  const boxRow = Math.floor(row / 2) * 2;
  const boxCol = Math.floor(col / 2) * 2;
  for (let r = boxRow; r < boxRow + 2; r++) {
    for (let c = boxCol; c < boxCol + 2; c++) {
      if ((r !== row || c !== col) && grid[r * 4 + c] === val) return true;
    }
  }
  return false;
}
