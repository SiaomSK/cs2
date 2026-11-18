import { useCallback, useEffect, useRef, useState } from 'react';
import { BuyMenu } from './components/BuyMenu';
import { GameHUD } from './components/GameHUD';
import { GameOverModal } from './components/GameOverModal';
import { PauseModal } from './components/PauseModal';
import { Scoreboard } from './components/Scoreboard';
import { TitleScreen } from './components/TitleScreen';
import { tacticalAudio } from './game/audio';
import { CS2Engine } from './game/engine';
import type { Difficulty, GameMode, HudSnapshot, QualityPreset, Team, WeaponId, WeaponSlot } from './game/types';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CS2Engine | null>(null);

  const [gameMode, setGameMode] = useState<GameMode>(() =>
    new URLSearchParams(window.location.search).get('mode') === 'deathmatch' ? 'deathmatch' : 'defusal'
  );
  const [team, setTeam] = useState<Team>('CT');
  const [difficulty, setDifficulty] = useState<Difficulty>('casual');
  const [quality, setQuality] = useState<QualityPreset>('standard');
  const [sensitivity, setSensitivity] = useState<number>(0.0021);
  const [muted, setMuted] = useState<boolean>(false);
  const [buyOpen, setBuyOpen] = useState<boolean>(false);
  const [scoreboardOpen, setScoreboardOpen] = useState<boolean>(false);
  const [webglError, setWebglError] = useState<boolean>(false);
  const [hud, setHud] = useState<HudSnapshot | null>(null);

  const stateRef = useRef({ gameMode, team, difficulty, quality, buyOpen, gamePhase: 'title' as string });
  stateRef.current = {
    gameMode,
    team,
    difficulty,
    quality,
    buyOpen,
    gamePhase: hud?.gamePhase ?? 'title',
  };

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    let engine: CS2Engine | null = null;
    try {
      engine = new CS2Engine(container, (snap) => {
        setHud(snap);
      });
      engineRef.current = engine;
      setQuality(engine ? (new URLSearchParams(window.location.search).get('quality') as QualityPreset) || 'standard' : 'standard');

      const params = new URLSearchParams(window.location.search);
      const urlMode: GameMode = params.get('mode') === 'deathmatch' ? 'deathmatch' : 'defusal';
      if (params.get('autostart') === '1') {
        engine.startMatch(stateRef.current.team, stateRef.current.difficulty, 'potato', urlMode);
      }
    } catch {
      setWebglError(true);
    }

    return () => {
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStartMatch = useCallback(() => {
    setBuyOpen(false);
    setScoreboardOpen(false);
    engineRef.current?.startMatch(team, difficulty, quality, gameMode);
  }, [team, difficulty, quality, gameMode]);

  const handleQualityChange = useCallback((q: QualityPreset) => {
    setQuality(q);
    engineRef.current?.setQuality(q);
  }, []);

  const handleSensitivityChange = useCallback((val: number) => {
    setSensitivity(val);
    engineRef.current?.setSensitivity(val);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      tacticalAudio.muted = next;
      return next;
    });
  }, []);

  const handleTogglePause = useCallback(() => {
    const phase = stateRef.current.gamePhase;
    if (phase === 'playing') {
      setBuyOpen(false);
      setScoreboardOpen(false);
      engineRef.current?.setPaused(true);
    } else if (phase === 'paused') {
      engineRef.current?.setPaused(false);
    }
  }, []);

  const handleBuyWeapon = useCallback((id: WeaponId) => {
    engineRef.current?.buyWeapon(id);
  }, []);

  const handleBuyArmor = useCallback((withHelmet: boolean) => {
    engineRef.current?.buyArmor(withHelmet);
  }, []);

  const handleSwitchSlot = useCallback((slot: WeaponSlot) => {
    engineRef.current?.switchSlot(slot);
  }, []);

  const handleReturnTitle = useCallback(() => {
    setBuyOpen(false);
    setScoreboardOpen(false);
    engineRef.current?.returnToTitle();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const phase = stateRef.current.gamePhase;
      if (phase === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          engineRef.current?.startMatch(
            stateRef.current.team,
            stateRef.current.difficulty,
            stateRef.current.quality,
            stateRef.current.gameMode
          );
        }
        return;
      }

      if (e.code === 'KeyM') {
        handleToggleMute();
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (stateRef.current.buyOpen) {
          setBuyOpen(false);
          return;
        }
        if (phase === 'playing') {
          engineRef.current?.setPaused(true);
        } else if (phase === 'paused') {
          engineRef.current?.setPaused(false);
        }
        return;
      }

      if (phase === 'playing') {
        if (e.code === 'KeyB') {
          setBuyOpen((prev) => {
            const next = !prev;
            if (next && document.pointerLockElement) {
              document.exitPointerLock?.();
            }
            return next;
          });
        } else if (e.code === 'Tab') {
          e.preventDefault();
          setScoreboardOpen(true);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        setScoreboardOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleToggleMute]);

  const phase = hud?.gamePhase ?? 'title';

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0d1015]">
      {/* Dedicated isolated WebGL canvas mount */}
      <div
        ref={canvasMountRef}
        data-testid="game-viewport"
        className="fixed inset-0 w-full h-full"
      />

      {webglError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1015] p-6 text-center">
          <div className="max-w-md border border-slate-700 bg-[#12161f] p-6">
            <h1 className="font-display text-3xl font-bold text-white">
              WebGL Unavailable
            </h1>
            <p className="text-sm text-slate-300 mt-2">
              Please enable hardware or software WebGL in your browser to render the 3D arena.
            </p>
          </div>
        </div>
      )}

      {!webglError && phase === 'title' && (
        <TitleScreen
          gameMode={gameMode}
          onGameModeChange={setGameMode}
          team={team}
          onTeamChange={setTeam}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          quality={quality}
          onQualityChange={handleQualityChange}
          onStart={handleStartMatch}
        />
      )}

      {!webglError && phase === 'playing' && hud && (
        <GameHUD
          hud={hud}
          muted={muted}
          onToggleMute={handleToggleMute}
          onTogglePause={handleTogglePause}
          onOpenBuy={() => setBuyOpen(true)}
          onSwitchSlot={handleSwitchSlot}
        />
      )}

      {!webglError && phase === 'playing' && buyOpen && hud && (
        <BuyMenu
          hud={hud}
          onBuyWeapon={handleBuyWeapon}
          onBuyArmor={handleBuyArmor}
          onClose={() => setBuyOpen(false)}
        />
      )}

      {!webglError && phase === 'playing' && scoreboardOpen && hud && (
        <Scoreboard hud={hud} />
      )}

      {!webglError && phase === 'paused' && (
        <PauseModal
          quality={hud?.quality ?? quality}
          sensitivity={sensitivity}
          onQualityChange={handleQualityChange}
          onSensitivityChange={handleSensitivityChange}
          onResume={() => engineRef.current?.setPaused(false)}
          onRestart={handleStartMatch}
          onReturnTitle={handleReturnTitle}
        />
      )}

      {!webglError && phase === 'gameover' && hud && (
        <GameOverModal
          hud={hud}
          onPlayAgain={handleStartMatch}
          onReturnTitle={handleReturnTitle}
        />
      )}
    </main>
  );
}
