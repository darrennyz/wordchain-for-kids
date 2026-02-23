import React, { useState, useEffect } from 'react';
import { getWeeklyLeaderboard } from '../lib/supabase';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function WeeklyLeaderboard({ onBack }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [weekLabel, setWeekLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
    try {
      const { leaderboard: data, weekLabel: label } = await getWeeklyLeaderboard();
      setLeaderboard(data);
      setWeekLabel(label);
    } catch (err) {
      console.error('Failed to load weekly leaderboard:', err);
      setError('Could not load the leaderboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col px-6 py-6 animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-snow-100 flex items-center justify-center hover:bg-snow-200 active:scale-95 transition-all flex-shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-snow-500">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="font-display text-xl font-bold text-snow-800">
            Weekly Leaderboard
          </h1>
          {weekLabel && (
            <p className="text-snow-400 text-xs font-medium">{weekLabel}</p>
          )}
        </div>
        <span className="text-2xl">🏆</span>
      </div>

      <p className="text-snow-400 text-xs mb-4 text-center">
        Ranked by average time &middot; Resets every Monday
      </p>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-snow-200 border-t-accent-blue rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-snow-500 text-sm text-center">{error}</p>
            <button
              onClick={loadLeaderboard}
              className="px-5 py-2 bg-accent-blue text-white font-display font-semibold text-sm rounded-xl"
            >
              Try Again
            </button>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-4xl">📭</span>
            <p className="text-snow-500 text-sm text-center">
              No games played this week yet.
            </p>
            <p className="text-snow-400 text-xs text-center">
              Complete a puzzle to appear on the leaderboard!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, i) => (
              <div
                key={entry.profile_id}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                  i === 0
                    ? 'bg-yellow-50 shadow-card'
                    : i === 1
                      ? 'bg-snow-50 shadow-card'
                      : i === 2
                        ? 'bg-orange-50/50 shadow-card'
                        : 'bg-white'
                }`}
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                {/* Rank */}
                <span className="font-display font-bold text-sm w-7 text-center flex-shrink-0">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                </span>

                {/* Avatar */}
                <span className="text-xl flex-shrink-0">{entry.avatar_emoji}</span>

                {/* Name + games played */}
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-sm text-snow-700 truncate">
                    {entry.name}
                  </p>
                  <p className="text-snow-400 text-xs">
                    {entry.gamesPlayed} {entry.gamesPlayed === 1 ? 'game' : 'games'}
                  </p>
                </div>

                {/* Average time */}
                <div className="text-right flex-shrink-0">
                  <p className="font-display font-bold text-sm text-snow-600 tabular-nums">
                    {formatTime(entry.avgTime)}
                  </p>
                  <p className="text-snow-400 text-xs">avg</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom button */}
      <div className="pt-4">
        <button
          onClick={onBack}
          className="w-full py-3 bg-accent-blue text-white font-display font-semibold text-sm rounded-xl hover:bg-blue-600 active:scale-[0.98] transition-all"
        >
          Back to Players
        </button>
      </div>
    </div>
  );
}
