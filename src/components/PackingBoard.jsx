import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ROWS,
  COLS,
  PIECE_COLORS,
  ALL_ORIENTATIONS,
  generatePackingPuzzleForDate,
} from '../lib/packingPuzzleGenerator';
import {
  getTodaysPackingPuzzle,
  hasCompletedPackingToday,
  savePackingPuzzle,
  savePackingResult,
  getTodaysPackingLeaderboard,
  getTodayDateSGT,
  getStreakForGame,
} from '../lib/supabase';
import StreakTree from './StreakTree';

// ─── Helpers ────────────────────────────────────────────────────

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getNextMidnightSGT() {
  const sgtOffset = 8 * 60 * 60 * 1000;
  const sgtNow = new Date(Date.now() + sgtOffset);
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
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Mini piece preview for the piece tray ──────────────────────

function PieceMini({ pieceId, orientationCells, selected }) {
  const maxR = Math.max(...orientationCells.map(([r]) => r));
  const maxC = Math.max(...orientationCells.map(([, c]) => c));
  const rows = maxR + 1;
  const cols = maxC + 1;
  const CELL = 11;
  const GAP = 1;
  const color = PIECE_COLORS[pieceId];

  const cellMap = new Set(orientationCells.map(([r, c]) => `${r},${c}`));

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, ${CELL}px)`,
        gap: `${GAP}px`,
      }}
    >
      {Array.from({ length: rows * cols }, (_, idx) => {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const filled = cellMap.has(`${r},${c}`);
        return (
          <div
            key={idx}
            style={{
              width: CELL,
              height: CELL,
              borderRadius: 2,
              backgroundColor: filled ? color : 'transparent',
              opacity: filled ? (selected ? 1 : 0.75) : 0,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function PackingBoard({
  profile,
  puzzle,
  setPuzzle,
  timerState,
  setTimerState,
  onComplete,
  onLogout,
  onBack,
}) {
  const [phase, setPhase] = useState('loading');
  const [boardState, setBoardState] = useState(null);
  const [selectedPieceId, setSelectedPieceId] = useState(null);
  const [orientationIdx, setOrientationIdx] = useState(0);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [timer, setTimer] = useState(0);
  const [alreadyDoneResult, setAlreadyDoneResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [countdown, setCountdown] = useState('');
  const [streak, setStreak] = useState(0);
  // dragging: null | { pieceId, orientationIdx, clientX, clientY }
  const [dragging, setDragging] = useState(null);

  const timerIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const snapshotRef = useRef({});
  const boardRef = useRef(null);
  // Stable ref so pointer-event handlers always see latest state without re-binding
  const stateRef = useRef({});
  // anchors are computed below via useMemo, so we update stateRef after render in a separate effect
  stateRef.current = { boardState, selectedPieceId, orientationIdx, dragging, puzzle };

  // snapshotRef: always holds the latest render values so unmount cleanup reads current state
  snapshotRef.current = { phase, timer, boardState, puzzleDate: puzzle?.puzzle_date };

  // Cleanup on unmount: save timer state if mid-game
  useEffect(() => {
    return () => {
      clearInterval(timerIntervalRef.current);
      clearInterval(countdownIntervalRef.current);
      const s = snapshotRef.current;
      if (s.phase === 'playing' && setTimerState) {
        setTimerState({
          puzzleDate: s.puzzleDate,
          elapsedSeconds: s.timer,
          boardState: s.boardState,
        });
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadPuzzle();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Puzzle loading ──────────────────────────────────────────

  async function loadPuzzle() {
    try {
      let p = puzzle;
      if (!p) {
        p = await getTodaysPackingPuzzle();
        if (!p) {
          const generated = generatePackingPuzzleForDate(getTodayDateSGT());
          p = await savePackingPuzzle(generated);
        }
        setPuzzle(p);
      }

      const { completed, result } = await hasCompletedPackingToday(profile.id);
      if (completed) {
        setAlreadyDoneResult(result);
        setPhase('already_done');
        if (p?.id) {
          getTodaysPackingLeaderboard(p.id).then(setLeaderboard).catch(console.error);
        }
        getStreakForGame(profile.id, 'packing').then(setStreak).catch(console.error);
        startCountdown();
      } else {
        setPhase('ready');
      }
    } catch (err) {
      console.error('Failed to load packing puzzle:', err);
      setPhase('ready');
    }
  }

  function startCountdown() {
    function update() {
      setCountdown(formatCountdown(getNextMidnightSGT().getTime() - Date.now()));
    }
    update();
    countdownIntervalRef.current = setInterval(update, 1000);
  }

  // ─── Board helpers ───────────────────────────────────────────

  function getParsed(field) {
    if (!puzzle) return null;
    const val = puzzle[field];
    if (!val) return null;
    return typeof val === 'string' ? JSON.parse(val) : val;
  }

  function buildBoard(savedBoard) {
    const board = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
    const anchorPos = getParsed('anchor_positions') || {};
    const anchors = getParsed('anchors') || [];
    for (const id of anchors) {
      for (const [r, c] of (anchorPos[id] || [])) {
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = id;
      }
    }
    if (savedBoard) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (savedBoard[r]?.[c]) board[r][c] = savedBoard[r][c];
        }
      }
    }
    return board;
  }

  function startPlaying() {
    let savedTimer = 0;
    let savedBoard = null;
    if (timerState?.puzzleDate === puzzle?.puzzle_date) {
      savedTimer = timerState.elapsedSeconds || 0;
      savedBoard = timerState.boardState;
    }
    const board = buildBoard(savedBoard);
    setBoardState(board);
    setTimer(savedTimer);
    setPhase('playing');
    timerIntervalRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
  }

  function resetBoard() {
    setBoardState(buildBoard(null));
    setSelectedPieceId(null);
    setOrientationIdx(0);
    setHoveredCell(null);
    // Timer intentionally NOT reset
  }

  // ─── Drag helpers ─────────────────────────────────────────────

  /** Returns [row, col] for a client point, or null if outside the board */
  function getCellFromClient(clientX, clientY) {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const cellW = rect.width / COLS;
    const cellH = rect.height / ROWS;
    const col = Math.floor((clientX - rect.left) / cellW);
    const row = Math.floor((clientY - rect.top) / cellH);
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) return [row, col];
    return null;
  }

  /** Attempt to place the current selected piece (or dragging piece) at (r, c) */
  function attemptPlace(r, c, pieceId, oIdx, board, curTimer) {
    if (!board || !puzzle) return false;
    const anchorList = getParsed('anchors') || [];
    const orientation = ALL_ORIENTATIONS[pieceId][oIdx];
    const placed = orientation.map(([dr, dc]) => [r + dr, c + dc]);
    const valid = placed.every(
      ([pr, pc]) =>
        pr >= 0 && pr < ROWS && pc >= 0 && pc < COLS && board[pr][pc] === ''
    );
    if (!valid) return false;
    const newBoard = board.map((row) => [...row]);
    for (const [pr, pc] of placed) newBoard[pr][pc] = pieceId;
    setBoardState(newBoard);
    setSelectedPieceId(null);
    setOrientationIdx(0);
    setHoveredCell(null);
    if (newBoard.every((row) => row.every((id) => id !== ''))) {
      clearInterval(timerIntervalRef.current);
      handleComplete(curTimer);
    }
    return true;
  }

  // ─── Drag: pointer events on piece tray buttons ──────────────

  function handlePiecePointerDown(e, id) {
    e.preventDefault();
    // Capture pointer so we keep receiving events even when finger moves off the element
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    // Preserve the current orientation when re-dragging the already-selected piece;
    // reset to 0 only when picking up a different piece.
    const oIdx = selectedPieceId === id ? orientationIdx : 0;
    setSelectedPieceId(id);
    setOrientationIdx(oIdx);
    const cell = getCellFromClient(e.clientX, e.clientY);
    setHoveredCell(cell);
    setDragging({ pieceId: id, orientationIdx: oIdx, clientX: e.clientX, clientY: e.clientY });
  }

  function handlePiecePointerMove(e, id) {
    if (!dragging || dragging.pieceId !== id) return;
    e.preventDefault();
    const cell = getCellFromClient(e.clientX, e.clientY);
    setHoveredCell(cell);
    // Keep dragging.orientationIdx in sync with the latest orientationIdx state
    // so the ghost reflects any rotation applied before/during the drag
    setDragging((d) => d ? { ...d, clientX: e.clientX, clientY: e.clientY, orientationIdx: stateRef.current.orientationIdx } : null);
  }

  function handlePiecePointerUp(e, id) {
    if (!dragging || dragging.pieceId !== id) return;
    e.preventDefault();
    const cell = getCellFromClient(e.clientX, e.clientY);
    // Capture orientation from dragging before clearing it
    const oIdx = dragging.orientationIdx;
    setDragging(null);
    if (cell) {
      attemptPlace(cell[0], cell[1], id, oIdx, stateRef.current.boardState, timer);
    }
  }

  // ─── Board cell click (tap a placed non-anchor piece to remove) ──

  function handleCellClick(r, c) {
    if (!boardState || !puzzle) return;
    const anchorList = getParsed('anchors') || [];
    const cell = boardState[r][c];
    if (!cell || anchorList.includes(cell)) return;
    // Remove the whole piece from the board
    const newBoard = boardState.map((row) => [...row]);
    for (let pr = 0; pr < ROWS; pr++) {
      for (let pc = 0; pc < COLS; pc++) {
        if (newBoard[pr][pc] === cell) newBoard[pr][pc] = '';
      }
    }
    setBoardState(newBoard);
  }

  async function handleComplete(finalTime) {
    try {
      await savePackingResult(profile.id, puzzle.id, finalTime);
    } catch (err) {
      console.error('Failed to save packing result:', err);
    }
    onComplete({ time_seconds: finalTime });
  }

  // ─── Computed values ─────────────────────────────────────────

  const anchors = useMemo(() => getParsed('anchors') || [], [puzzle]);
  const pieces = useMemo(() => getParsed('pieces') || [], [puzzle]);

  const nonAnchorPieces = useMemo(
    () => pieces.filter((id) => !anchors.includes(id)),
    [pieces, anchors]
  );

  const placedNonAnchorIds = useMemo(() => {
    if (!boardState) return new Set();
    const placed = new Set();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const id = boardState[r][c];
        if (id && !anchors.includes(id)) placed.add(id);
      }
    }
    return placed;
  }, [boardState, anchors]);

  const trayPieces = useMemo(
    () => nonAnchorPieces.filter((id) => !placedNonAnchorIds.has(id)),
    [nonAnchorPieces, placedNonAnchorIds]
  );

  // ghostInfo uses the dragging piece if dragging, else the selected piece
  const activePieceId = dragging?.pieceId ?? selectedPieceId;
  const activeOrientIdx = dragging ? dragging.orientationIdx : orientationIdx;

  const ghostInfo = useMemo(() => {
    if (!hoveredCell || !activePieceId || !boardState) return null;
    const [r, c] = hoveredCell;
    const orientation = ALL_ORIENTATIONS[activePieceId][activeOrientIdx];
    const placed = orientation.map(([dr, dc]) => [r + dr, c + dc]);
    const valid = placed.every(
      ([pr, pc]) =>
        pr >= 0 && pr < ROWS && pc >= 0 && pc < COLS && boardState[pr][pc] === ''
    );
    return {
      cells: new Set(placed.map(([pr, pc]) => `${pr},${pc}`)),
      valid,
    };
  }, [hoveredCell, activePieceId, activeOrientIdx, boardState]);

  // ─── Render: loading ─────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-snow-200 border-t-orange-400 rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Render: already done ────────────────────────────────────

  if (phase === 'already_done') {
    const solution = getParsed('solution');
    return (
      <div className="flex-1 flex flex-col px-6 py-6 overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-snow-500 hover:text-snow-700 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Games</span>
          </button>
          <span className="text-2xl">🧩</span>
          <button
            onClick={onLogout}
            className="text-snow-400 hover:text-snow-600 text-sm font-medium transition-colors"
          >
            Switch
          </button>
        </div>

        {/* Done header */}
        <div className="text-center mb-4">
          <div className="text-5xl mb-2">✅</div>
          <h1 className="font-display text-xl font-bold text-snow-800">Already packed today!</h1>
          <p className="text-snow-500 text-sm mt-1">
            Your time:{' '}
            <span className="font-display font-bold text-orange-500">
              {alreadyDoneResult?.time_seconds != null
                ? formatTime(alreadyDoneResult.time_seconds)
                : '--:--'}
            </span>
          </p>
        </div>

        {/* Streak */}
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
          <p className="text-snow-400 text-xs font-medium uppercase tracking-wider mb-2 text-center">
            Packing Streak
          </p>
          <div className="flex items-center justify-center gap-6">
            <StreakTree streak={streak} size={80} gameType="packing" showLabel={true} />
            <div className="text-left">
              {streak === 0 && <p className="font-display font-bold text-sm text-snow-500">Play tomorrow to<br/>start your streak!</p>}
              {streak === 1 && <p className="font-display font-bold text-sm text-orange-500">Your streak<br/>has sprouted! 🌱</p>}
              {streak > 1 && streak < 7 && <p className="font-display font-bold text-sm text-orange-500">{streak} days strong!<br/>Keep going! 🌿</p>}
              {streak >= 7 && streak < 14 && <p className="font-display font-bold text-sm text-orange-600">{streak} day streak!<br/>You're on fire! 🔥</p>}
              {streak >= 14 && streak < 30 && <p className="font-display font-bold text-sm text-orange-700">{streak} days!<br/>Almost a full tree! 🌳</p>}
              {streak >= 30 && <p className="font-display font-bold text-sm text-orange-800">{streak} day streak!<br/>Full tree! 🌳✨</p>}
            </div>
          </div>
        </div>

        {/* Solution grid */}
        {solution && (
          <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
            <p className="text-snow-400 text-xs font-medium uppercase tracking-wider mb-3 text-center">
              Today's Solution
            </p>
            <div
              className="mx-auto"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                gap: '3px',
              }}
            >
              {solution.flat().map((id, i) => (
                <div
                  key={i}
                  className="aspect-square rounded"
                  style={{ backgroundColor: PIECE_COLORS[id] || '#e2e8f0' }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Countdown */}
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4 text-center">
          <p className="text-snow-400 text-xs font-medium uppercase tracking-wider mb-1">
            Next puzzle in
          </p>
          <p className="font-display text-2xl font-bold text-snow-700 tabular-nums">{countdown}</p>
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
            <p className="text-snow-400 text-xs font-medium uppercase tracking-wider mb-3 text-center">
              Today's Leaderboard
            </p>
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl ${
                    i === 0 ? 'bg-yellow-50' : i === 1 ? 'bg-snow-50' : i === 2 ? 'bg-orange-50/50' : ''
                  }`}
                >
                  <span className="font-display font-bold text-sm text-snow-400 w-5 text-center">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </span>
                  <span className="text-lg">{entry.profiles?.avatar_emoji}</span>
                  <span className="font-display font-semibold text-sm text-snow-700 flex-1 truncate">
                    {entry.profiles?.name}
                  </span>
                  <span className="font-display font-bold text-sm text-snow-500 tabular-nums">
                    {formatTime(entry.time_seconds)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onBack}
          className="w-full py-3 mt-auto bg-orange-500 hover:bg-orange-600 text-white font-display font-semibold text-sm rounded-xl active:scale-[0.98] transition-all"
        >
          Back to Games
        </button>
      </div>
    );
  }

  // ─── Render: ready ───────────────────────────────────────────

  if (phase === 'ready') {
    const anchorPositions = getParsed('anchor_positions') || {};
    const savedTime =
      timerState?.puzzleDate === puzzle?.puzzle_date ? timerState?.elapsedSeconds : null;

    // Build preview board (anchors only)
    const previewBoard = Array.from({ length: ROWS * COLS }, (_, idx) => {
      const r = Math.floor(idx / COLS);
      const c = idx % COLS;
      for (const id of anchors) {
        if ((anchorPositions[id] || []).some(([ar, ac]) => ar === r && ac === c)) return id;
      }
      return '';
    });

    return (
      <div className="flex-1 flex flex-col px-6 py-6 overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-snow-500 hover:text-snow-700 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="text-xs font-medium">Games</span>
          </button>
          <span className="font-display text-sm font-semibold text-snow-600">🧩 Puzzle Packing</span>
          <button
            onClick={onLogout}
            className="text-snow-400 hover:text-snow-600 text-xs font-medium transition-colors"
          >
            Switch
          </button>
        </div>

        {/* Title */}
        <div className="text-center mb-5">
          <div className="text-5xl mb-3">🧩</div>
          <h1 className="font-display text-2xl font-bold text-snow-800">Puzzle Packing</h1>
          <p className="text-snow-500 text-sm mt-2">Fit all the coloured pieces into the grid!</p>
        </div>

        {/* How to play */}
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
          <p className="text-snow-400 text-xs font-medium uppercase tracking-wider mb-3 text-center">
            How to play
          </p>
          <div className="space-y-2 text-sm text-snow-600">
            <div className="flex items-start gap-2">
              <span className="text-orange-400 font-bold">①</span>
              <span>2 pieces are already placed as hints</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-orange-400 font-bold">②</span>
              <span>Tap a piece below the grid to select it</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-orange-400 font-bold">③</span>
              <span>Tap a grid cell to place the piece there</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-orange-400 font-bold">④</span>
              <span>Tap Rotate to try different orientations</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-orange-400 font-bold">⑤</span>
              <span>Tap a placed piece to remove it</span>
            </div>
          </div>
        </div>

        {/* Preview board */}
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
          <p className="text-snow-400 text-xs font-medium uppercase tracking-wider mb-3 text-center">
            Today's Starting Grid
          </p>
          <div
            className="mx-auto"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gap: '3px',
            }}
          >
            {previewBoard.map((id, i) => (
              <div
                key={i}
                className="aspect-square rounded"
                style={{
                  backgroundColor: id ? PIECE_COLORS[id] : '#f1f5f9',
                  border: id ? '2px solid rgba(0,0,0,0.12)' : '2px solid transparent',
                  boxSizing: 'border-box',
                }}
              />
            ))}
          </div>
        </div>

        {/* Welcome back */}
        {savedTime != null && savedTime > 0 && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 mb-4 text-center">
            <p className="text-orange-600 text-sm font-display font-semibold">
              Welcome back! ⏱ {formatTime(savedTime)} elapsed
            </p>
          </div>
        )}

        <button
          onClick={startPlaying}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-display font-bold text-lg rounded-2xl active:scale-[0.98] transition-all mt-auto shadow-card"
        >
          I'm Ready! 🧩
        </button>
      </div>
    );
  }

  // ─── Render: playing ─────────────────────────────────────────

  const allPlaced = trayPieces.length === 0;
  const isDragging = !!dragging;

  return (
    <div className="flex-1 flex flex-col px-3 py-3 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-snow-500 hover:text-snow-700 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="text-xs font-medium">Games</span>
        </button>
        <div className="font-display text-xl font-bold text-snow-700 tabular-nums">
          {formatTime(timer)}
        </div>
        <button
          onClick={resetBoard}
          className="flex items-center gap-1 text-snow-400 hover:text-orange-500 transition-colors text-xs font-medium"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-3.86" />
          </svg>
          Reset
        </button>
      </div>

      {/* Board */}
      <div
        ref={boardRef}
        className="mx-auto w-full mb-2"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gap: '3px',
        }}
        onPointerLeave={() => { if (!isDragging) setHoveredCell(null); }}
      >
        {boardState?.flat().map((cell, idx) => {
          const r = Math.floor(idx / COLS);
          const c = idx % COLS;
          const isAnchor = anchors.includes(cell);
          const ghostKey = `${r},${c}`;
          const isGhost = !cell && ghostInfo?.cells.has(ghostKey);
          const ghostValid = ghostInfo?.valid;

          let bgColor = '#e2e8f0'; // empty
          if (cell) {
            bgColor = PIECE_COLORS[cell] || '#94a3b8';
          } else if (isGhost) {
            bgColor = PIECE_COLORS[activePieceId] || '#94a3b8';
          }

          return (
            <div
              key={idx}
              className="aspect-square select-none"
              style={{
                backgroundColor: bgColor,
                opacity: isGhost ? (ghostValid ? 0.55 : 0.25) : 1,
                borderRadius: 5,
                border: isAnchor
                  ? '2.5px solid rgba(0,0,0,0.22)'
                  : '2px solid rgba(0,0,0,0.05)',
                boxSizing: 'border-box',
                cursor: isAnchor ? 'default' : (cell && !isAnchor ? 'pointer' : 'default'),
                transition: 'opacity 0.1s',
              }}
              onClick={() => handleCellClick(r, c)}
            />
          );
        })}
      </div>

      {/* Piece tray */}
      <div className="bg-white rounded-2xl shadow-card p-3 flex-1 flex flex-col min-h-0">
        <p className="text-snow-400 text-[10px] font-medium uppercase tracking-wider mb-2 text-center">
          {allPlaced
            ? '🎉 All pieces placed!'
            : isDragging
            ? 'Drop piece onto the grid ↑'
            : `Pieces · ${trayPieces.length} remaining`}
        </p>

        {/* Piece buttons — drag to place */}
        <div className="flex flex-wrap gap-2 justify-center items-center flex-1">
          {trayPieces.map((id) => {
            const isActive = activePieceId === id;
            const oIdx = isActive ? activeOrientIdx : 0;
            const orientCells = ALL_ORIENTATIONS[id][oIdx];
            const isBeingDragged = dragging?.pieceId === id;
            return (
              <button
                key={id}
                onPointerDown={(e) => handlePiecePointerDown(e, id)}
                onPointerMove={(e) => handlePiecePointerMove(e, id)}
                onPointerUp={(e) => handlePiecePointerUp(e, id)}
                onPointerCancel={() => setDragging(null)}
                style={{
                  touchAction: 'none',
                  opacity: isBeingDragged ? 0.35 : 1,
                  cursor: 'grab',
                }}
                className={`p-2 rounded-xl border-2 transition-colors select-none ${
                  isActive
                    ? 'border-orange-400 bg-orange-50 shadow-md'
                    : 'border-snow-200 bg-snow-50 hover:border-snow-300'
                }`}
              >
                <PieceMini pieceId={id} orientationCells={orientCells} selected={isActive} />
              </button>
            );
          })}

          {/* Show placed pieces greyed out */}
          {nonAnchorPieces
            .filter((id) => placedNonAnchorIds.has(id))
            .map((id) => (
              <div
                key={id}
                className="p-2 rounded-xl border-2 border-snow-100 bg-snow-50 opacity-30"
              >
                <PieceMini pieceId={id} orientationCells={ALL_ORIENTATIONS[id][0]} selected={false} />
              </div>
            ))}
        </div>

        {/* Controls: rotate + deselect (shown when a piece is selected but not mid-drag) */}
        {selectedPieceId && !isDragging && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                const n = ALL_ORIENTATIONS[selectedPieceId].length;
                setOrientationIdx((i) => (i + 1) % n);
              }}
              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-display font-semibold text-sm rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-.49-8.14" />
              </svg>
              Rotate
            </button>
            <button
              onClick={() => { setSelectedPieceId(null); setOrientationIdx(0); }}
              className="px-4 py-2 bg-snow-100 hover:bg-snow-200 text-snow-600 font-display font-semibold text-sm rounded-xl active:scale-[0.98] transition-all"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Floating piece preview during drag */}
      {dragging && (
        <div
          style={{
            position: 'fixed',
            left: dragging.clientX + 8,
            top: dragging.clientY + 8,
            pointerEvents: 'none',
            zIndex: 9999,
            opacity: 0.85,
            transform: 'scale(1.15)',
            transformOrigin: 'top left',
          }}
        >
          <PieceMini
            pieceId={dragging.pieceId}
            orientationCells={ALL_ORIENTATIONS[dragging.pieceId][dragging.orientationIdx]}
            selected={true}
          />
        </div>
      )}
    </div>
  );
}
