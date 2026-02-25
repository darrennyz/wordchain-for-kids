import React, { useState, useEffect, useRef } from 'react';
import {
  getTodaysSudokuPuzzle,
  hasCompletedSudokuToday,
  saveSudokuResult,
  saveSudokuPuzzle,
  getTodaysSudokuLeaderboard,
  getTodayDateSGT,
  getStreakForGame,
} from '../lib/supabase';
import { generateSudokuForDate, isSudokuComplete, hasCellConflict } from '../lib/sudokuGenerator';
import StreakTree from './StreakTree';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getNextMidnightSGT() {
  const now = new Date();
  const sgtOffset = 8 * 60 * 60 * 1000;
  const sgtNow = new Date(now.getTime() + sgtOffset);
  const nextMidnight = new Date(sgtNow);
  nextMidnight.setUTCHours(0, 0, 0, 0);
  nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
  return new Date(nextMidnight.getTime() - sgtOffset);
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const CELL_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-green-50 text-green-700 border-green-200',
  'bg-orange-50 text-orange-700 border-orange-200',
];

export default function SudokuBoard({ profile, puzzle, setPuzzle, timerState, setTimerState, onComplete, onLogout, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('loading'); // loading, already_done, ready, playing
  const [grid, setGrid] = useState(new Array(16).fill(0));
  const [givens, setGivens] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [alreadyDoneResult, setAlreadyDoneResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [streak, setStreak] = useState(0);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  // Always-current snapshot used by the unmount cleanup to save progress
  const snapshotRef = useRef({});
  snapshotRef.current = { phase, completed, timer, grid, puzzleDate: puzzle?.puzzle_date };

  // Save mid-game state when navigating away (component unmounts)
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(countdownRef.current);
      const s = snapshotRef.current;
      if (s.phase === 'playing' && !s.completed && setTimerState) {
        setTimerState({
          puzzleDate: s.puzzleDate,
          elapsedSeconds: s.timer,
          grid: s.grid,
        });
      }
    };
  }, []);

  useEffect(() => {
    loadPuzzleAndCheck();
  }, []);

  async function loadPuzzleAndCheck() {
    setLoading(true);
    try {
      let p = puzzle;
      if (!p) {
        // Try loading from DB
        p = await getTodaysSudokuPuzzle();
        if (!p) {
          // Generate client-side and save to DB
          const today = getTodayDateSGT();
          const generated = generateSudokuForDate(today);
          try {
            p = await saveSudokuPuzzle(generated);
          } catch (saveErr) {
            console.warn('Could not cache puzzle to DB:', saveErr);
            // Use generated puzzle locally
            p = { ...generated, id: 'local-' + today };
          }
        }
        setPuzzle(p);
      }

      // Check if already completed today
      const { completed: done, result } = await hasCompletedSudokuToday(profile.id);
      if (done) {
        setAlreadyDoneResult(result);
        setPhase('already_done');
        startCountdown();
        if (p.id) loadLeaderboard(p.id);
        getStreakForGame(profile.id, 'sudoku').then(setStreak).catch(console.error);
      } else {
        setPhase('ready');
      }
    } catch (err) {
      console.error('Failed to load Sudoku puzzle:', err);
      setError('Could not load today\'s puzzle. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  async function loadLeaderboard(puzzleId) {
    try {
      const data = await getTodaysSudokuLeaderboard(puzzleId);
      setLeaderboard(data || []);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    }
  }

  function startCountdown() {
    function update() {
      const diff = getNextMidnightSGT().getTime() - Date.now();
      setCountdown(formatCountdown(diff));
      if (diff <= 0) {
        clearInterval(countdownRef.current);
        window.location.reload();
      }
    }
    update();
    countdownRef.current = setInterval(update, 1000);
  }

  function startPlaying() {
    const puzzleGivens = typeof puzzle.givens === 'string' ? JSON.parse(puzzle.givens) : puzzle.givens;
    setGivens(puzzleGivens);
    setSelectedCell(null);
    setCompleted(false);

    // Restore saved mid-game state if it's for the same puzzle date
    if (timerState && timerState.puzzleDate === puzzle.puzzle_date) {
      setGrid([...timerState.grid]);
      setTimer(timerState.elapsedSeconds);
      setPhase('playing');
      setIsRunning(true);
      return;
    }

    // Fresh start
    const puzzleGrid = typeof puzzle.grid === 'string' ? JSON.parse(puzzle.grid) : puzzle.grid;
    setGrid([...puzzleGrid]);
    setTimer(0);
    setPhase('playing');
    setIsRunning(true);
  }

  // Timer
  useEffect(() => {
    if (isRunning && !completed) {
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, completed]);

  function handleCellClick(index) {
    if (completed) return;
    if (givens.includes(index)) return; // Can't edit given cells
    setSelectedCell(index);
  }

  function handleNumberInput(num) {
    if (selectedCell === null || completed) return;
    if (givens.includes(selectedCell)) return;

    const newGrid = [...grid];
    newGrid[selectedCell] = num;
    setGrid(newGrid);

    // Check if puzzle is complete
    if (isSudokuComplete(newGrid)) {
      setCompleted(true);
      setIsRunning(false);
      clearInterval(timerRef.current);
      handleComplete(newGrid);
    }
  }

  function handleClear() {
    if (selectedCell === null || completed) return;
    if (givens.includes(selectedCell)) return;
    const newGrid = [...grid];
    newGrid[selectedCell] = 0;
    setGrid(newGrid);
  }

  async function handleComplete() {
    try {
      if (puzzle.id && !String(puzzle.id).startsWith('local-')) {
        const result = await saveSudokuResult(profile.id, puzzle.id, timer);
        onComplete({ ...result, time_seconds: timer });
      } else {
        onComplete({ time_seconds: timer });
      }
    } catch (err) {
      console.error('Failed to save result:', err);
      onComplete({ time_seconds: timer });
    }
  }

  // ─── LOADING ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-3 border-snow-200 border-t-accent-green rounded-full animate-spin" />
        <p className="text-snow-500 font-medium text-sm">Loading today's Sudoku...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <div className="text-4xl">😕</div>
        <p className="text-snow-600 text-center">{error}</p>
        <button onClick={loadPuzzleAndCheck} className="px-6 py-2.5 bg-accent-green text-white font-display font-semibold rounded-xl">
          Try Again
        </button>
      </div>
    );
  }

  // ─── ALREADY COMPLETED ──────────────────────────────────────
  if (phase === 'already_done') {
    return (
      <div className="flex-1 flex flex-col px-6 py-6 overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-snow-500 hover:text-snow-700 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="text-xs font-medium">Games</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="font-display text-xl font-bold text-snow-800 mb-2">Sudoku Complete!</h1>
          <p className="text-snow-500 text-sm mb-2">You finished today's Sudoku in</p>
          <p className="font-display text-3xl font-bold text-accent-green mb-5">
            {alreadyDoneResult ? formatTime(alreadyDoneResult.time_seconds) : '--:--'}
          </p>

          {/* Streak */}
          <div className="bg-white rounded-2xl shadow-card p-4 w-full mb-4">
            <p className="text-snow-400 text-xs font-medium uppercase tracking-wider mb-2 text-center">
              Sudoku Streak
            </p>
            <div className="flex items-center justify-center gap-6">
              <StreakTree streak={streak} size={80} gameType="sudoku" showLabel={true} />
              <div className="text-left">
                {streak === 0 && <p className="font-display font-bold text-sm text-snow-500">Play tomorrow to<br/>start your streak!</p>}
                {streak === 1 && <p className="font-display font-bold text-sm text-accent-green">Your streak<br/>has sprouted! 🌱</p>}
                {streak > 1 && streak < 7 && <p className="font-display font-bold text-sm text-accent-green">{streak} days strong!<br/>Keep growing! 🌿</p>}
                {streak >= 7 && streak < 14 && <p className="font-display font-bold text-sm text-green-700">{streak} day streak!<br/>You're on fire! 🔥</p>}
                {streak >= 14 && streak < 30 && <p className="font-display font-bold text-sm text-green-800">{streak} days!<br/>Almost a full tree! 🌳</p>}
                {streak >= 30 && <p className="font-display font-bold text-sm text-green-900">{streak} day streak!<br/>Full tree! 🌳✨</p>}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-card p-5 w-full mb-6 text-center">
            <p className="text-snow-400 text-xs font-medium uppercase tracking-wider mb-2">Next puzzle in</p>
            <p className="font-display text-3xl font-bold text-snow-700 tabular-nums">{countdown}</p>
          </div>

          {leaderboard.length > 0 && (
            <div className="bg-white rounded-2xl shadow-card p-4 w-full mb-4">
              <p className="text-snow-400 text-xs font-medium uppercase tracking-wider mb-3 text-center">Today's Sudoku Leaderboard</p>
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${i === 0 ? 'bg-yellow-50' : i === 1 ? 'bg-snow-50' : i === 2 ? 'bg-orange-50/50' : ''}`}>
                    <span className="font-display font-bold text-sm text-snow-400 w-5 text-center">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                    </span>
                    <span className="text-lg">{entry.profiles?.avatar_emoji}</span>
                    <span className="font-display font-semibold text-sm text-snow-700 flex-1 truncate">{entry.profiles?.name}</span>
                    <span className="font-display font-bold text-sm text-snow-500 tabular-nums">{formatTime(entry.time_seconds)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <button onClick={onBack} className="flex-1 py-3 bg-accent-green text-white font-display font-semibold text-sm rounded-xl hover:bg-green-600 active:scale-[0.98] transition-all">
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  // ─── READY SCREEN ───────────────────────────────────────────
  if (phase === 'ready') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 animate-fade-in">
        <div className="absolute top-4 left-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-snow-500 hover:text-snow-700 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="text-xs font-medium">Games</span>
          </button>
        </div>

        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-400 to-teal-400 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-4xl">🔢</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-snow-800 mb-2">Daily 4×4 Sudoku</h1>
          {puzzle && (
            <p className="text-snow-400 text-sm font-medium mb-2">
              Puzzle #{puzzle.puzzle_number} &middot; {new Date(puzzle.puzzle_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}

          <div className="bg-white rounded-2xl shadow-card p-5 mb-8 text-left max-w-xs mx-auto">
            {timerState && timerState.puzzleDate === puzzle?.puzzle_date ? (
              <>
                <p className="text-snow-600 text-sm leading-relaxed mb-2">
                  Welcome back! Your progress has been saved.
                </p>
                <p className="text-accent-green text-sm font-display font-bold">
                  ⏱ {formatTime(timerState.elapsedSeconds)} elapsed
                </p>
              </>
            ) : (
              <>
                <p className="text-snow-600 text-sm leading-relaxed mb-3">
                  Fill the 4×4 grid so every <strong>row</strong>, <strong>column</strong>, and <strong>2×2 box</strong> contains the numbers 1 through 4.
                </p>
                <p className="text-snow-400 text-xs">The timer starts as soon as you begin!</p>
              </>
            )}
          </div>

          <button
            onClick={startPlaying}
            className="w-full max-w-xs py-4 bg-accent-green text-white font-display font-bold text-xl rounded-2xl shadow-lg hover:bg-green-600 active:scale-[0.97] transition-all animate-pulse-slow"
          >
            I'm Ready!
          </button>
        </div>
      </div>
    );
  }

  // ─── PLAYING ────────────────────────────────────────────────
  const filledCount = grid.filter((v) => v !== 0).length;
  const conflicts = grid.map((_, i) => hasCellConflict(grid, i));

  return (
    <div className="flex-1 flex flex-col px-4 py-4 animate-fade-in overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-snow-500 hover:text-snow-700 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="text-xs font-medium text-snow-500">Games</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg">{profile.avatar_emoji}</span>
          <span className="text-xs font-medium text-snow-500">{profile.name}</span>
        </div>
      </div>

      {/* Puzzle info */}
      <div className="text-center mb-3">
        <h1 className="font-display text-lg font-bold text-snow-800">4×4 Sudoku</h1>
      </div>

      {/* Timer */}
      <div className="flex justify-center mb-4">
        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full ${timer > 120 ? 'bg-red-50 timer-warning' : 'bg-snow-100 text-snow-600'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="font-display font-bold text-lg tabular-nums">{formatTime(timer)}</span>
        </div>
      </div>

      {/* Progress */}
      <p className="text-xs text-snow-400 font-medium text-center mb-3">
        {filledCount}/16 cells filled
      </p>

      {/* 4x4 Grid */}
      <div className="flex justify-center mb-4">
        <div className="inline-grid grid-cols-4 gap-0 border-2 border-snow-700 rounded-xl overflow-hidden">
          {grid.map((val, i) => {
            const row = Math.floor(i / 4);
            const col = i % 4;
            const isGiven = givens.includes(i);
            const isSelected = selectedCell === i;
            const hasConflict = val !== 0 && conflicts[i];
            // Thicker borders between 2x2 boxes
            const borderRight = col === 1 ? 'border-r-2 border-r-snow-600' : col < 3 ? 'border-r border-r-snow-200' : '';
            const borderBottom = row === 1 ? 'border-b-2 border-b-snow-600' : row < 3 ? 'border-b border-b-snow-200' : '';

            return (
              <button
                key={i}
                onClick={() => handleCellClick(i)}
                className={`w-16 h-16 flex items-center justify-center font-display font-bold text-2xl transition-all ${borderRight} ${borderBottom} ${
                  isSelected
                    ? 'bg-blue-100 ring-2 ring-inset ring-accent-blue'
                    : isGiven
                      ? 'bg-snow-100'
                      : 'bg-white hover:bg-snow-50'
                } ${hasConflict ? 'text-accent-red' : isGiven ? 'text-snow-800' : 'text-accent-blue'}`}
              >
                {val !== 0 ? val : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Number pad */}
      <div className="flex justify-center gap-3 mb-4">
        {[1, 2, 3, 4].map((num) => (
          <button
            key={num}
            onClick={() => handleNumberInput(num)}
            className={`w-14 h-14 rounded-xl font-display font-bold text-xl shadow-tile hover:shadow-tile-active active:scale-95 transition-all ${CELL_COLORS[num - 1]} border-2`}
          >
            {num}
          </button>
        ))}
        <button
          onClick={handleClear}
          className="w-14 h-14 rounded-xl font-display font-bold text-lg shadow-tile hover:shadow-tile-active active:scale-95 transition-all bg-snow-100 text-snow-500 border-2 border-snow-200"
        >
          ✕
        </button>
      </div>

      {/* Completion message */}
      {completed && (
        <div className="text-center py-4 animate-bounce-in">
          <p className="font-display font-bold text-lg text-accent-green">Puzzle Complete!</p>
        </div>
      )}
    </div>
  );
}
