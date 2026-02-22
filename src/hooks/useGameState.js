import { useState, useCallback } from 'react';

const SCREENS = {
  SPLASH: 'splash',
  PROFILE_SELECT: 'profile_select',
  CREATE_PROFILE: 'create_profile',
  PIN_ENTRY: 'pin_entry',
  GAME: 'game',
  RESULTS: 'results',
  HISTORY: 'history',
};

export { SCREENS };

export function useGameState() {
  const [screen, setScreen] = useState(SCREENS.SPLASH);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [currentPuzzle, setCurrentPuzzle] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [selectedProfileForPin, setSelectedProfileForPin] = useState(null);

  const goToSplash = useCallback(() => setScreen(SCREENS.SPLASH), []);
  const goToProfileSelect = useCallback(() => setScreen(SCREENS.PROFILE_SELECT), []);
  const goToCreateProfile = useCallback(() => setScreen(SCREENS.CREATE_PROFILE), []);
  const goToGame = useCallback(() => setScreen(SCREENS.GAME), []);
  const goToResults = useCallback(() => setScreen(SCREENS.RESULTS), []);
  const goToHistory = useCallback(() => setScreen(SCREENS.HISTORY), []);

  const goToPinEntry = useCallback((profile) => {
    setSelectedProfileForPin(profile);
    setScreen(SCREENS.PIN_ENTRY);
  }, []);

  const loginProfile = useCallback(
    (profile) => {
      setCurrentProfile(profile);
      setScreen(SCREENS.GAME);
    },
    []
  );

  const logout = useCallback(() => {
    setCurrentProfile(null);
    setCurrentPuzzle(null);
    setLastResult(null);
    setScreen(SCREENS.PROFILE_SELECT);
  }, []);

  return {
    screen,
    currentProfile,
    currentPuzzle,
    lastResult,
    selectedProfileForPin,
    setCurrentPuzzle,
    setLastResult,
    goToSplash,
    goToProfileSelect,
    goToCreateProfile,
    goToPinEntry,
    goToGame,
    goToResults,
    goToHistory,
    loginProfile,
    logout,
  };
}
