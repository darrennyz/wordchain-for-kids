import React, { useState, useEffect } from 'react';
import { getProfiles } from '../lib/supabase';

export default function ProfileSelect({ onSelectProfile, onCreateNew, onViewLeaderboard }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    try {
      const data = await getProfiles();
      setProfiles(data);
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col px-6 py-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="font-display text-2xl font-bold text-snow-800">
          Who's playing?
        </h1>
        <p className="mt-1 text-snow-500 text-sm">
          Pick your player or create a new one
        </p>
      </div>

      {/* Weekly Leaderboard button */}
      <button
        onClick={onViewLeaderboard}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 mb-5 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl hover:from-yellow-100 hover:to-orange-100 active:scale-[0.98] transition-all"
      >
        <span className="text-lg">🏆</span>
        <span className="font-display font-semibold text-sm text-yellow-700">Weekly Leaderboard</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500 ml-auto">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Profile grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-snow-200 border-t-accent-blue rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {profiles.map((profile, i) => (
              <button
                key={profile.id}
                onClick={() => onSelectProfile(profile)}
                className="flex flex-col items-center gap-2 p-5 bg-white rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-200 active:scale-[0.97]"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <span className="text-4xl">{profile.avatar_emoji}</span>
                <span className="font-display font-semibold text-snow-700 text-sm truncate w-full text-center">
                  {profile.name}
                </span>
              </button>
            ))}

            {/* Create new profile button */}
            <button
              onClick={onCreateNew}
              className="flex flex-col items-center justify-center gap-2 p-5 bg-white rounded-2xl border-2 border-dashed border-snow-200 hover:border-accent-blue hover:bg-blue-50/30 transition-all duration-200 active:scale-[0.97]"
            >
              <div className="w-12 h-12 rounded-full bg-snow-100 flex items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="text-snow-400"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span className="font-display font-semibold text-snow-400 text-sm">
                New Player
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
