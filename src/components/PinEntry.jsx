import React, { useState, useRef, useEffect } from 'react';
import { verifyPin } from '../lib/supabase';

export default function PinEntry({ profile, onSuccess, onBack }) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const refs = useRef([]);

  useEffect(() => {
    setTimeout(() => refs.current[0]?.focus(), 100);
  }, []);

  function handleChange(index, value) {
    const digit = value.replace(/\D/g, '').slice(-1);
    setPin((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    setError('');

    if (digit && index < 3) {
      refs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (digit && index === 3) {
      const fullPin = [...pin.slice(0, 3), digit].join('');
      if (fullPin.length === 4) {
        checkPin(fullPin);
      }
    }
  }

  function handleKeyDown(e, index) {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  async function checkPin(pinString) {
    setChecking(true);
    try {
      const valid = await verifyPin(profile.id, pinString);
      if (valid) {
        onSuccess();
      } else {
        setAttempts((a) => a + 1);
        setError(
          attempts >= 2
            ? 'Too many wrong tries. Ask a grown-up for help!'
            : "That's not right. Try again!"
        );
        setPin(['', '', '', '']);
        setTimeout(() => refs.current[0]?.focus(), 100);
      }
    } catch (err) {
      setError('Something went wrong. Try again.');
      setPin(['', '', '', '']);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-8 animate-fade-in">
      {/* Back button */}
      <button
        onClick={onBack}
        className="self-start flex items-center gap-1.5 text-snow-500 hover:text-snow-700 transition-colors mb-12"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span className="text-sm font-medium">Back</span>
      </button>

      {/* Avatar + Name */}
      <div className="text-6xl mb-4 animate-bounce-in">{profile.avatar_emoji}</div>
      <h2 className="font-display text-2xl font-bold text-snow-800 mb-2">
        {profile.name}
      </h2>
      <p className="text-snow-500 text-sm mb-10">Enter your 4-digit PIN</p>

      {/* PIN inputs */}
      <div className="flex gap-3 mb-6">
        {pin.map((digit, i) => (
          <input
            key={i}
            ref={(el) => (refs.current[i] = el)}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit ? '●' : ''}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            disabled={checking}
            className={`pin-input ${digit ? 'filled' : ''} ${error ? 'border-accent-red' : ''}`}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-accent-red text-sm font-medium animate-shake text-center">
          {error}
        </p>
      )}

      {/* Loading state */}
      {checking && (
        <div className="mt-4">
          <div className="w-6 h-6 border-2 border-snow-200 border-t-accent-blue rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
