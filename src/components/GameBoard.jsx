import React, { useState, useEffect, useRef } from 'react';
import { getTodaysPuzzle, generatePuzzleViaEdge, saveResult, hasCompletedToday } from '../lib/supabase';

// Tile color palette for word tiles
const TILE_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', accent: '#3b82f6' },
  { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', accent: '#8b5cf6' },
  { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', accent: '#22c55e' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', accent: '#f97316' },
  { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', accent: '#ec4899' },
  { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', accent: '#eab308' },
  { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', accent: '#14b8a6' },
];

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getNextMidnightSGT() {
  const now = new Date();
  // Current time in SGT
  const sgtOffset = 8 * 60 * 60 * 1000;
  const sgtNow = new Date(now.getTime() + sgtOffset);
  // Next midnight SGT
  const nextMidnight = new Date(sgtNow);
  nextMidnight.setUTCHours(0, 0, 0, 0);
  nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
  // Convert back to local
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

export default function GameBoard({ profile, puzzle, setPuzzle, timerState, setTimerState, onComplete, onLogout, onHistory, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('loading'); // loading, already_done, ready, playing
  const [chain, setChain] = useState([]);
  const [availableWords, setAvailableWords] = useState([]);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [wrongPair, setWrongPair] = useState(null);
  const [draggedWord, setDraggedWord] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [alreadyDoneResult, setAlreadyDoneResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  // Always-current snapshot used by the unmount cleanup to save progress
  const snapshotRef = useRef({});
  snapshotRef.current = { phase, completed, timer, chain, availableWords, puzzleDate: puzzle?.puzzle_date };

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
          chain: s.chain,
          availableWords: s.availableWords,
        });
      }
    };
  }, []);

  // Load puzzle and check completion
  useEffect(() => {
    loadPuzzleAndCheck();
  }, []);

  async function loadPuzzleAndCheck() {
    setLoading(true);
    try {
      // Load puzzle
      let p = puzzle;
      if (!p) {
        p = await getTodaysPuzzle();
        if (!p) {
          p = await generatePuzzleViaEdge();
        }
        setPuzzle(p);
      }

      // Check if already completed today
      const { completed: done, result } = await hasCompletedToday(profile.id);
      if (done) {
        setAlreadyDoneResult(result);
        setPhase('already_done');
        startCountdown();
        // Load leaderboard
        loadLeaderboard(p.id);
      } else {
        setPhase('ready');
      }
    } catch (err) {
      console.error('Failed to load puzzle:', err);
      setError('Could not load today\'s puzzle. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  async function loadLeaderboard(puzzleId) {
    try {
      const { data } = await (await import('../lib/supabase')).supabase
        .from('results')
        .select('time_seconds, profiles(name, avatar_emoji)')
        .eq('puzzle_id', puzzleId)
        .order('time_seconds', { ascending: true })
        .limit(10);
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
        // Reload when new puzzle is available
        window.location.reload();
      }
    }
    update();
    countdownRef.current = setInterval(update, 1000);
  }

  function startPlaying() {
    // Restore saved mid-game state if it's for the same puzzle date
    if (timerState && timerState.puzzleDate === puzzle.puzzle_date) {
      setChain(timerState.chain);
      setAvailableWords(timerState.availableWords);
      setTimer(timerState.elapsedSeconds);
      setCompleted(false);
      setPhase('playing');
      setIsRunning(true);
      return;
    }

    // Fresh start
    const words = typeof puzzle.words === 'string' ? JSON.parse(puzzle.words) : puzzle.words;
    const solution = typeof puzzle.solution === 'string' ? JSON.parse(puzzle.solution) : puzzle.solution;
    // Pre-place the first word of the solution
    const firstWord = solution[0];
    // Remove only the first matching occurrence from the scrambled words
    let removed = false;
    const remainingWords = words.filter((w) => {
      if (!removed && w.toUpperCase() === firstWord.toUpperCase()) {
        removed = true;
        return false;
      }
      return true;
    });
    setAvailableWords(shuffleArray(remainingWords));
    const newChain = new Array(words.length).fill(null);
    newChain[0] = firstWord; // Lock first word in place
    setChain(newChain);
    setTimer(0);
    setCompleted(false);
    setPhase('playing');
    // Timer starts immediately
    setIsRunning(true);
  }

  // Timer
  useEffect(() => {
    if (isRunning && !completed) {
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, completed]);

  // Place a word into the next available chain slot (skip slot 0, it's locked)
  function placeWord(word) {
    const nextSlot = chain.indexOf(null, 1); // Start searching from index 1
    if (nextSlot === -1) return;
    setChain((prev) => {
      const next = [...prev];
      next[nextSlot] = word;
      return next;
    });
    setAvailableWords((prev) => prev.filter((w) => w !== word));
  }

  // Remove a word from the chain back to the bank (slot 0 is locked)
  function removeWord(slotIndex) {
    if (completed) return;
    if (slotIndex === 0) return; // First word is locked
    const word = chain[slotIndex];
    if (!word) return;
    setChain((prev) => {
      const next = [...prev];
      for (let i = slotIndex; i < next.length - 1; i++) {
        next[i] = next[i + 1];
      }
      next[next.length - 1] = null;
      return next;
    });
    setAvailableWords((prev) => [...prev, word]);
  }

  function handleDragStart(word) { setDraggedWord(word); }
  function handleDragOver(e, slotIndex) { e.preventDefault(); setDragOverSlot(slotIndex); }
  function handleDragLeave() { setDragOverSlot(null); }

  function handleDrop(e, slotIndex) {
    e.preventDefault();
    setDragOverSlot(null);
    if (draggedWord && chain[slotIndex] === null) {
      setChain((prev) => {
        const next = [...prev];
        next[slotIndex] = draggedWord;
        return next;
      });
      setAvailableWords((prev) => prev.filter((w) => w !== draggedWord));
      setDraggedWord(null);
    }
  }

  async function checkChain() {
    if (!puzzle) return;
    const solution = typeof puzzle.solution === 'string' ? JSON.parse(puzzle.solution) : puzzle.solution;
    if (chain.some((w) => w === null)) return;

    const isCorrect = chain.every((w, i) => w.toUpperCase() === solution[i].toUpperCase());

    if (isCorrect) {
      setCompleted(true);
      setIsRunning(false);
      clearInterval(timerRef.current);
      try {
        const result = await saveResult(profile.id, puzzle.id, timer);
        onComplete({ ...result, time_seconds: timer });
      } catch (err) {
        console.error('Failed to save result:', err);
        onComplete({ time_seconds: timer });
      }
    } else {
      for (let i = 0; i < chain.length - 1; i++) {
        const pair = `${chain[i]} ${chain[i + 1]}`.toLowerCase();
        const solPair = `${solution[i]} ${solution[i + 1]}`.toLowerCase();
        if (pair !== solPair) {
          setWrongPair(i);
          setTimeout(() => setWrongPair(null), 600);
          break;
        }
      }
    }
  }

  function clearChain() {
    if (completed) return;
    // Keep the first word (locked), return everything else to the bank
    const wordsInChain = chain.slice(1).filter(Boolean);
    setAvailableWords((prev) => [...prev, ...wordsInChain]);
    const newChain = new Array(chain.length).fill(null);
    newChain[0] = chain[0]; // Keep first word locked
    setChain(newChain);
  }

  // ─── LOADING ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-3 border-snow-200 border-t-accent-blue rounded-full animate-spin" />
        <p className="text-snow-500 font-medium text-sm">Loading today's puzzle...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <div className="text-4xl">😕</div>
        <p className="text-snow-600 text-center">{error}</p>
        <button onClick={loadPuzzleAndCheck} className="px-6 py-2.5 bg-accent-blue text-white font-display font-semibold rounded-xl">
          Try Again
        </button>
      </div>
    );
  }

  // ─── ALREADY COMPLETED ──────────────────────────────────────
  if (phase === 'already_done') {
    return (
      <div className="flex-1 flex flex-col px-6 py-6 overflow-y-auto animate-fade-in">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={onLogout} className="flex items-center gap-1.5 text-snow-500 hover:text-snow-700 transition-colors">
            <span className="text-lg">{profile.avatar_emoji}</span>
            <span className="text-xs font-medium">{profile.name}</span>
          </button>
          <button onClick={onHistory} className="text-snow-400 hover:text-snow-600 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="font-display text-xl font-bold text-snow-800 mb-2">
            Puzzle Complete!
          </h1>
          <p className="text-snow-500 text-sm mb-2">
            You finished today's WordChain in
          </p>
          <p className="font-display text-3xl font-bold text-accent-blue mb-8">
            {alreadyDoneResult ? formatTime(alreadyDoneResult.time_seconds) : '--:--'}
          </p>

          {/* Countdown to next puzzle */}
          <div className="bg-white rounded-2xl shadow-card p-5 w-full mb-6 text-center">
            <p className="text-snow-400 text-xs font-medium uppercase tracking-wider mb-2">
              Next puzzle in
            </p>
            <p className="font-display text-3xl font-bold text-snow-700 tabular-nums">
              {countdown}
            </p>
          </div>

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <div className="bg-white rounded-2xl shadow-card p-4 w-full mb-4">
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
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <button onClick={onHistory} className="flex-1 py-3 bg-snow-100 text-snow-600 font-display font-semibold text-sm rounded-xl hover:bg-snow-200 active:scale-[0.98] transition-all">
            History
          </button>
          <button onClick={onBack || onLogout} className="flex-1 py-3 bg-accent-blue text-white font-display font-semibold text-sm rounded-xl hover:bg-blue-600 active:scale-[0.98] transition-all">
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
        {/* Top bar */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <button onClick={onBack || onLogout} className="flex items-center gap-1.5 text-snow-500 hover:text-snow-700 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="text-xs font-medium">Games</span>
          </button>
        </div>

        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-4xl">🔗</span>
          </div>

          <h1 className="font-display text-2xl font-bold text-snow-800 mb-2">
            Daily WordChain
          </h1>
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
                <p className="text-accent-blue text-sm font-display font-bold">
                  ⏱ {formatTime(timerState.elapsedSeconds)} elapsed
                </p>
              </>
            ) : (
              <>
                <p className="text-snow-600 text-sm leading-relaxed mb-3">
                  The first word is given. Arrange the remaining <strong>6 words</strong> to complete the chain where each pair forms a compound word.
                </p>
                <p className="text-snow-400 text-xs">
                  The timer starts as soon as you begin!
                </p>
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
  const filledCount = chain.filter(Boolean).length;
  const totalSlots = chain.length;
  const allFilled = filledCount === totalSlots;

  return (
    <div className="flex-1 flex flex-col px-4 py-4 animate-fade-in overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onLogout} className="flex items-center gap-1.5 text-snow-500 hover:text-snow-700 transition-colors">
          <span className="text-lg">{profile.avatar_emoji}</span>
          <span className="text-xs font-medium text-snow-500">{profile.name}</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={onHistory} className="text-snow-400 hover:text-snow-600 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Puzzle info */}
      <div className="text-center mb-4">
        <h1 className="font-display text-lg font-bold text-snow-800">Daily WordChain</h1>
        {puzzle && (
          <p className="text-snow-400 text-xs font-medium">
            Puzzle #{puzzle.puzzle_number} &middot; {new Date(puzzle.puzzle_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        )}
      </div>

      {/* Timer */}
      <div className="flex justify-center mb-4">
        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full ${
          timer > 120 ? 'bg-red-50 timer-warning' : 'bg-snow-100 text-snow-600'
        }`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="font-display font-bold text-lg tabular-nums">{formatTime(timer)}</span>
        </div>
      </div>

      {/* Chain area */}
      <div className="flex-1 flex flex-col gap-1.5 mb-3 overflow-y-auto">
        <p className="text-xs text-snow-400 font-medium text-center mb-1">
          Build your word chain ({filledCount}/{totalSlots})
        </p>
        {chain.map((word, i) => (
          <div key={i}>
            <div
              onDragOver={(e) => !word && i !== 0 && handleDragOver(e, i)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => i !== 0 && handleDrop(e, i)}
              onClick={() => word && i !== 0 && removeWord(i)}
              className={`drop-zone flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all duration-200 ${
                i === 0 && word
                  ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-300 shadow-tile'
                  : word
                    ? `bg-white border-snow-200 shadow-tile cursor-pointer hover:shadow-tile-active ${
                        wrongPair === i || wrongPair === i - 1 ? 'animate-shake border-accent-red' : ''
                      }`
                    : `border-dashed border-snow-200 bg-snow-50/50 ${dragOverSlot === i ? 'drag-over' : ''}`
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                i === 0 && word
                  ? 'bg-blue-100 text-blue-700'
                  : word
                    ? `${TILE_COLORS[i % TILE_COLORS.length].bg} ${TILE_COLORS[i % TILE_COLORS.length].text}`
                    : 'bg-snow-100 text-snow-400'
              }`}>
                {i === 0 ? '🔗' : i + 1}
              </div>
              {word ? (
                <span className={`font-display font-bold text-base ${i === 0 ? 'text-blue-700' : TILE_COLORS[i % TILE_COLORS.length].text}`}>
                  {word.toUpperCase()}
                </span>
              ) : (
                <span className="text-snow-300 text-sm">Drag or tap a word here</span>
              )}
              {i === 0 && word && (
                <span className="ml-auto text-xs text-blue-400 font-medium flex-shrink-0">START</span>
              )}
              {word && i !== 0 && !completed && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="ml-auto text-snow-300 flex-shrink-0">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </div>
            {i < chain.length - 1 && word && chain[i + 1] && (
              <div className="flex justify-center py-0.5">
                <div className="w-0.5 h-3 rounded-full" style={{
                  background: `linear-gradient(to bottom, ${TILE_COLORS[i % TILE_COLORS.length].accent}, ${TILE_COLORS[(i + 1) % TILE_COLORS.length].accent})`,
                }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Word bank */}
      {availableWords.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-snow-400 font-medium text-center mb-2">Available words</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {availableWords.map((word, i) => (
              <button
                key={`${word}-${i}`}
                draggable
                onDragStart={() => handleDragStart(word)}
                onClick={() => placeWord(word)}
                className="word-tile px-4 py-2 bg-white rounded-xl border-2 border-snow-200 shadow-tile hover:shadow-tile-active active:scale-95 transition-all duration-150"
              >
                <span className="font-display font-bold text-sm text-snow-700">{word.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {!allFilled && (
          <button onClick={clearChain} disabled={filledCount === 0}
            className="flex-1 py-3 bg-snow-100 text-snow-600 font-display font-semibold text-sm rounded-xl hover:bg-snow-200 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            Clear All
          </button>
        )}
        {allFilled && (
          <>
            <button onClick={clearChain}
              className="flex-1 py-3 bg-snow-100 text-snow-600 font-display font-semibold text-sm rounded-xl hover:bg-snow-200 active:scale-[0.98] transition-all">
              Reset
            </button>
            <button onClick={checkChain}
              className="flex-[2] py-3 bg-accent-green text-white font-display font-bold text-base rounded-xl shadow-md hover:bg-green-600 active:scale-[0.98] transition-all animate-pulse-slow">
              Check Chain!
            </button>
          </>
        )}
      </div>
    </div>
  );
}
