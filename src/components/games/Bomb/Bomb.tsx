import { useState, useEffect, useRef } from 'react';
import styles from './Bomb.module.css';

type GameState = 'setup' | 'playing' | 'exploded';

export default function Bomb() {
  const [minTime, setMinTime] = useState(10);
  const [maxTime, setMaxTime] = useState(30);
  const [gameState, setGameState] = useState<GameState>('setup');
  const [passCount, setPassCount] = useState(0);
  
  const timerRef = useRef<number | null>(null);

  const startGame = () => {
    if (minTime > maxTime || minTime < 1) {
      alert('설정값이 올바르지 않습니다.');
      return;
    }
    
    setGameState('playing');
    setPassCount(0);
    
    // minTime ~ maxTime 사이의 랜덤 시간(밀리초) 생성
    const randomTime = Math.floor(Math.random() * (maxTime - minTime + 1) * 1000) + minTime * 1000;
    
    timerRef.current = window.setTimeout(() => {
      setGameState('exploded');
      // 폭발 시 햅틱 피드백 (모바일)
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([500, 200, 500]);
      }
    }, randomTime);
  };

  const passBomb = () => {
    if (gameState !== 'playing') return;
    
    setPassCount(c => c + 1);
    
    // 패스 시 짧은 햅틱 피드백
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(30);
    }
  };

  const resetGame = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setGameState('setup');
  };

  // 컴포넌트 언마운트 시 타이머 클리어
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className={`${styles.container} ${gameState === 'exploded' ? styles.shakeScreen : ''}`}>
      {gameState === 'setup' ? (
        <div className={`glass-panel ${styles.setupPanel} animate-fade-in`}>
          <h2 style={{ marginBottom: '2rem', textAlign: 'center', fontSize: '2rem' }}>💣 폭탄 돌리기</h2>
          
          <div className={styles.inputGroup}>
            <label>최소 터짐 시간 (초)</label>
            <div className={styles.numControl}>
              <button type="button" onClick={() => setMinTime(c => Math.max(1, c - 5))}>-</button>
              <input type="number" readOnly value={minTime} />
              <button type="button" onClick={() => setMinTime(c => Math.min(maxTime, c + 5))}>+</button>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label>최대 터짐 시간 (초)</label>
            <div className={styles.numControl}>
              <button type="button" onClick={() => setMaxTime(c => Math.max(minTime, c - 5))}>-</button>
              <input type="number" readOnly value={maxTime} />
              <button type="button" onClick={() => setMaxTime(c => Math.min(120, c + 5))}>+</button>
            </div>
          </div>

          <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.95rem' }}>
            설정된 시간 사이의 랜덤한 시점에 폭탄이 터집니다.<br/>
            누구에게 터질지 모르는 긴장감을 즐겨보세요!
          </p>

          <button className="btn-primary" style={{ width: '100%', marginTop: '2rem', padding: '16px', fontSize: '1.25rem' }} onClick={startGame}>
            게임 시작!
          </button>
        </div>
      ) : (
        <div className={`${styles.gamePanel} animate-fade-in`}>
          <div className={styles.scoreBoard}>
            <div className={styles.scoreLabel}>패스 횟수</div>
            <div className={styles.scoreValue}>{passCount}</div>
          </div>

          <div 
            className={`${styles.bombContainer} ${gameState === 'playing' ? styles.playing : styles.exploded}`}
            onClick={passBomb}
          >
            {gameState === 'playing' ? '💣' : '💥'}
          </div>

          <div className={styles.messageBox}>
            {gameState === 'playing' ? (
              <h2 className={styles.playingText}>터치해서 폭탄을 넘기세요!</h2>
            ) : (
              <h1 className={styles.explodedText}>폭발했습니다!</h1>
            )}
          </div>

          {gameState === 'exploded' && (
             <button className="btn-primary animate-fade-in" style={{ padding: '12px 32px', fontSize: '1.25rem', marginTop: '2rem', animationDelay: '0.5s' }} onClick={resetGame}>
               다시 하기
             </button>
          )}
        </div>
      )}
    </div>
  );
}
