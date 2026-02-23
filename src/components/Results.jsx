import React, { useState, useEffect } from 'react';
import { getTodaysLeaderboard, getTodaysSudokuLeaderboard, getProfileStats } from '../lib/supabase';

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

export default function Results({ profile, result, puzzle, gameType, onHistory, onBack }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [stats, setStats] = useState(null);
  const [showConfetti, setShowConfetti] = useState(true);
  const [countdown, setCountdown] = useState('');

  const isSudoku = gameType === 'sudoku';
  const gameName = isSudoku ? 'Sudoku' : 'WordChain';
  const gameEmoji = isSudoku ? '🔢' : '🔗';
  const accentColor = isSudoku ? 'text-accent-green' : 'text-accent-blue';

  useEffect(() => {
    loadData();
    const confettiTimer = setTimeout(() => setShowConfetti(false), 3000);

    function updateCountdown() {
      const diff = getNextMidnightSGT().getTime() - Date.now();
      setCountdown(formatCountdown(diff));
    }
    updateCountdown();
    const cdInterval = setInterval(updateCountdown, 1000);

    return () => {
      clearTimeout(confettiTimer);
      clearInterval(cdInterval);
    };
  }, []);

  async function loadData() {
    try {
      const leaderboardFn = isSudoku ? getTodaysSudokuLeaderboard : getTodaysLeaderboard;
      const [lb, st] = await Promise.all([
        puzzle ? leaderboardFn(puzzle.id) : [],
        getProfileStats(profile.id),
      ]);
      setLeaderboard(lb);
      setStats(st);
    } catch (err) {
      console.error('Failed to load results data:', err);
    }
  }

  const timeSeconds = result?.time_seconds || 0;

  // WordChain-specific data
  const pairExplanations = !isSudoku && puzzle?.pair_explanations
    ? typeof puzzle.pair_explanations === 'string'
      ? JSON.parse(puzzle.pair_explanations)
      : puzzle.pair_explanations
    : [];
  const solution = !isSudoku && puzzle?.solution
    ? typeof puzzle.solution === 'string'
      ? JSON.parse(puzzle.solution)
      : puzzle.solution
    : [];

  // Sudoku-specific data
  const sudokuGrid = isSudoku && puzzle?.grid
    ? typeof puzzle.grid === 'string'
      ? JSON.parse(puzzle.grid)
      : puzzle.grid
    : [];

  return (
    <div className="flex-1 flex flex-col px-6 py-6 overflow-y-auto animate-fade-in">
      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${60 + Math.random() * 40}%`,
                animationDelay: `${Math.random() * 1}s`,
                animationDuration: `${1 + Math.random() * 1}s`,
                fontSize: `${16 + Math.random() * 12}px`,
              }}
            >
              {['🎉', '⭐', '🌟', '✨', '🎊', '💫'][Math.floor(Math.random() * 6)]}
            </div>
          ))}
        </div>
      )}

      {/* Success header */}
      <div className="text-center mb-6">
        <div className="text-6xl mb-3 animate-bounce-in">🎉</div>
        <h1 className="font-display text-2xl font-bold text-snow-800">
          Amazing!
        </h1>
        <p className="text-snow-500 text-sm mt-1">
          You completed today's {gameName}!
        </p>
      </div>

      {/* Time card */}
      <div className="bg-white rounded-2xl shadow-card p-5 mb-4 text-center">
        <p className="text-snow-400 text-xs font-medium uppercase tracking-wider mb-1">
          Your Time
        </p>
        <p className={`font-display text-4xl font-bold ${accentColor}`}>
          {formatTime(timeSeconds)}
        </p>
      </div>

      {/* Countdown to next puzzle */}
      <div className="bg-white rounded-2xl shadow-card p-4 mb-4 text-center">
        <p className="text-snow-400 text-xs font-medium uppercase tracking-wider mb-1">
          Next puzzle in
        </p>
        <p className="font-display text-2xl font-bold text-snow-700 tabular-nums">
          {countdown}
        </p>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white rounded-xl shadow-card p-3 text-center">
            <p className="font-display text-2xl font-bold text-snow-800">
              {stats.totalPlayed}
            </p>
            <p className="text-snow-400 text-[10px] font-medium uppercase tracking-wider">
              Played
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-card p-3 text-center">
            <p className="font-display text-2xl font-bold text-accent-green">
              {stats.streak}
            </p>
            <p className="text-snow-400 text-[10px] font-medium uppercase tracking-wider">
              Streak
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-card p-3 text-center">
            <p className="font-display text-2xl font-bold text-accent-purple">
              {stats.bestTime ? formatTime(stats.bestTime) : '--'}
            </p>
            <p className="text-snow-400 text-[10px] font-medium uppercase tracking-wider">
              Best
            </p>
          </div>
        </div>
      )}

      {/* WordChain solution chain */}
      {!isSudoku && solution.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
          <p className="text-snow-400 text-xs font-medium uppercase tracking-wider mb-3 text-center">
            Today's Chain
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1">
            {solution.map((word, i) => (
              <React.Fragment key={i}>
                <span className="font-display font-bold text-sm text-snow-700 px-2 py-1 bg-snow-50 rounded-lg">
                  {word.toUpperCase()}
                </span>
                {i < solution.length - 1 && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c4ced9" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </React.Fragment>
            ))}
          </div>
          {pairExplanations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-snow-100">
              <div className="flex flex-wrap gap-1.5 justify-center">
                {pairExplanations.map((exp, i) => (
                  <span key={i} className="text-[11px] text-snow-400 bg-snow-50 px-2 py-0.5 rounded-full">
                    {exp}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sudoku completed grid */}
      {isSudoku && sudokuGrid.length === 16 && (
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
          <p className="text-snow-400 text-xs font-medium uppercase tracking-wider mb-3 text-center">
            Completed Grid
          </p>
          <div className="flex justify-center">
            <div className="inline-grid grid-cols-4 gap-0 border-2 border-snow-600 rounded-lg overflow-hidden">
              {sudokuGrid.map((val, i) => {
                const row = Math.floor(i / 4);
                const col = i % 4;
                const borderRight = col === 1 ? 'border-r-2 border-r-snow-500' : col < 3 ? 'border-r border-r-snow-200' : '';
                const borderBottom = row === 1 ? 'border-b-2 border-b-snow-500' : row < 3 ? 'border-b border-b-snow-200' : '';
                return (
                  <div
                    key={i}
                    className={`w-11 h-11 flex items-center justify-center font-display font-bold text-lg text-accent-green ${borderRight} ${borderBottom} bg-green-50/30`}
                  >
                    {val}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
          <p className="text-snow-400 text-xs font-medium uppercase tracking-wider mb-3 text-center">
            Today's {gameName} Leaderboard
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

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-4">
        <button
          onClick={onHistory}
          className="flex-1 py-3 bg-snow-100 text-snow-600 font-display font-semibold text-sm rounded-xl hover:bg-snow-200 active:scale-[0.98] transition-all"
        >
          History
        </button>
        <button
          onClick={onBack}
          className={`flex-1 py-3 ${isSudoku ? 'bg-accent-green hover:bg-green-600' : 'bg-accent-blue hover:bg-blue-600'} text-white font-display font-semibold text-sm rounded-xl active:scale-[0.98] transition-all`}
        >
          Back to Games
        </button>
      </div>
    </div>
  );
}
