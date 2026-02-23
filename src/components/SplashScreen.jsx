import React from 'react';

export default function SplashScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-fade-in">
      {/* Logo */}
      <div className="animate-bounce-in">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center shadow-lg">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            {/* Brain/lightbulb shape */}
            <path
              d="M28 10C20.27 10 14 16.27 14 24C14 28.4 16.1 32.3 19.3 34.8C19.7 35.1 20 35.6 20 36.1V38C20 39.1 20.9 40 22 40H34C35.1 40 36 39.1 36 38V36.1C36 35.6 36.3 35.1 36.7 34.8C39.9 32.3 42 28.4 42 24C42 16.27 35.73 10 28 10Z"
              fill="white"
              opacity="0.85"
            />
            {/* Lightbulb base */}
            <rect x="22" y="42" width="12" height="2" rx="1" fill="white" opacity="0.6" />
            <rect x="24" y="46" width="8" height="2" rx="1" fill="white" opacity="0.4" />
            {/* Sparkle dots */}
            <circle cx="18" cy="14" r="1.5" fill="white" opacity="0.5" />
            <circle cx="38" cy="14" r="1.5" fill="white" opacity="0.5" />
            <circle cx="10" cy="24" r="1.5" fill="white" opacity="0.4" />
            <circle cx="46" cy="24" r="1.5" fill="white" opacity="0.4" />
            {/* Gear/puzzle accent inside bulb */}
            <circle cx="28" cy="24" r="5" fill="none" stroke="white" strokeWidth="1.5" opacity="0.5" />
            <circle cx="28" cy="24" r="2" fill="white" opacity="0.6" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <div className="text-center" style={{ animationDelay: '0.2s' }}>
        <h1 className="font-display text-4xl font-bold text-snow-800 tracking-tight">
          ThinkIn Kids
        </h1>
        <p className="mt-2 text-snow-500 font-medium text-sm">
          Daily Brain Teaser for Kids
        </p>
      </div>

      {/* Loading dots */}
      <div className="flex gap-1.5 mt-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-accent-blue"
            style={{
              animation: 'pulse 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
