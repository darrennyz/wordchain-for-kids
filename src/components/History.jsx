import React, { useState, useEffect } from 'react';
import { getProfileAllResults, getProfileStats, getStreakForGame } from '../lib/supabase';
import StreakTree from './StreakTree';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function History({ profile, onBack, onLogout }) {
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [wcStreak, setWcStreak] = useState(0);
  const [sudokuStreak, setSudokuStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const [res, st, wcs, sus] = await Promise.all([
        getProfileAllResults(profile.id),
        getProfileStats(profile.id),
        getStreakForGame(profile.id, 'wordchain'),
        getStreakForGame(profile.id, 'sudoku'),
      ]);
      setResults(res);
      setStats(st);
      setWcStreak(wcs);
      setSudokuStreak(sus);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col px-6 py-6 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-snow-500 hover:text-snow-700 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>
        <button
          onClick={onLogout}
          className="text-snow-400 hover:text-snow-600 text-sm font-medium transition-colors"
        >
          Switch Player
        </button>
      </div>

      {/* Profile header */}
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">{profile.avatar_emoji}</div>
        <h1 className="font-display text-xl font-bold text-snow-800">
          {profile.name}'s History
        </h1>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-2 mb-6">
          <div className="bg-white rounded-xl shadow-card p-3 text-center">
            <p className="font-display text-xl font-bold text-snow-800">
              {stats.totalPlayed}
            </p>
            <p className="text-snow-400 text-[9px] font-medium uppercase tracking-wider">
              Played
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-card p-3 text-center">
            <p className="font-display text-xl font-bold text-accent-green">
              {stats.streak}
            </p>
            <p className="text-snow-400 text-[9px] font-medium uppercase tracking-wider">
              Streak
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-card p-3 text-center">
            <p className="font-display text-xl font-bold text-accent-purple">
              {stats.bestTime ? formatTime(stats.bestTime) : '--'}
            </p>
            <p className="text-snow-400 text-[9px] font-medium uppercase tracking-wider">
              Best
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-card p-3 text-center">
            <p className="font-display text-xl font-bold text-accent-blue">
              {stats.avgTime ? formatTime(stats.avgTime) : '--'}
            </p>
            <p className="text-snow-400 text-[9px] font-medium uppercase tracking-wider">
              Avg
            </p>
          </div>
        </div>
      )}

      {/* Streak trees */}
      {!loading && (
        <div className="mb-5">
          <p className="text-snow-400 text-xs font-medium uppercase tracking-wider mb-3 text-center">
            Current Streaks
          </p>
          <div className="grid grid-cols-2 gap-3">
            {/* WordChain streak */}
            <div className="bg-white rounded-2xl shadow-card p-4 flex flex-col items-center gap-1">
              <p className="font-display font-semibold text-xs text-snow-500 mb-1">🔗 WordChain</p>
              <StreakTree streak={wcStreak} size={72} gameType="wordchain" showLabel={true} />
            </div>
            {/* Sudoku streak */}
            <div className="bg-white rounded-2xl shadow-card p-4 flex flex-col items-center gap-1">
              <p className="font-display font-semibold text-xs text-snow-500 mb-1">🔢 Sudoku</p>
              <StreakTree streak={sudokuStreak} size={72} gameType="sudoku" showLabel={true} />
            </div>
          </div>
        </div>
      )}

      {/* Results list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-snow-200 border-t-accent-blue rounded-full animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-snow-500 font-medium">No games yet!</p>
            <p className="text-snow-400 text-sm mt-1">
              Complete your first puzzle to see it here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((r, i) => {
              const date = r.puzzle_date
                ? new Date(r.puzzle_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                : new Date(r.completed_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
              const puzzleNum = r.puzzle_number;
              const isWordchain = r.gameType === 'wordchain';

              return (
                <div
                  key={`${r.gameType}-${r.id}`}
                  className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-card"
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
                  {/* Game type badge */}
                  <div className="flex-shrink-0 w-8 text-center text-lg">
                    {isWordchain ? '🔗' : '🔢'}
                  </div>

                  {/* Date */}
                  <div className="flex-shrink-0 w-14 text-center">
                    <p className="font-display font-bold text-sm text-snow-700">
                      {date}
                    </p>
                    {puzzleNum && (
                      <p className="text-snow-400 text-[10px]">
                        #{puzzleNum}
                      </p>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="w-px h-8 bg-snow-100" />

                  {/* Time */}
                  <div className="flex-1">
                    <span className={`font-display font-bold text-lg tabular-nums ${isWordchain ? 'text-accent-blue' : 'text-accent-green'}`}>
                      {formatTime(r.time_seconds)}
                    </span>
                  </div>

                  {/* Best indicator */}
                  {r.time_seconds <= (stats?.bestTime || Infinity) && (
                    <span className="text-xs font-display font-semibold text-accent-yellow bg-yellow-50 px-2 py-0.5 rounded-full">
                      Best!
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
