import { useState } from 'react';
import Roulette from './components/games/Roulette/Roulette';
import GhostLeg from './components/games/GhostLeg/GhostLeg';
import DrawingLots from './components/games/DrawingLots/DrawingLots';
import Bomb from './components/games/Bomb/Bomb';
import styles from './App.module.css';

import rouletteThumb from './assets/thumbnails/roulette.png';
import ghostlegThumb from './assets/thumbnails/ghostleg.png';
import drawingThumb from './assets/thumbnails/drawing.png';
import bombThumb from './assets/thumbnails/bomb.png';

type GameId = 'roulette' | 'ghostleg' | 'drawing' | 'bomb';

interface GameInfo {
  id: GameId;
  name: string;
  description: string;
  thumbnail: string;
}

const GAMES: GameInfo[] = [
  { id: 'roulette', name: '돌림판',    description: '확률 기반 회전 돌림판',            thumbnail: rouletteThumb },
  { id: 'ghostleg', name: '사다리 타기', description: '운명의 길을 따라가는 사다리 게임',   thumbnail: ghostlegThumb },
  { id: 'drawing',  name: '제비 뽑기',  description: '간단하고 공정한 무작위 아이템 뽑기', thumbnail: drawingThumb },
  { id: 'bomb',     name: '폭탄 돌리기', description: '보이지 않는 타이머, 숨막히는 긴장감', thumbnail: bombThumb },
];

const GAME_COMPONENTS: Record<GameId, React.ComponentType> = {
  roulette: Roulette,
  ghostleg: GhostLeg,
  drawing:  DrawingLots,
  bomb:     Bomb,
};

export default function App() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  if (activeGame) {
    const game = GAMES.find(g => g.id === activeGame)!;
    const GameComponent = GAME_COMPONENTS[activeGame];

    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header className="glass-panel animate-fade-in" style={{
          margin: '1rem',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderRadius: '16px',
        }}>
          <h2 style={{ fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src={game.thumbnail}
              alt={game.name}
              style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'contain' }}
            />
            {game.name}
          </h2>
          <button
            className="btn-primary"
            style={{ padding: '8px 20px', fontSize: '1rem' }}
            onClick={() => setActiveGame(null)}
          >
            ← 메인으로
          </button>
        </header>

        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <GameComponent />
        </main>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <header className="animate-fade-in" style={{ textAlign: 'center', padding: '3rem 0 4rem' }}>
        <h1 style={{
          fontSize: '4.5rem',
          fontWeight: 800,
          background: 'linear-gradient(to right, var(--accent-primary), var(--accent-tertiary))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '1rem',
          letterSpacing: '-1px',
        }}>
          나만 아니면 돼
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', fontWeight: 500 }}>
          모임의 재미를 더해줄 4가지 프리미엄 미니게임
        </p>
      </header>

      <main style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '2rem',
        padding: '1rem 0 4rem',
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        {GAMES.map((game, index) => (
          <div
            key={game.id}
            role="button"
            tabIndex={0}
            className={`glass-panel animate-fade-in ${styles.gameCard}`}
            style={{ animationDelay: `${index * 0.15}s` }}
            onClick={() => setActiveGame(game.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveGame(game.id); }}
          >
            <div style={{
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'center',
              height: '120px',
              alignItems: 'center',
            }}>
              <img
                src={game.thumbnail}
                alt={game.name}
                style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: '12px' }}
              />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>{game.name}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem', minHeight: '44px' }}>
              {game.description}
            </p>
            <button className="btn-primary" style={{ width: '100%' }} tabIndex={-1}>게임 시작</button>
          </div>
        ))}
      </main>
    </div>
  );
}
