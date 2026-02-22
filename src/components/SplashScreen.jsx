import React from 'react';

export default function SplashScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-fade-in">
      {/* Logo */}
      <div className="animate-bounce-in">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center shadow-lg">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <path
              d="M12 20C12 17.79 13.79 16 16 16H24C26.21 16 28 17.79 28 20V24C28 26.21 26.21 28 24 28H16C13.79 28 12 26.21 12 24V20Z"
              fill="white"
              opacity="0.9"
            />
            <path
              d="M28 28C28 25.79 29.79 24 32 24H40C42.21 24 44 25.79 44 28V32C44 34.21 42.21 36 40 36H32C29.79 36 28 34.21 28 32V28Z"
              fill="white"
              opacity="0.7"
            />
            <path
              d="M20 36C20 33.79 21.79 32 24 32H32C34.21 32 36 33.79 36 36V40C36 42.21 34.21 44 32 44H24C21.79 44 20 42.21 20 40V36Z"
              fill="white"
              opacity="0.5"
            />
            {/* Chain links */}
            <circle cx="28" cy="26" r="3" fill="white" />
            <circle cx="28" cy="32" r="3" fill="white" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <div className="text-center" style={{ animationDelay: '0.2s' }}>
        <h1 className="font-display text-4xl font-bold text-snow-800 tracking-tight">
          WordChain
        </h1>
        <p className="mt-2 text-snow-500 font-medium text-sm">
          Link words together!
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
