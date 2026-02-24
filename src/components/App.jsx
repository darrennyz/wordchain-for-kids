import React, { useEffect } from 'react';
import { useGameState, SCREENS } from '../hooks/useGameState';
import SplashScreen from './SplashScreen';
import ProfileSelect from './ProfileSelect';
import CreateProfile from './CreateProfile';
import PinEntry from './PinEntry';
import GameMenu from './GameMenu';
import GameBoard from './GameBoard';
import SudokuBoard from './SudokuBoard';
import PackingBoard from './PackingBoard';
import Results from './Results';
import History from './History';
import WeeklyLeaderboard from './WeeklyLeaderboard';

export default function App() {
  const state = useGameState();

  // Auto-advance from splash after 2 seconds
  useEffect(() => {
    if (state.screen === SCREENS.SPLASH) {
      const timer = setTimeout(() => state.goToProfileSelect(), 2000);
      return () => clearTimeout(timer);
    }
  }, [state.screen]);

  const renderScreen = () => {
    switch (state.screen) {
      case SCREENS.SPLASH:
        return <SplashScreen />;
      case SCREENS.PROFILE_SELECT:
        return (
          <ProfileSelect
            onSelectProfile={state.goToPinEntry}
            onCreateNew={state.goToCreateProfile}
            onViewLeaderboard={state.goToWeeklyLeaderboard}
          />
        );
      case SCREENS.CREATE_PROFILE:
        return (
          <CreateProfile
            onCreated={(profile) => state.loginProfile(profile)}
            onBack={state.goToProfileSelect}
          />
        );
      case SCREENS.PIN_ENTRY:
        return (
          <PinEntry
            profile={state.selectedProfileForPin}
            onSuccess={() => state.loginProfile(state.selectedProfileForPin)}
            onBack={state.goToProfileSelect}
          />
        );
      case SCREENS.GAME_MENU:
        return (
          <GameMenu
            profile={state.currentProfile}
            onSelectGame={state.selectGame}
            onHistory={state.goToHistory}
            onLogout={state.logout}
            onViewLeaderboard={state.goToWeeklyLeaderboard}
          />
        );
      case SCREENS.GAME:
        if (state.selectedGame === 'sudoku') {
          return (
            <SudokuBoard
              profile={state.currentProfile}
              puzzle={state.currentSudokuPuzzle}
              setPuzzle={state.setCurrentSudokuPuzzle}
              timerState={state.sudokuTimerState}
              setTimerState={state.setSudokuTimerState}
              onComplete={(result) => {
                state.setSudokuTimerState(null);
                state.setLastResult(result);
                state.goToResults();
              }}
              onLogout={state.logout}
              onBack={state.goToGameMenu}
            />
          );
        }
        if (state.selectedGame === 'packing') {
          return (
            <PackingBoard
              profile={state.currentProfile}
              puzzle={state.currentPackingPuzzle}
              setPuzzle={state.setCurrentPackingPuzzle}
              timerState={state.packingTimerState}
              setTimerState={state.setPackingTimerState}
              onComplete={(result) => {
                state.setPackingTimerState(null);
                state.setLastResult(result);
                state.goToResults();
              }}
              onLogout={state.logout}
              onBack={state.goToGameMenu}
            />
          );
        }
        return (
          <GameBoard
            profile={state.currentProfile}
            puzzle={state.currentPuzzle}
            setPuzzle={state.setCurrentPuzzle}
            timerState={state.wordchainTimerState}
            setTimerState={state.setWordchainTimerState}
            onComplete={(result) => {
              state.setWordchainTimerState(null);
              state.setLastResult(result);
              state.goToResults();
            }}
            onLogout={state.logout}
            onBack={state.goToGameMenu}
          />
        );
      case SCREENS.RESULTS:
        return (
          <Results
            profile={state.currentProfile}
            result={state.lastResult}
            puzzle={
              state.selectedGame === 'sudoku' ? state.currentSudokuPuzzle
              : state.selectedGame === 'packing' ? state.currentPackingPuzzle
              : state.currentPuzzle
            }
            gameType={state.selectedGame}
            onHistory={state.goToHistory}
            onBack={state.goToGameMenu}
          />
        );
      case SCREENS.HISTORY:
        return (
          <History
            profile={state.currentProfile}
            onBack={state.goToGameMenu}
            onLogout={state.logout}
          />
        );
      case SCREENS.WEEKLY_LEADERBOARD:
        return (
          <WeeklyLeaderboard
            onBack={state.currentProfile ? state.goToGameMenu : state.goToProfileSelect}
          />
        );
      default:
        return <SplashScreen />;
    }
  };

  return (
    <div className="h-full w-full bg-snow-50 flex flex-col items-center justify-center overflow-hidden">
      <div className="w-full max-w-md h-full flex flex-col">
        {renderScreen()}
      </div>
    </div>
  );
}
