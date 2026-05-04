import { lazy, Suspense, Component, type ReactNode, type ComponentType } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate, useSearchParams } from 'react-router-dom';
import styles from './App.module.css';

import rouletteThumb from './assets/thumbnails/roulette.png';
import ghostlegThumb from './assets/thumbnails/ghostleg.png';
import drawingThumb  from './assets/thumbnails/drawing.png';
import bombThumb     from './assets/thumbnails/bomb.png';

const Roulette    = lazy(() => import('./components/games/Roulette/Roulette'));
const GhostLeg    = lazy(() => import('./components/games/GhostLeg/GhostLeg'));
const DrawingLots = lazy(() => import('./components/games/DrawingLots/DrawingLots'));
const Bomb        = lazy(() => import('./components/games/Bomb/Bomb'));

type GameId = 'roulette' | 'ghostleg' | 'drawing' | 'bomb';

interface GameInfo {
  id: GameId;
  name: string;
  description: string;
  thumbnail: string;
  minCapacity?: string;
  capacity: string;
}

const GAMES: GameInfo[] = [
  { id: 'roulette', name: '돌림판',     description: '확률 기반 회전 돌림판',             thumbnail: rouletteThumb, minCapacity: '최소 2항목', capacity: '최대 20항목' },
  { id: 'ghostleg', name: '사다리 타기', description: '운명의 길을 따라가는 사다리 게임',   thumbnail: ghostlegThumb, minCapacity: '최소 2명',   capacity: '최대 8명'    },
  { id: 'drawing',  name: '제비 뽑기',  description: '간단하고 공정한 무작위 뽑기',        thumbnail: drawingThumb,  minCapacity: '최소 2항목', capacity: '최대 100항목' },
  { id: 'bomb',     name: '폭탄 돌리기', description: '보이지 않는 타이머, 숨막히는 긴장감', thumbnail: bombThumb,    minCapacity: '최소 2명',   capacity: '최대 8명'    },
];

const GAME_COMPONENTS: Record<GameId, ComponentType> = {
  roulette: Roulette,
  ghostleg: GhostLeg,
  drawing:  DrawingLots,
  bomb:     Bomb,
};

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>게임을 불러오는 중 오류가 발생했습니다.</p>
          <button className="btn-primary" onClick={() => this.setState({ hasError: false })}>
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── 게임 페이지 ──────────────────────────────────────────────────────────────

function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate   = useNavigate();

  const game = GAMES.find(g => g.id === gameId);
  if (!game) return <Navigate to="/" replace />;

  const GameComponent = GAME_COMPONENTS[game.id];

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
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
          onClick={() => navigate('/')}
        >
          ← 메인으로
        </button>
      </header>

      <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <ErrorBoundary key={game.id}>
          <Suspense fallback={
            <div style={{ color: 'var(--text-secondary)', fontSize: '1.25rem' }}>로딩 중...</div>
          }>
            <GameComponent />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────

function MainPage() {
  const navigate              = useNavigate();
  const [searchParams]        = useSearchParams();

  // 구 형식 링크 (?room=XXXX) 대응 → /bomb?room=XXXX 로 리다이렉트
  const roomParam = searchParams.get('room');
  if (roomParam) return <Navigate to={`/bomb?room=${roomParam}`} replace />;

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
          Pickaroo
        </h1>
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
            style={{ animationDelay: `${index * 0.15}s`, display: 'flex', flexDirection: 'column' }}
            onClick={() => navigate(`/${game.id}`)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/${game.id}`); }}
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
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.95rem', flex: 1 }}>
              {game.description}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              {game.minCapacity && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '3px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600,
                  color: 'var(--text-secondary)',
                  background: 'rgba(0,0,0,0.05)',
                  border: '1px solid rgba(0,0,0,0.08)',
                }}>
                  <span>👥</span><span>{game.minCapacity}</span>
                </span>
              )}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                padding: '3px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600,
                color: 'var(--accent-secondary)',
                background: 'rgba(var(--accent-primary-rgb), 0.1)',
                border: '1px solid rgba(var(--accent-primary-rgb), 0.2)',
              }}>
                <span>👥</span><span>{game.capacity}</span>
              </span>
            </div>
            <button className="btn-primary" style={{ width: '100%' }} tabIndex={-1}>게임 시작</button>
          </div>
        ))}
      </main>
    </div>
  );
}

// ── 앱 루트 ──────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <Routes>
      <Route path="/"         element={<MainPage />} />
      <Route path="/:gameId"  element={<GamePage />} />
      <Route path="*"         element={<Navigate to="/" replace />} />
    </Routes>
  );
}
