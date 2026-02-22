import React, { useState, useEffect } from 'react';
import { getProfileResults, getProfileStats } from '../lib/supabase';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function History({ profile, onBack, onLogout }) {
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const [res, st] = await Promise.all([
        getProfileResults(profile.id),
        getProfileStats(profile.id),
      ]);
      setResults(res);
      setStats(st);
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
              const date = r.puzzles
                ? new Date(r.puzzles.puzzle_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                : new Date(r.completed_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
              const puzzleNum = r.puzzles?.puzzle_number;

              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-card"
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
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
                    <span className="font-display font-bold text-lg text-accent-blue tabular-nums">
                      {formatTime(r.time_seconds)}
                    </span>
                  </div>

                  {/* Rank indicator */}
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
