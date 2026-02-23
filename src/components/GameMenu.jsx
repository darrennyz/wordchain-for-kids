import React, { useState, useEffect } from 'react';
import { hasCompletedToday, hasCompletedSudokuToday } from '../lib/supabase';

export default function GameMenu({ profile, onSelectGame, onHistory, onLogout, onViewLeaderboard }) {
  const [wcDone, setWcDone] = useState(false);
  const [sudokuDone, setSudokuDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkCompletion();
  }, []);

  async function checkCompletion() {
    try {
      const [wc, su] = await Promise.all([
        hasCompletedToday(profile.id),
        hasCompletedSudokuToday(profile.id),
      ]);
      setWcDone(wc.completed);
      setSudokuDone(su.completed);
    } catch (err) {
      console.error('Failed to check completion:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col px-6 py-6 animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 text-snow-500 hover:text-snow-700 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="text-xs font-medium">Switch</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{profile.avatar_emoji}</span>
          <span className="font-display font-semibold text-sm text-snow-700">{profile.name}</span>
        </div>
        <button
          onClick={onHistory}
          className="text-snow-400 hover:text-snow-600 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl font-bold text-snow-800">
          Choose a Game
        </h1>
        <p className="mt-1 text-snow-500 text-sm">
          Pick today's challenge
        </p>
      </div>

      {/* Game cards */}
      <div className="flex-1 flex flex-col gap-4">
        {/* WordChain card */}
        <button
          onClick={() => onSelectGame('wordchain')}
          className="relative flex items-center gap-4 p-5 bg-white rounded-2xl shadow-card hover:shadow-card-hover active:scale-[0.98] transition-all text-left"
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center flex-shrink-0">
            <span className="text-3xl">🔗</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-base text-snow-800">WordChain</h2>
            <p className="text-snow-400 text-xs mt-0.5">
              Build a chain of compound words
            </p>
          </div>
          {!loading && (
            wcDone ? (
              <span className="px-2 py-1 bg-green-50 text-green-600 text-xs font-display font-semibold rounded-lg flex-shrink-0">
                Done ✓
              </span>
            ) : (
              <span className="px-2 py-1 bg-blue-50 text-accent-blue text-xs font-display font-semibold rounded-lg flex-shrink-0">
                Play →
              </span>
            )
          )}
        </button>

        {/* Sudoku card */}
        <button
          onClick={() => onSelectGame('sudoku')}
          className="relative flex items-center gap-4 p-5 bg-white rounded-2xl shadow-card hover:shadow-card-hover active:scale-[0.98] transition-all text-left"
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-100 to-teal-100 flex items-center justify-center flex-shrink-0">
            <span className="text-3xl">🔢</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-base text-snow-800">4×4 Sudoku</h2>
            <p className="text-snow-400 text-xs mt-0.5">
              Fill the grid with numbers 1–4
            </p>
          </div>
          {!loading && (
            sudokuDone ? (
              <span className="px-2 py-1 bg-green-50 text-green-600 text-xs font-display font-semibold rounded-lg flex-shrink-0">
                Done ✓
              </span>
            ) : (
              <span className="px-2 py-1 bg-green-50 text-accent-green text-xs font-display font-semibold rounded-lg flex-shrink-0">
                Play →
              </span>
            )
          )}
        </button>
      </div>

      {/* Footer buttons */}
      <div className="flex gap-2 pt-4">
        <button
          onClick={onViewLeaderboard}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 text-yellow-700 font-display font-semibold text-sm rounded-xl hover:from-yellow-100 hover:to-orange-100 active:scale-[0.98] transition-all"
        >
          <span>🏆</span> Weekly
        </button>
        <button
          onClick={onHistory}
          className="flex-1 py-3 bg-snow-100 text-snow-600 font-display font-semibold text-sm rounded-xl hover:bg-snow-200 active:scale-[0.98] transition-all"
        >
          History
        </button>
      </div>
    </div>
  );
}
