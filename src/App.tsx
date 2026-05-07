import { lazy, Suspense, Component, useEffect, type ReactNode, type ComponentType } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import styles from './App.module.css';

import rouletteThumb from './assets/thumbnails/roulette.png';
import ghostlegThumb from './assets/thumbnails/ghostleg.png';
import drawingThumb  from './assets/thumbnails/drawing.png';
import bombThumb     from './assets/thumbnails/bomb.png';

const Roulette      = lazy(() => import('./components/games/Roulette/Roulette'));
const GhostLeg      = lazy(() => import('./components/games/GhostLeg/GhostLeg'));
const DrawingLots   = lazy(() => import('./components/games/DrawingLots/DrawingLots'));
const Bomb          = lazy(() => import('./components/games/Bomb/Bomb'));
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy'));

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
      <header className={`glass-panel animate-fade-in ${styles.gameHeader}`}>
        <h2 className={styles.gameHeaderTitle}>
          <img
            src={game.thumbnail}
            alt={game.name}
            className={styles.gameHeaderThumb}
          />
          {game.name}
        </h2>
        <button
          className={`btn-primary ${styles.gameHeaderBtn}`}
          onClick={() => navigate('/')}
        >
          ← 메인으로
        </button>
      </header>

      <main className={styles.gameMain}>
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
    <div style={{ padding: '1.25rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <header className={`animate-fade-in ${styles.mainHeader}`}>
        <h1 className={styles.mainTitle} style={{
          background: 'linear-gradient(to right, var(--accent-primary), var(--accent-tertiary))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Pickaroo
        </h1>
      </header>

      <main className={styles.gameGrid}>
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

      <footer style={{ textAlign: 'center', padding: '1.5rem 0 3rem', fontSize: '0.9rem' }}>
        <a href="/privacy" style={{ color: 'var(--accent-secondary)', textDecoration: 'underline', fontWeight: 600 }}
          onClick={e => { e.preventDefault(); navigate('/privacy'); }}>
          개인정보처리방침
        </a>
        <span style={{ margin: '0 0.75rem', color: 'var(--text-secondary)', opacity: 0.5 }}>·</span>
        <span style={{ color: 'var(--text-secondary)' }}>© 2026 Pickaroo</span>
      </footer>
    </div>
  );
}

// ── 앱 루트 ──────────────────────────────────────────────────────────────────

const PAGE_META: Record<string, { title: string; description: string; keywords?: string }> = {
  '/': {
    title: 'Pickaroo — 돌림판 · 사다리 타기 · 제비 뽑기 · 폭탄 돌리기',
    description: '점심 메뉴, 당번, 벌칙을 재미있게 결정하세요. 돌림판·사다리 타기·제비 뽑기·폭탄 돌리기 — 모임을 위한 무료 미니게임 모음',
  },
  '/roulette': {
    title: '돌림판 | Pickaroo — 무료 온라인 돌림판',
    description: '점심 메뉴, 벌칙, 당번을 공정하게 결정하는 무료 온라인 돌림판. 최대 20항목 설정 가능. 확률 조정 기능 지원.',
    keywords: '돌림판, 온라인 돌림판, 무료 돌림판, 랜덤 뽑기, 점심 메뉴 뽑기',
  },
  '/ghostleg': {
    title: '사다리 타기 | Pickaroo — 무료 온라인 사다리 게임',
    description: '운명의 사다리를 타고 결과를 확인하세요. 최대 8명 멀티플레이 지원. 무료 온라인 사다리 타기 게임.',
    keywords: '사다리 타기, 온라인 사다리, 무료 사다리 타기, 사다리 게임',
  },
  '/drawing': {
    title: '제비 뽑기 | Pickaroo — 무료 온라인 제비뽑기',
    description: '간단하고 공정한 무작위 제비 뽑기. 최대 100항목 설정 가능. 당번 정하기, 벌칙 정하기에 딱.',
    keywords: '제비 뽑기, 온라인 제비뽑기, 무료 뽑기, 랜덤 선택',
  },
  '/bomb': {
    title: '폭탄 돌리기 | Pickaroo — 무료 온라인 폭탄 게임',
    description: '보이지 않는 타이머로 긴장감 넘치는 폭탄 돌리기. 최대 8명 멀티플레이 지원. 모임 분위기를 살려줄 무료 미니게임.',
    keywords: '폭탄 돌리기, 폭탄 게임, 온라인 폭탄, 모임 게임',
  },
};

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
  el.content = content;
}

function setOgMeta(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el); }
  el.content = content;
}

function MetaTags() {
  const location = useLocation();
  useEffect(() => {
    const pathname = location.pathname.split('?')[0];
    const meta = PAGE_META[pathname] ?? PAGE_META['/'];
    document.title = meta.title;
    setMeta('description', meta.description);
    if (meta.keywords) setMeta('keywords', meta.keywords);
    setOgMeta('og:title', meta.title);
    setOgMeta('og:description', meta.description);
    setOgMeta('og:url', `https://pickaroo.xyz${pathname}`);
    setMeta('twitter:title', meta.title);
    setMeta('twitter:description', meta.description);
  }, [location]);
  return null;
}

function Analytics() {
  const location = useLocation();
  useEffect(() => {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
    });
  }, [location]);
  return null;
}

declare global {
  interface Window { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[]; }
}

export default function App() {
  return (
    <>
    <MetaTags />
    <Analytics />
    <Routes>
      <Route path="/"         element={<MainPage />} />
      <Route path="/privacy"  element={<Suspense fallback={null}><PrivacyPolicy /></Suspense>} />
      <Route path="/:gameId"  element={<GamePage />} />
      <Route path="*"         element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
