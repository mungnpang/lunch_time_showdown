import { useState } from 'react';
import Roulette from './components/games/Roulette/Roulette';
import GhostLeg from './components/games/GhostLeg/GhostLeg';
import DrawingLots from './components/games/DrawingLots/DrawingLots';
import Bomb from './components/games/Bomb/Bomb';

// 이미지 임포트
import rouletteThumb from './assets/thumbnails/roulette.png';
import ghostlegThumb from './assets/thumbnails/ghostleg.png';
import drawingThumb from './assets/thumbnails/drawing.png';
import bombThumb from './assets/thumbnails/bomb.png';

type GameId = 'roulette' | 'ghostleg' | 'drawing' | 'bomb';

interface GameInfo {
  id: GameId;
  name: string;
  description: string;
  icon: React.ReactNode;
  thumbnail: string;
}

const GAMES: GameInfo[] = [
  {
    id: 'roulette',
    name: '돌림판',
    description: '확률 기반 회전 돌림판',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v10l5.5 5.5"></path><path d="M12 12L2 12"></path></svg>,
    thumbnail: rouletteThumb
  },
  {
    id: 'ghostleg',
    name: '사다리 타기',
    description: '운명의 길을 따라가는 사다리 게임',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3v18"></path><path d="M17 3v18"></path><path d="M7 8h10"></path><path d="M7 16h10"></path></svg>,
    thumbnail: ghostlegThumb
  },
  {
    id: 'drawing',
    name: '제비 뽑기',
    description: '간단하고 공정한 무작위 아이템 뽑기',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 12h18"></path><path d="M12 4v16"></path></svg>,
    thumbnail: drawingThumb
  },
  {
    id: 'bomb',
    name: '폭탄 돌리기',
    description: '보이지 않는 타이머, 숨막히는 긴장감',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11.5" cy="12.5" r="5.5"></circle><path d="m15.5 8.5 1.5-1.5"></path><path d="M19 6c-1-1-2.5-1.5-3.5-1.5"></path><path d="m20.5 3.5-1 1"></path></svg>,
    thumbnail: bombThumb
  },
];

export default function App() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  if (activeGame) {
    const game = GAMES.find(g => g.id === activeGame);
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header className="glass-panel animate-fade-in" style={{
          margin: '1rem',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderRadius: '16px'
        }}>
          <h2 style={{ fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src={game?.thumbnail}
              alt={game?.name}
              style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'contain' }}
            />
            {game?.name}
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
          {activeGame === 'roulette' ? (
            <Roulette />
          ) : activeGame === 'ghostleg' ? (
            <GhostLeg />
          ) : activeGame === 'drawing' ? (
            <DrawingLots />
          ) : activeGame === 'bomb' ? (
            <Bomb />
          ) : (
            <div className="glass-panel animate-fade-in" style={{ padding: '4rem', textAlign: 'center', animationDelay: '0.1s' }}>
              <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>{game?.icon}</h1>
              <h2 style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>{game?.name} 기능 구현 예정입니다.</h2>
            </div>
          )}
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
          letterSpacing: '-1px'
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
        margin: '0 auto'
      }}>
        {GAMES.map((game, index) => (
          <div
            key={game.id}
            className="glass-panel animate-fade-in"
            style={{
              padding: '2.5rem 2rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              animationDelay: `${index * 0.15}s`,
              transform: 'translateY(0)',
              overflow: 'hidden'
            }}
            onClick={() => setActiveGame(game.id)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-12px)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(100,100,111,0.2)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--glass-shadow)';
              e.currentTarget.style.borderColor = 'var(--glass-border)';
            }}
          >
            <div style={{
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'center',
              height: '120px',
              alignItems: 'center'
            }}>
              <img
                src={game.thumbnail}
                alt={game.name}
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  borderRadius: '12px'
                }}
              />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>{game.name}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem', minHeight: '44px' }}>
              {game.description}
            </p>
            <button className="btn-primary" style={{ width: '100%' }}>게임 시작</button>
          </div>
        ))}
      </main>
    </div>
  );
}
