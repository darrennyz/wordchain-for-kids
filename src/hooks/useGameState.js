import { useState, useCallback } from 'react';

const SCREENS = {
  SPLASH: 'splash',
  PROFILE_SELECT: 'profile_select',
  CREATE_PROFILE: 'create_profile',
  PIN_ENTRY: 'pin_entry',
  GAME_MENU: 'game_menu',
  GAME: 'game',
  RESULTS: 'results',
  HISTORY: 'history',
  WEEKLY_LEADERBOARD: 'weekly_leaderboard',
};

export { SCREENS };

export function useGameState() {
  const [screen, setScreen] = useState(SCREENS.SPLASH);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [currentPuzzle, setCurrentPuzzle] = useState(null);
  const [currentSudokuPuzzle, setCurrentSudokuPuzzle] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null); // 'wordchain' | 'sudoku'
  const [lastResult, setLastResult] = useState(null);
  const [selectedProfileForPin, setSelectedProfileForPin] = useState(null);
  // Persisted mid-game timer state — survives navigating back to the game menu
  // Shape: { puzzleDate, elapsedSeconds, chain, availableWords } | null  (wordchain)
  //        { puzzleDate, elapsedSeconds, grid }                  | null  (sudoku)
  const [wordchainTimerState, setWordchainTimerState] = useState(null);
  const [sudokuTimerState, setSudokuTimerState] = useState(null);

  const goToSplash = useCallback(() => setScreen(SCREENS.SPLASH), []);
  const goToProfileSelect = useCallback(() => setScreen(SCREENS.PROFILE_SELECT), []);
  const goToCreateProfile = useCallback(() => setScreen(SCREENS.CREATE_PROFILE), []);
  const goToGameMenu = useCallback(() => setScreen(SCREENS.GAME_MENU), []);
  const goToGame = useCallback(() => setScreen(SCREENS.GAME), []);
  const goToResults = useCallback(() => setScreen(SCREENS.RESULTS), []);
  const goToHistory = useCallback(() => setScreen(SCREENS.HISTORY), []);
  const goToWeeklyLeaderboard = useCallback(() => setScreen(SCREENS.WEEKLY_LEADERBOARD), []);

  const goToPinEntry = useCallback((profile) => {
    setSelectedProfileForPin(profile);
    setScreen(SCREENS.PIN_ENTRY);
  }, []);

  const loginProfile = useCallback((profile) => {
    setCurrentProfile(profile);
    setScreen(SCREENS.GAME_MENU);
  }, []);

  const selectGame = useCallback((gameType) => {
    setSelectedGame(gameType);
    setScreen(SCREENS.GAME);
  }, []);

  const logout = useCallback(() => {
    setCurrentProfile(null);
    setCurrentPuzzle(null);
    setCurrentSudokuPuzzle(null);
    setSelectedGame(null);
    setLastResult(null);
    setWordchainTimerState(null);
    setSudokuTimerState(null);
    setScreen(SCREENS.PROFILE_SELECT);
  }, []);

  return {
    screen,
    currentProfile,
    currentPuzzle,
    currentSudokuPuzzle,
    selectedGame,
    lastResult,
    selectedProfileForPin,
    wordchainTimerState,
    setWordchainTimerState,
    sudokuTimerState,
    setSudokuTimerState,
    setCurrentPuzzle,
    setCurrentSudokuPuzzle,
    setLastResult,
    goToSplash,
    goToProfileSelect,
    goToCreateProfile,
    goToPinEntry,
    goToGameMenu,
    goToGame,
    goToResults,
    goToHistory,
    goToWeeklyLeaderboard,
    loginProfile,
    selectGame,
    logout,
  };
}
