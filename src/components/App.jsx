import React, { useEffect } from 'react';
import { useGameState, SCREENS } from '../hooks/useGameState';
import SplashScreen from './SplashScreen';
import ProfileSelect from './ProfileSelect';
import CreateProfile from './CreateProfile';
import PinEntry from './PinEntry';
import GameBoard from './GameBoard';
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
      case SCREENS.GAME:
        return (
          <GameBoard
            profile={state.currentProfile}
            puzzle={state.currentPuzzle}
            setPuzzle={state.setCurrentPuzzle}
            onComplete={(result) => {
              state.setLastResult(result);
              state.goToResults();
            }}
            onLogout={state.logout}
            onHistory={state.goToHistory}
          />
        );
      case SCREENS.RESULTS:
        return (
          <Results
            profile={state.currentProfile}
            result={state.lastResult}
            puzzle={state.currentPuzzle}
            onPlayAgain={state.goToGame}
            onHistory={state.goToHistory}
            onLogout={state.logout}
          />
        );
      case SCREENS.HISTORY:
        return (
          <History
            profile={state.currentProfile}
            onBack={state.goToGame}
            onLogout={state.logout}
          />
        );
      case SCREENS.WEEKLY_LEADERBOARD:
        return (
          <WeeklyLeaderboard
            onBack={state.goToProfileSelect}
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
