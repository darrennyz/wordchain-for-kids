import React, { useState, useRef } from 'react';
import { createProfile } from '../lib/supabase';

const AVATARS = ['😊', '🦊', '🐱', '🐶', '🦁', '🐸', '🐼', '🦄', '🐨', '🐯', '🦋', '🌟', '🚀', '🎨', '🎵', '🌈'];

export default function CreateProfile({ onCreated, onBack }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('😊');
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [step, setStep] = useState(1); // 1: name+avatar, 2: pin, 3: confirm pin
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pinRefs = useRef([]);
  const confirmPinRefs = useRef([]);

  function handlePinChange(index, value, isPinConfirm = false) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const setter = isPinConfirm ? setConfirmPin : setPin;
    const refs = isPinConfirm ? confirmPinRefs : pinRefs;

    setter((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });

    if (digit && index < 3) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePinKeyDown(e, index, isPinConfirm = false) {
    const refs = isPinConfirm ? confirmPinRefs : pinRefs;
    const current = isPinConfirm ? confirmPin : pin;

    if (e.key === 'Backspace' && !current[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  async function handleSubmit() {
    if (step === 1) {
      if (!name.trim()) {
        setError('Please enter a name');
        return;
      }
      setError('');
      setStep(2);
      setTimeout(() => pinRefs.current[0]?.focus(), 100);
      return;
    }

    if (step === 2) {
      if (pin.some((d) => !d)) {
        setError('Please enter all 4 digits');
        return;
      }
      setError('');
      setStep(3);
      setTimeout(() => confirmPinRefs.current[0]?.focus(), 100);
      return;
    }

    if (step === 3) {
      if (confirmPin.some((d) => !d)) {
        setError('Please enter all 4 digits');
        return;
      }
      if (pin.join('') !== confirmPin.join('')) {
        setError('PINs don\'t match. Try again!');
        setConfirmPin(['', '', '', '']);
        setTimeout(() => confirmPinRefs.current[0]?.focus(), 100);
        return;
      }

      setSaving(true);
      try {
        const profile = await createProfile(name.trim(), avatar, pin.join(''));
        onCreated(profile);
      } catch (err) {
        setError('Oops! Something went wrong. Try again.');
        setSaving(false);
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col px-6 py-8 animate-fade-in">
      {/* Back button */}
      <button
        onClick={onBack}
        className="self-start flex items-center gap-1.5 text-snow-500 hover:text-snow-700 transition-colors mb-6"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span className="text-sm font-medium">Back</span>
      </button>

      {/* Step 1: Name + Avatar */}
      {step === 1 && (
        <div className="flex-1 flex flex-col animate-fade-in">
          <h2 className="font-display text-2xl font-bold text-snow-800 text-center mb-8">
            Create your player
          </h2>

          {/* Avatar selector */}
          <div className="mb-6">
            <p className="text-sm font-medium text-snow-600 mb-3 text-center">
              Pick your avatar
            </p>
            <div className="grid grid-cols-8 gap-2">
              {AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setAvatar(emoji)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all duration-150 ${
                    avatar === emoji
                      ? 'bg-accent-blue/10 ring-2 ring-accent-blue scale-110'
                      : 'bg-white hover:bg-snow-100'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-snow-600 mb-2">
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Enter your name..."
              maxLength={20}
              autoFocus
              className="w-full px-4 py-3 bg-white border-2 border-snow-200 rounded-xl text-snow-800 font-display font-semibold text-lg placeholder:text-snow-300 focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/15 transition-all"
            />
          </div>
        </div>
      )}

      {/* Step 2: Create PIN */}
      {step === 2 && (
        <div className="flex-1 flex flex-col items-center animate-fade-in">
          <div className="text-5xl mb-4">{avatar}</div>
          <h2 className="font-display text-xl font-bold text-snow-800 mb-2">
            Hi, {name}!
          </h2>
          <p className="text-snow-500 text-sm mb-8 text-center">
            Create a 4-digit PIN to keep your progress safe
          </p>

          <div className="flex gap-3 mb-4">
            {pin.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (pinRefs.current[i] = el)}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit ? '●' : ''}
                onChange={(e) => handlePinChange(i, e.target.value)}
                onKeyDown={(e) => handlePinKeyDown(e, i)}
                className={`pin-input ${digit ? 'filled' : ''}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Confirm PIN */}
      {step === 3 && (
        <div className="flex-1 flex flex-col items-center animate-fade-in">
          <div className="text-5xl mb-4">{avatar}</div>
          <h2 className="font-display text-xl font-bold text-snow-800 mb-2">
            Confirm your PIN
          </h2>
          <p className="text-snow-500 text-sm mb-8 text-center">
            Enter the same 4 digits again
          </p>

          <div className="flex gap-3 mb-4">
            {confirmPin.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (confirmPinRefs.current[i] = el)}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit ? '●' : ''}
                onChange={(e) => handlePinChange(i, e.target.value, true)}
                onKeyDown={(e) => handlePinKeyDown(e, i, true)}
                className={`pin-input ${digit ? 'filled' : ''}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center text-accent-red text-sm font-medium mb-4 animate-shake">
          {error}
        </div>
      )}

      {/* Continue button */}
      <button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full py-3.5 bg-accent-blue text-white font-display font-semibold text-base rounded-xl shadow-md hover:bg-blue-600 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Creating...' : step === 3 ? 'Start Playing!' : 'Continue'}
      </button>
    </div>
  );
}
